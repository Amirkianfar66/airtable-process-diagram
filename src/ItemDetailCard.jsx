// ItemDetailCard.jsx (patched)
import React, { useEffect, useState } from 'react';

// simple runtime cache for resolved type names by record id
const typeCache = new Map();

export default function ItemDetailCard({
    item,
    onChange,
    items = [],
    edges = [],
    onDeleteEdge,
    onUpdateEdge,
    onCreateInlineValve,
    onDeleteItem,
}) {
    const [localItem, setLocalItem] = useState(item || {});
    const [resolvedType, setResolvedType] = useState('');
    const [allTypes, setAllTypes] = useState([]);

    const safeOnChange = (payload, options) => {
        if (typeof onChange !== "function") return;
        try {
            onChange(payload, options);
        } catch (err) {
            console.error("[safeOnChange] onChange threw:", err);
            try {
                console.log("[safeOnChange] payload:", payload);
                console.log("[safeOnChange] options:", options);
            } catch (e) { }
        }
    };

    // ---- PATCH 1: only update localItem when the selected item's id changes ----
    useEffect(() => {
        console.log('ItemDetailCard | incoming item id:', item?.id);
        setLocalItem(item || {});
    }, [item?.id]);

    useEffect(() => {
        const fetchTypes = async () => {
            try {
                const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
                const token = import.meta.env.VITE_AIRTABLE_TOKEN;
                const equipTypesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
                const valveTypesTableId = import.meta.env.VITE_AIRTABLE_ValveTYPES_TABLE_ID;

                let typesList = [];

                if (equipTypesTableId) {
                    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${equipTypesTableId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    typesList = typesList.concat(
                        (data.records || []).map((r) => ({
                            id: r.id,
                            name: r.fields['Still Pipe'] || r.fields['Name'] || '',
                            category: r.fields['Category'] || 'Equipment',
                        }))
                    );
                }

                if (valveTypesTableId) {
                    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${valveTypesTableId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    typesList = typesList.concat(
                        (data.records || []).map((r) => ({
                            id: r.id,
                            name: r.fields['Still Pipe'] || r.fields['Name'] || '',
                            category: 'Inline Valve',
                        }))
                    );
                }

                setAllTypes(typesList);
            } catch (err) {
                console.error('Error fetching types:', err);
            }
        };
        fetchTypes();
    }, []);

    const fetchTypeNameById = async (typeId, category) => {
        if (typeCache.has(typeId)) return typeCache.get(typeId);

        const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
        const token = import.meta.env.VITE_AIRTABLE_TOKEN;
        const equipTypesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
        const valveTypesTableId = import.meta.env.VITE_AIRTABLE_ValveTYPES_TABLE_ID;

        let tableId = equipTypesTableId;
        let fieldName = 'Still Pipe';

        if (category === 'Inline Valve') {
            tableId = valveTypesTableId;
            fieldName = 'Still Pipe';
        }

        if (!tableId) return 'Unknown';

        try {
            const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${typeId}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const record = await res.json();
            const name = (record?.fields && (record.fields[fieldName] || record.fields['Name'])) || 'Unknown Type';
            typeCache.set(typeId, name);
            return name;
        } catch (err) {
            console.error('Error fetching type by id', err);
            return 'Unknown Type';
        }
    };

    useEffect(() => {
        if (!item || !item.Type) {
            setResolvedType('-');
            return;
        }

        if (Array.isArray(item.Type) && item.Type.length > 0) {
            const typeIdOrName = item.Type[0];
            if (typeof typeIdOrName === 'string' && typeIdOrName.startsWith('rec')) {
                if (typeCache.has(typeIdOrName)) {
                    setResolvedType(typeCache.get(typeIdOrName));
                    return;
                }
                setResolvedType('Loading...');
                (async () => {
                    const category = item['Category Item Type'] || item.Category || 'Equipment';
                    const name = await fetchTypeNameById(typeIdOrName, category);
                    setResolvedType(name);
                })();
            } else {
                setResolvedType(typeIdOrName);
            }
        } else {
            setResolvedType(item.Type);
        }
    }, [item]);

    useEffect(() => {
        if (!item || !edges || !Array.isArray(edges) || !items || !Array.isArray(items)) return;

        const firstConnId = item.Connections?.[0];
        if (!firstConnId) return;

        const edge = edges.find((e) => e.id === firstConnId);
        if (!edge) return;

        const findItemById = (id) => items.find((it) => it.id === id) || {};

        const fromItem = findItemById(edge.source);
        const toItem = findItemById(edge.target);

        setLocalItem((prev) => ({
            ...prev,
            edgeId: edge.id,
            from: fromItem.Name ? `${fromItem.Name} (${edge.source})` : edge.source,
            to: toItem.Name ? `${toItem.Name} (${edge.target})` : edge.target,
        }));
    }, [item, edges, items]);

    // ---- PATCH 3: small debug flag and explicit reposition marker ----
    const commitUpdate = (updatedObj = {}, options = { reposition: false }) => {
        const authoritativeId = updatedObj?.id ?? item?.id ?? localItem?.id;

        const chosenX = (typeof updatedObj?.x === 'number') ? updatedObj.x
            : (typeof localItem?.x === 'number') ? localItem.x
                : (typeof item?.x === 'number') ? item.x
                    : undefined;

        const chosenY = (typeof updatedObj?.y === 'number') ? updatedObj.y
            : (typeof localItem?.y === 'number') ? localItem.y
                : (typeof item?.y === 'number') ? item.y
                    : undefined;

        const payload = { ...updatedObj, id: authoritativeId };

        if (!options.reposition) {
            if (typeof chosenX === 'number') payload.x = Number(chosenX);
            if (typeof chosenY === 'number') payload.y = Number(chosenY);
        }

        // local UI update
        setLocalItem(prev => ({ ...prev, ...updatedObj }));

        // include explicit marker if requesting reposition
        if (options.reposition) payload._repositionRequest = true;

        safeOnChange(payload, options);
    };

    // ---- PATCH 2: do NOT auto-force reposition for Unit/SubUnit ----
    const handleFieldChange = (fieldName, value, options = { reposition: false }) => {
        const repositionFlag = options.reposition === true;

        const updated = { ...(localItem || {}), [fieldName]: value };
        if (!updated.id && item?.id) updated.id = item.id;

        commitUpdate(updated, { reposition: repositionFlag });
    };

    const getSimpleLinkedValue = (field) => (Array.isArray(field) ? field.join(', ') || '-' : field || '-');

    if (!item) {
        return (
            <div style={{ padding: 20, color: '#888' }}>
                No item selected. Select a node or edge to view details.
            </div>
        );
    }

    const categories = ['Equipment', 'Instrument', 'Inline Valve', 'Pipe', 'Electrical'];
    const filteredTypes = allTypes.filter((t) => t.category === (localItem['Category Item Type'] || 'Equipment'));

    const rowStyle = { display: 'flex', alignItems: 'center', marginBottom: '12px' };
    const labelStyle = { width: '130px', fontWeight: 500, color: '#555', textAlign: 'right', marginRight: '12px' };
    const inputStyle = { flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', outline: 'none', background: '#fafafa' };
    const sectionStyle = { marginBottom: '24px' };
    const headerStyle = { borderBottom: '1px solid #eee', paddingBottom: '6px', marginBottom: '12px', marginTop: 0, color: '#333' };

    const liveEdge = item._edge || {};

    return (
        <>
            <div style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '20px', margin: '16px', maxWidth: '350px', fontFamily: 'sans-serif' }}>
                <section style={sectionStyle}>
                    <h3 style={headerStyle}>General Info</h3>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Code:</label>
                        <input style={inputStyle} type="text" value={localItem['Item Code'] || ''} onChange={(e) => handleFieldChange('Item Code', e.target.value)} />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Name:</label>
                        <input style={inputStyle} type="text" value={localItem['Name'] || ''} onChange={(e) => handleFieldChange('Name', e.target.value)} />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Category:</label>
                        <select style={inputStyle} value={localItem['Category Item Type'] || 'Equipment'} onChange={(e) => {
                            const newCategory = e.target.value;
                            const updated = { ...localItem, 'Category Item Type': newCategory, Category: newCategory, Type: '' };
                            commitUpdate(updated, { reposition: false });
                        }}>
                            {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                        </select>
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Type:</label>
                        <select style={inputStyle} value={localItem.Type || ''} onChange={(e) => handleFieldChange('Type', e.target.value)}>
                            <option value="">Select Type</option>
                            {filteredTypes.map((t) => (<option key={t.id} value={t.name}>{t.name}</option>))}
                        </select>
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Unit:</label>
                        <input style={inputStyle} type="text" value={localItem['Unit'] || ''} onChange={(e) => handleFieldChange('Unit', e.target.value)} />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Sub Unit:</label>
                        <input style={inputStyle} type="text" value={localItem['SubUnit'] || ''} onChange={(e) => handleFieldChange('SubUnit', e.target.value)} />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>From Item:</label>
                        <input style={inputStyle} type="text" value={localItem['from'] || ''} onChange={(e) => handleFieldChange('from', e.target.value)} placeholder="Source item ID / name" />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>To Item:</label>
                        <input style={inputStyle} type="text" value={localItem['to'] || ''} onChange={(e) => handleFieldChange('to', e.target.value)} placeholder="Target item ID / name" />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Edge ID:</label>
                        <input style={inputStyle} type="text" value={localItem['edgeId'] || ''} onChange={(e) => handleFieldChange('edgeId', e.target.value)} placeholder="edge-xxx" />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>X Position:</label>
                        <input style={inputStyle} type="number" value={localItem['x'] ?? ''} onChange={(e) => handleFieldChange('x', parseFloat(e.target.value))} />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Y Position:</label>
                        <input style={inputStyle} type="number" value={localItem['y'] ?? ''} onChange={(e) => handleFieldChange('y', parseFloat(e.target.value))} />
                    </div>

                    {/* explicit save / reposition controls could be added here if you want */}
                </section>

                <section style={sectionStyle}>
                    <h3 style={headerStyle}>Procurement Info</h3>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Model Number:</label>
                        <input style={inputStyle} type="text" value={localItem['Model Number'] || ''} onChange={(e) => handleFieldChange('Model Number', e.target.value)} />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Manufacturer:</label>
                        <input style={inputStyle} type="text" value={getSimpleLinkedValue(localItem['Manufacturer (from Technical Spec)'])} onChange={(e) => handleFieldChange('Manufacturer (from Technical Spec)', e.target.value)} />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Supplier:</label>
                        <input style={inputStyle} type="text" value={getSimpleLinkedValue(localItem['Supplier (from Technical Spec)'])} onChange={(e) => handleFieldChange('Supplier (from Technical Spec)', e.target.value)} />
                    </div>
                </section>
            </div>

            {item?._edge && (
                <div style={{ margin: '0 16px 16px 16px', maxWidth: 350 }}>
                    <h4 style={{ margin: '8px 0' }}>Edge controls</h4>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input style={{ flex: 1, padding: 8 }} value={liveEdge.label ?? ''} placeholder="Edge label" onChange={(e) => onUpdateEdge && onUpdateEdge(item.edgeId, { label: e.target.value })} />
                        <button onClick={() => onUpdateEdge && onUpdateEdge(item.edgeId, { animated: !(liveEdge.animated) })}>
                            {liveEdge.animated ? 'Disable animation' : 'Enable animation'}
                        </button>
                    </div>
                    {/* Delete Item Button */}
                    {onDeleteItem && (
                        <div style={{ marginTop: 16, textAlign: 'center' }}>
                            <button
                                onClick={() => {
                                    if (window.confirm(`Delete item "${item?.Name || item?.id}"?`)) {
                                        onDeleteItem(item.id);
                                    }
                                }}
                                style={{
                                    background: '#f44336',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '10px 16px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                }}
                            >
                                Delete Item
                            </button>
                        </div>
                    )}


                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <label style={{ width: 70 }}>Color</label>
                        <input type="color" value={(liveEdge.style && liveEdge.style.stroke) || '#000000'} onChange={(e) => onUpdateEdge && onUpdateEdge(item.edgeId, { style: { ...(liveEdge.style || {}), stroke: e.target.value } })} />
                        <input type="text" value={(liveEdge.style && liveEdge.style.stroke) || ''} onChange={(e) => onUpdateEdge && onUpdateEdge(item.edgeId, { style: { ...(liveEdge.style || {}), stroke: e.target.value } })} style={{ flex: 1, padding: 8 }} />
                        {item?.edgeId && onDeleteEdge && (
                            <button onClick={() => onDeleteEdge(item.edgeId)} style={{ marginLeft: 8, background: '#f44336', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
                                Delete Edge
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}