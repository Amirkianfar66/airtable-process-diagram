import React, { useEffect, useState, useRef, useMemo } from 'react';

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
    const debounceRef = useRef(null);

    // safe wrapper
    const safeOnChange = (payload, options) => {
        if (typeof onChange !== 'function') return;
        try {
            onChange(payload, options);
        } catch (err) {
            console.error('[safeOnChange] onChange threw:', err);
            try {
                console.log('[safeOnChange] payload:', payload, 'options:', options);
            } catch (e) { }
        }
    };

    // sync local when selected item id changes (PATCH 1)
    useEffect(() => {
        setLocalItem(item || {});
    }, [item?.id]);

    // fetch types via your serverless endpoint (do not call Airtable directly from client)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch('/api/airtable/types'); // server endpoint returns { types: [...] }
                if (!mounted) return;
                if (!res.ok) {
                    console.error('Failed to fetch types', res.statusText);
                    return;
                }
                const json = await res.json();
                setAllTypes(json.types || []);
            } catch (err) {
                console.error('Error fetching types:', err);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // helper to fetch a single type name by id (keeps cache)
    const fetchTypeNameById = async (typeId) => {
        if (!typeId) return 'Unknown';
        if (typeCache.has(typeId)) return typeCache.get(typeId);
        // try from allTypes first
        const found = allTypes.find(t => t.id === typeId);
        if (found) {
            typeCache.set(typeId, found.name);
            return found.name;
        }

        // fallback: try server endpoint to fetch single record (optional)
        try {
            const res = await fetch(`/api/airtable/types/${typeId}`);
            if (!res.ok) return 'Unknown';
            const json = await res.json();
            const name = json?.name || 'Unknown';
            typeCache.set(typeId, name);
            return name;
        } catch (err) {
            console.error('fetchTypeNameById error', err);
            return 'Unknown';
        }
    };

    // resolve item.Type to a readable label
    useEffect(() => {
        if (!item || !item.Type) {
            setResolvedType('-');
            return;
        }
        if (Array.isArray(item.Type) && item.Type.length > 0) {
            const typeRef = item.Type[0];
            if (typeof typeRef === 'string' && typeRef.startsWith('rec')) {
                if (typeCache.has(typeRef)) {
                    setResolvedType(typeCache.get(typeRef));
                    return;
                }
                setResolvedType('Loading...');
                (async () => {
                    const name = await fetchTypeNameById(typeRef);
                    setResolvedType(name);
                })();
            } else {
                setResolvedType(typeRef);
            }
        } else {
            setResolvedType(item.Type || '-');
        }
    }, [item, allTypes]);

    // infer first connected edge and resolve "from" "to" display
    useEffect(() => {
        if (!item || !edges || !items) return;
        const firstConnId = item.Connections?.[0];
        if (!firstConnId) return;
        const edge = edges.find(e => e.id === firstConnId);
        if (!edge) return;

        const findItemById = (id) => items.find(it => it.id === id) || {};

        const fromItem = findItemById(edge.source);
        const toItem = findItemById(edge.target);

        setLocalItem(prev => ({
            ...prev,
            edgeId: edge.id,
            from: fromItem.Name ? `${fromItem.Name} (${edge.source})` : edge.source,
            to: toItem.Name ? `${toItem.Name} (${edge.target})` : edge.target,
        }));
    }, [item, edges, items]);

    // commitUpdate with debounce to reduce write frequency
    const commitUpdate = (updatedObj = {}, options = { reposition: false }) => {
        const authoritativeId = updatedObj?.id ?? item?.id ?? localItem?.id;

        const pickNumber = (v) => (typeof v === 'number' && !Number.isNaN(v) ? Number(v) : undefined);

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
            const px = pickNumber(chosenX);
            const py = pickNumber(chosenY);
            if (typeof px === 'number') payload.x = Number(px);
            if (typeof py === 'number') payload.y = Number(py);
        }

        // local state update immediately for snappy UI
        setLocalItem(prev => ({ ...prev, ...updatedObj }));

        if (options.reposition) payload._repositionRequest = true;

        // debounce writes to parent
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            safeOnChange(payload, options);
            debounceRef.current = null;
        }, 600);
    };

    // handler used by inputs
    const handleFieldChange = (fieldName, value, options = { reposition: false }) => {
        // sanitize numeric fields
        if ((fieldName === 'x' || fieldName === 'y') && (value === '' || Number.isNaN(value))) {
            // set to empty string locally but don't send NaN
            setLocalItem(prev => ({ ...prev, [fieldName]: '' }));
            return;
        }

        // When updating Type from dropdown: store as array of record ids
        if (fieldName === 'Type') {
            const newType = value ? [value] : [];
            commitUpdate({ ...localItem, Type: newType }, options);
            return;
        }

        const updated = { ...(localItem || {}), [fieldName]: value };
        if (!updated.id && item?.id) updated.id = item.id;
        commitUpdate(updated, options);
    };

    const getSimpleLinkedValue = (field) => (Array.isArray(field) ? field.join(', ') || '' : field || '');

    if (!item) {
        return (
            <div style={{ padding: 20, color: '#888' }}>
                No item selected. Select a node or edge to view details.
            </div>
        );
    }

    const categories = ['Equipment', 'Instrument', 'Inline Valve', 'Pipe', 'Electrical'];

    // filter types by category - prefer localItem's chosen category fallback to Equipment
    const activeCategory = localItem['Category Item Type'] || localItem.Category || 'Equipment';
    const filteredTypes = useMemo(() => allTypes.filter(t => t.category === activeCategory), [allTypes, activeCategory]);

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
                        <select style={inputStyle} value={activeCategory} onChange={(e) => {
                            const newCategory = e.target.value;
                            const updated = { ...localItem, 'Category Item Type': newCategory, Category: newCategory };
                            // when category changes, clear Type so user picks a valid one
                            updated.Type = [];
                            commitUpdate(updated, { reposition: false });
                        }}>
                            {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                        </select>
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Type:</label>
                        <select style={inputStyle} value={(Array.isArray(localItem.Type) && localItem.Type[0]) || ''} onChange={(e) => handleFieldChange('Type', e.target.value)}>
                            <option value="">Select Type</option>
                            {filteredTypes.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
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
                        <input style={inputStyle} type="number" value={localItem['x'] ?? ''} onChange={(e) => handleFieldChange('x', e.target.value === '' ? '' : parseFloat(e.target.value))} />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Y Position:</label>
                        <input style={inputStyle} type="number" value={localItem['y'] ?? ''} onChange={(e) => handleFieldChange('y', e.target.value === '' ? '' : parseFloat(e.target.value))} />
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

            {onDeleteItem && (
                <div style={{ margin: '16px', maxWidth: 350, textAlign: 'center' }}>
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

            {item?._edge && (
                <div style={{ margin: '0 16px 16px 16px', maxWidth: 350 }}>
                    <h4 style={{ margin: '8px 0' }}>Edge controls</h4>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input style={{ flex: 1, padding: 8 }} value={liveEdge.label ?? ''} placeholder="Edge label" onChange={(e) => onUpdateEdge && onUpdateEdge(item.edgeId, { label: e.target.value })} />
                        <button onClick={() => onUpdateEdge && onUpdateEdge(item.edgeId, { animated: !(liveEdge.animated) })}>
                            {liveEdge.animated ? 'Disable animation' : 'Enable animation'}
                        </button>
                    </div>

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
