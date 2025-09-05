// src/components/ItemDetailCard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function ItemDetailCard({
    item,
    onChange,
    items = [],
    edges = [],
    onDeleteEdge,
    onUpdateEdge,
    onCreateInlineValve, // kept in case you use it elsewhere
    onDeleteItem,
}) {
    const [localItem, setLocalItem] = useState(item || {});
    const debounceRef = useRef(null);

    // safe wrapper
    const safeOnChange = (payload, options) => {
        if (typeof onChange !== 'function') return;
        try {
            onChange(payload, options);
        } catch (err) {
            console.error('[safeOnChange] onChange threw:', err, { payload, options });
        }
    };

    // keep local in sync with selection
    useEffect(() => {
        setLocalItem(item || {});
    }, [item?.id]);

    // ---- Build Types from in-memory items (NO Airtable calls here) ----
    // Map: category -> unique type names (strings)
    const typesByCategory = useMemo(() => {
        const map = new Map();
        if (!Array.isArray(items)) return map;

        items.forEach((it) => {
            const cat =
                it?.['Category Item Type'] || it?.Category || 'Equipment';
            let t = it?.Type;

            // normalize “Type” to a single string for our dropdown
            if (Array.isArray(t)) t = t[0];
            if (!t) return;

            const key = String(cat);
            const val = String(t);

            if (!map.has(key)) map.set(key, new Set());
            map.get(key).add(val);
        });

        // convert Set -> Array for easier rendering
        const out = new Map();
        for (const [cat, set] of map.entries()) {
            out.set(cat, Array.from(set).sort());
        }
        return out;
    }, [items]);

    // infer first connected edge and resolve "from"/"to" display
    useEffect(() => {
        if (!item || !edges || !items) return;
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

    // debounce + lift changes up (local only; no network)
    const commitUpdate = (updatedObj = {}, options = { reposition: false }) => {
        const authoritativeId = updatedObj?.id ?? item?.id ?? localItem?.id;

        // keep x/y if present (no reposition writes from here)
        const pickNumber = (v) =>
            typeof v === 'number' && !Number.isNaN(v) ? Number(v) : undefined;

        const chosenX =
            typeof updatedObj?.x === 'number'
                ? updatedObj.x
                : typeof localItem?.x === 'number'
                    ? localItem.x
                    : typeof item?.x === 'number'
                        ? item.x
                        : undefined;

        const chosenY =
            typeof updatedObj?.y === 'number'
                ? updatedObj.y
                : typeof localItem?.y === 'number'
                    ? localItem.y
                    : typeof item?.y === 'number'
                        ? item.y
                        : undefined;

        const payload = { ...updatedObj, id: authoritativeId };

        if (!options.reposition) {
            const px = pickNumber(chosenX);
            const py = pickNumber(chosenY);
            if (typeof px === 'number') payload.x = Number(px);
            if (typeof py === 'number') payload.y = Number(py);
        }

        // Local UI snappiness
        setLocalItem((prev) => ({ ...prev, ...updatedObj }));

        if (options.reposition) payload._repositionRequest = true;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            safeOnChange(payload, options);
            debounceRef.current = null;
        }, 400);
    };

    // inputs -> local + lift
    const handleFieldChange = (fieldName, value, options = { reposition: false }) => {
        if ((fieldName === 'x' || fieldName === 'y') && (value === '' || Number.isNaN(value))) {
            setLocalItem((prev) => ({ ...prev, [fieldName]: '' }));
            return;
        }

        // For Type we store a simple string (taken from dropdown),
        // which matches how we built the list above (from items).
        if (fieldName === 'Type') {
            const updated = { ...(localItem || {}), Type: value || '' };
            if (!updated.id && item?.id) updated.id = item.id;
            commitUpdate(updated, options);
            return;
        }

        const updated = { ...(localItem || {}), [fieldName]: value };
        if (!updated.id && item?.id) updated.id = item.id;
        commitUpdate(updated, options);
    };

    const getSimpleLinkedValue = (field) =>
        Array.isArray(field) ? field.join(', ') || '' : field || '';

    if (!item) {
        return (
            <div style={{ padding: 20, color: '#888' }}>
                No item selected. Select a node or edge to view details.
            </div>
        );
    }

    const categories = ['Equipment', 'Instrument', 'Inline Valve', 'Pipe', 'Electrical'];

    // current category to filter the dropdown
    const activeCategory =
        localItem['Category Item Type'] || localItem.Category || 'Equipment';

    // list of type names (strings) for the active category
    const typeOptions = typesByCategory.get(activeCategory) || [];

    const rowStyle = { display: 'flex', alignItems: 'center', marginBottom: '12px' };
    const labelStyle = {
        width: '130px',
        fontWeight: 500,
        color: '#555',
        textAlign: 'right',
        marginRight: '12px',
    };
    const inputStyle = {
        flex: 1,
        padding: '6px 10px',
        borderRadius: '6px',
        border: '1px solid #ccc',
        fontSize: '14px',
        outline: 'none',
        background: '#fafafa',
    };
    const sectionStyle = { marginBottom: '24px' };
    const headerStyle = {
        borderBottom: '1px solid #eee',
        paddingBottom: '6px',
        marginBottom: '12px',
        marginTop: 0,
        color: '#333',
    };

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
                        <input
                            style={inputStyle}
                            type="text"
                            value={localItem['Item Code'] || ''}
                            onChange={(e) => handleFieldChange('Item Code', e.target.value)}
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Name:</label>
                        <input
                            style={inputStyle}
                            type="text"
                            value={localItem['Name'] || ''}
                            onChange={(e) => handleFieldChange('Name', e.target.value)}
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Category:</label>
                        <select
                            style={inputStyle}
                            value={activeCategory}
                            onChange={(e) => {
                                const newCategory = e.target.value;
                                const updated = {
                                    ...localItem,
                                    'Category Item Type': newCategory,
                                    Category: newCategory,
                                    // clear Type so user re-picks a valid one for the new category
                                    Type: '',
                                };
                                commitUpdate(updated, { reposition: false });
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
                        <select
                            style={inputStyle}
                            value={
                                Array.isArray(localItem.Type) ? localItem.Type[0] || '' : localItem.Type || ''
                            }
                            onChange={(e) => handleFieldChange('Type', e.target.value)}
                        >
                            <option value="">Select Type</option>
                            {typeOptions.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Unit:</label>
                        <input
                            style={inputStyle}
                            type="text"
                            value={localItem['Unit'] || ''}
                            onChange={(e) => handleFieldChange('Unit', e.target.value)}
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Sub Unit:</label>
                        <input
                            style={inputStyle}
                            type="text"
                            value={localItem['SubUnit'] || ''}
                            onChange={(e) => handleFieldChange('SubUnit', e.target.value)}
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>From Item:</label>
                        <input
                            style={inputStyle}
                            type="text"
                            value={localItem['from'] || ''}
                            onChange={(e) => handleFieldChange('from', e.target.value)}
                            placeholder="Source item ID / name"
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>To Item:</label>
                        <input
                            style={inputStyle}
                            type="text"
                            value={localItem['to'] || ''}
                            onChange={(e) => handleFieldChange('to', e.target.value)}
                            placeholder="Target item ID / name"
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Edge ID:</label>
                        <input
                            style={inputStyle}
                            type="text"
                            value={localItem['edgeId'] || ''}
                            onChange={(e) => handleFieldChange('edgeId', e.target.value)}
                            placeholder="edge-xxx"
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>X Position:</label>
                        <input
                            style={inputStyle}
                            type="number"
                            value={localItem['x'] ?? ''}
                            onChange={(e) =>
                                handleFieldChange('x', e.target.value === '' ? '' : parseFloat(e.target.value))
                            }
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Y Position:</label>
                        <input
                            style={inputStyle}
                            type="number"
                            value={localItem['y'] ?? ''}
                            onChange={(e) =>
                                handleFieldChange('y', e.target.value === '' ? '' : parseFloat(e.target.value))
                            }
                        />
                    </div>
                </section>

                <section style={sectionStyle}>
                    <h3 style={headerStyle}>Procurement Info</h3>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Model Number:</label>
                        <input
                            style={inputStyle}
                            type="text"
                            value={localItem['Model Number'] || ''}
                            onChange={(e) => handleFieldChange('Model Number', e.target.value)}
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Manufacturer:</label>
                        <input
                            style={inputStyle}
                            type="text"
                            value={getSimpleLinkedValue(localItem['Manufacturer (from Technical Spec)'])}
                            onChange={(e) =>
                                handleFieldChange('Manufacturer (from Technical Spec)', e.target.value)
                            }
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Supplier:</label>
                        <input
                            style={inputStyle}
                            type="text"
                            value={getSimpleLinkedValue(localItem['Supplier (from Technical Spec)'])}
                            onChange={(e) =>
                                handleFieldChange('Supplier (from Technical Spec)', e.target.value)
                            }
                        />
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
                        <input
                            style={{ flex: 1, padding: 8 }}
                            value={liveEdge.label ?? ''}
                            placeholder="Edge label"
                            onChange={(e) => onUpdateEdge && onUpdateEdge(item.edgeId, { label: e.target.value })}
                        />
                        <button
                            onClick={() =>
                                onUpdateEdge && onUpdateEdge(item.edgeId, { animated: !liveEdge.animated })
                            }
                        >
                            {liveEdge.animated ? 'Disable animation' : 'Enable animation'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <label style={{ width: 70 }}>Color</label>
                        <input
                            type="color"
                            value={(liveEdge.style && liveEdge.style.stroke) || '#000000'}
                            onChange={(e) =>
                                onUpdateEdge &&
                                onUpdateEdge(item.edgeId, {
                                    style: { ...(liveEdge.style || {}), stroke: e.target.value },
                                })
                            }
                        />
                        <input
                            type="text"
                            value={(liveEdge.style && liveEdge.style.stroke) || ''}
                            onChange={(e) =>
                                onUpdateEdge &&
                                onUpdateEdge(item.edgeId, {
                                    style: { ...(liveEdge.style || {}), stroke: e.target.value },
                                })
                            }
                            style={{ flex: 1, padding: 8 }}
                        />
                        {item?.edgeId && onDeleteEdge && (
                            <button
                                onClick={() => onDeleteEdge(item.edgeId)}
                                style={{
                                    marginLeft: 8,
                                    background: '#f44336',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                }}
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
