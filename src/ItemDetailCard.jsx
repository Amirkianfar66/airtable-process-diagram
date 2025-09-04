import React, { useEffect, useState } from 'react';

const typeCache = new Map();

/**
 * ItemDetailCard (default export)
 */
export default function ItemDetailCard({
    item,
    onChange,
    items = [],
    edges = [],
    onDeleteEdge,
    onUpdateEdge,
    onCreateInlineValve, // left in signature in case you use it elsewhere
}) {
    const [localItem, setLocalItem] = useState(item || {});
    const [resolvedType, setResolvedType] = useState('');
    const [allTypes, setAllTypes] = useState([]);

    // Update local state when item changes
    useEffect(() => {
        console.log('ItemDetailCard | incoming item:', item);
        setLocalItem(item || {});
    }, [item]);

    // Fetch all types from Airtable for dropdown (unchanged)
    useEffect(() => {
        const fetchTypes = async () => {
            try {
                const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
                const token = import.meta.env.VITE_AIRTABLE_TOKEN;
                const equipTypesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
                const valveTypesTableId = import.meta.env.VITE_AIRTABLE_ValveTYPES_TABLE_ID;

                let typesList = [];

                // Fetch Equipment/Instrument types
                if (equipTypesTableId) {
                    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${equipTypesTableId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    typesList = typesList.concat(
                        (data.records || []).map((r) => ({
                            id: r.id,
                            name: r.fields['Still Pipe'],
                            category: r.fields['Category'] || 'Equipment',
                        }))
                    );
                }

                // Fetch Inline Valve types
                if (valveTypesTableId) {
                    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${valveTypesTableId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    typesList = typesList.concat(
                        (data.records || []).map((r) => ({
                            id: r.id,
                            name: r.fields['Valve Type'],   // 👈 make sure this matches your Airtable column name
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


    // Resolve linked "Type" name for display (unchanged)
    useEffect(() => {
        if (!item || !item.Type) {
            setResolvedType('-');
            return;
        }
        if (Array.isArray(item.Type) && item.Type.length > 0) {
            const typeId = item.Type[0];
            if (typeCache.has(typeId)) {
                setResolvedType(typeCache.get(typeId));
                return;
            }
            setResolvedType('Loading...');
            const fetchTypeName = async () => {
                try {
                    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
                    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
                    const typesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
                    const url = `https://api.airtable.com/v0/${baseId}/${typesTableId}/${typeId}`;
                    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                    const record = await res.json();
                    const typeName = record.fields['Still Pipe'] || 'Unknown Type';
                    setResolvedType(typeName);
                    typeCache.set(typeId, typeName);
                } catch (err) {
                    console.error(err);
                    setResolvedType(item.Type);
                }
            };
            fetchTypeName();
        } else {
            setResolvedType(item.Type);
        }
    }, [item]);

    // Sync first connection into localItem (unchanged)
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

    const handleFieldChange = (fieldName, value) => {
        const updated = { ...localItem, [fieldName]: value };
        setLocalItem(updated);
        if (onChange) onChange(updated);
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

    // small helper for edge UI
    const liveEdge = item._edge || {};

    return (
        <>
            <div
                style={{
                    background: '#fff',
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: '20px',
                    margin: '16px',
                    maxWidth: '350px',
                    fontFamily: 'sans-serif',
                }}
            >
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
                        <select
                            style={inputStyle}
                            value={localItem['Category Item Type'] || 'Equipment'}
                            onChange={(e) => {
                                const newCategory = e.target.value;
                                const updated = {
                                    ...localItem,
                                    'Category Item Type': newCategory,
                                    Category: newCategory,
                                    Type: '',
                                };
                                setLocalItem(updated);
                                if (onChange) onChange(updated);
                            }}
                        >
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Type:</label>
                        <select style={inputStyle} value={localItem.Type || ''} onChange={(e) => handleFieldChange('Type', e.target.value)}>
                            <option value="">Select Type</option>
                            {filteredTypes.map((t) => (
                                <option key={t.id} value={t.name}>
                                    {t.name}
                                </option>
                            ))}
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

            {/* EDGE controls (when an edge is selected) */}
            {item?._edge && (
                <div style={{ margin: '0 16px 16px 16px', maxWidth: 350 }}>
                    <h4 style={{ margin: '8px 0' }}>Edge controls</h4>

                    {/* label + animated toggle */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input
                            style={{ flex: 1, padding: 8 }}
                            value={liveEdge.label ?? ''}
                            placeholder="Edge label"
                            onChange={(e) => onUpdateEdge && onUpdateEdge(item.edgeId, { label: e.target.value })}
                        />
                        <button onClick={() => onUpdateEdge && onUpdateEdge(item.edgeId, { animated: !(liveEdge.animated) })}>
                            {liveEdge.animated ? 'Disable animation' : 'Enable animation'}
                        </button>
                    </div>

                    {/* color */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <label style={{ width: 70 }}>Color</label>
                        <input
                            type="color"
                            value={(liveEdge.style && liveEdge.style.stroke) || '#000000'}
                            onChange={(e) => onUpdateEdge && onUpdateEdge(item.edgeId, { style: { ...(liveEdge.style || {}), stroke: e.target.value } })}
                        />
                        <input
                            type="text"
                            value={(liveEdge.style && liveEdge.style.stroke) || ''}
                            onChange={(e) => onUpdateEdge && onUpdateEdge(item.edgeId, { style: { ...(liveEdge.style || {}), stroke: e.target.value } })}
                            style={{ flex: 1, padding: 8 }}
                        />
                        {/* Delete Edge button */}
                        {item?.edgeId && onDeleteEdge && (
                            <button
                                onClick={() => onDeleteEdge(item.edgeId)}
                                style={{ marginLeft: 8, background: '#f44336', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                            >
                                Delete Edge
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
