import React, { useEffect, useState, useRef, useMemo } from 'react';

// runtime cache for typeId -> name
const typeNameCache = new Map();

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
    const [allTypes, setAllTypes] = useState([]);
    const debounceRef = useRef(null);

    // --- helpers for unknown shapes from /api/airtable/types ---
    const getTypeId = (t) => t?.id;
    const getTypeName = (t) =>
        t?.name ?? t?.Name ?? t?.fields?.name ?? t?.fields?.Name ?? t?.label ?? 'Unknown';
    const getTypeCategory = (t) =>
        t?.category ??
        t?.Category ??
        t?.['Category Item Type'] ??
        t?.fields?.category ??
        t?.fields?.Category ??
        t?.fields?.['Category Item Type'] ??
        '';

    // safe call
    const safeOnChange = (payload, options) => {
        if (typeof onChange !== 'function') return;
        try {
            onChange(payload, options);
        } catch (e) {
            console.error('[ItemDetailCard] onChange failed:', e);
        }
    };

    // keep local in sync with selected item id
    useEffect(() => {
        setLocalItem(item || {});
    }, [item?.id]);

    // fetch types from your server (which talks to Airtable)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch('/api/airtable/types');
                if (!mounted) return;
                if (!res.ok) {
                    console.error('Failed to fetch types', res.status, res.statusText);
                    setAllTypes([]);
                    return;
                }
                const json = await res.json().catch(() => ({}));
                const types = Array.isArray(json?.types) ? json.types : [];
                setAllTypes(types);
                // warm cache
                types.forEach((t) => {
                    const id = getTypeId(t);
                    if (id) typeNameCache.set(id, getTypeName(t));
                });
            } catch (err) {
                console.error('Error fetching types:', err);
                setAllTypes([]);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // basic edge “from/to” display (best-effort)
    useEffect(() => {
        if (!item || !edges || !items) return;
        const edgeId = item.edgeId || item._edge?.id;
        const edge =
            (edgeId && edges.find((e) => e.id === edgeId)) ||
            edges.find((e) => e.source === item.id || e.target === item.id);

        if (!edge) return;

        const findItemById = (id) => items.find((it) => String(it.id) === String(id)) || {};
        const fromItem = findItemById(edge.source);
        const toItem = findItemById(edge.target);

        setLocalItem((prev) => ({
            ...prev,
            edgeId: edge.id,
            from: fromItem.Name ? `${fromItem.Name} (${edge.source})` : edge.source,
            to: toItem.Name ? `${toItem.Name} (${edge.target})` : edge.target,
        }));
    }, [item?.id, edges, items]);

    // commit minimal delta (NEVER includes x/y)
    const commitUpdate = (patch = {}, options = {}) => {
        const id = patch?.id ?? item?.id ?? localItem?.id;
        const payload = { id, ...patch };
        delete payload.x;
        delete payload.y;

        // optimistic local merge (don’t touch x/y)
        const { x, y, ...uiPatch } = patch || {};
        setLocalItem((prev) => ({ ...prev, ...uiPatch }));

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            safeOnChange(payload, options);
            debounceRef.current = null;
        }, 300);
    };

    const handleFieldChange = (field, value, options = {}) => {
        if (field === 'x' || field === 'y') return; // ignore positions

        if (field === 'Type') {
            // store as single record id string in UI
            commitUpdate({ id: item?.id ?? localItem?.id, Type: value || '' }, options);
            return;
        }

        commitUpdate({ id: item?.id ?? localItem?.id, [field]: value }, options);
    };

    const categories = ['Equipment', 'Instrument', 'Inline Valve', 'Pipe', 'Electrical'];
    const activeCategory = localItem['Category Item Type'] || localItem.Category || 'Equipment';

    const filteredTypes = useMemo(
        () => allTypes.filter((t) => !activeCategory || getTypeCategory(t) === activeCategory),
        [allTypes, activeCategory]
    );

    const row = { display: 'flex', alignItems: 'center', marginBottom: 12 };
    const label = {
        width: 130,
        fontWeight: 500,
        color: '#555',
        textAlign: 'right',
        marginRight: 12,
    };
    const input = {
        flex: 1,
        padding: '6px 10px',
        borderRadius: 6,
        border: '1px solid #ccc',
        fontSize: 14,
        outline: 'none',
        background: '#fafafa',
    };
    const section = { marginBottom: 24 };
    const header = {
        borderBottom: '1px solid #eee',
        paddingBottom: 6,
        marginBottom: 12,
        marginTop: 0,
        color: '#333',
    };

    const liveEdge = item?._edge || {};

    const getSimpleLinkedValue = (v) => (Array.isArray(v) ? v.join(', ') : v || '');

    if (!item) {
        return (
            <div style={{ padding: 20, color: '#888' }}>
                No item selected. Select a node or edge to view details.
            </div>
        );
    }

    return (
        <>
            <div
                style={{
                    background: '#fff',
                    borderRadius: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: 20,
                    margin: 16,
                    maxWidth: 350,
                    fontFamily: 'sans-serif',
                }}
            >
                <section style={section}>
                    <h3 style={header}>General Info</h3>

                    <div style={row}>
                        <label style={label}>Code:</label>
                        <input
                            style={input}
                            type="text"
                            value={localItem['Item Code'] || ''}
                            onChange={(e) => handleFieldChange('Item Code', e.target.value)}
                        />
                    </div>

                    <div style={row}>
                        <label style={label}>Name:</label>
                        <input
                            style={input}
                            type="text"
                            value={localItem['Name'] || ''}
                            onChange={(e) => handleFieldChange('Name', e.target.value)}
                        />
                    </div>

                    <div style={row}>
                        <label style={label}>Category:</label>
                        <select
                            style={input}
                            value={activeCategory}
                            onChange={(e) => {
                                const newCat = e.target.value;
                                // clear Type when category changes so user picks a valid one
                                commitUpdate(
                                    {
                                        id: item?.id ?? localItem?.id,
                                        'Category Item Type': newCat,
                                        Category: newCat,
                                        Type: '',
                                    },
                                    { reposition: false }
                                );
                            }}
                        >
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={row}>
                        <label style={label}>Type:</label>
                        <select
                            style={input}
                            value={localItem.Type || ''} // <-- keep record id string
                            onChange={(e) => handleFieldChange('Type', e.target.value)}
                        >
                            <option value="">Select Type</option>
                            {filteredTypes.map((t) => {
                                const id = getTypeId(t);
                                const name = getTypeName(t);
                                return (
                                    <option key={id} value={id}>
                                        {name}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div style={row}>
                        <label style={label}>Unit:</label>
                        <input
                            style={input}
                            type="text"
                            value={localItem['Unit'] || ''}
                            onChange={(e) => handleFieldChange('Unit', e.target.value)}
                        />
                    </div>

                    <div style={row}>
                        <label style={label}>Sub Unit:</label>
                        <input
                            style={input}
                            type="text"
                            value={localItem['SubUnit'] || ''}
                            onChange={(e) => handleFieldChange('SubUnit', e.target.value)}
                        />
                    </div>

                    <div style={row}>
                        <label style={label}>From Item:</label>
                        <input
                            style={input}
                            type="text"
                            value={localItem['from'] || ''}
                            onChange={(e) => handleFieldChange('from', e.target.value)}
                            placeholder="Source item ID / name"
                        />
                    </div>

                    <div style={row}>
                        <label style={label}>To Item:</label>
                        <input
                            style={input}
                            type="text"
                            value={localItem['to'] || ''}
                            onChange={(e) => handleFieldChange('to', e.target.value)}
                            placeholder="Target item ID / name"
                        />
                    </div>

                    <div style={row}>
                        <label style={label}>Edge ID:</label>
                        <input
                            style={input}
                            type="text"
                            value={localItem['edgeId'] || ''}
                            onChange={(e) => handleFieldChange('edgeId', e.target.value)}
                            placeholder="edge-xxx"
                        />
                    </div>
                </section>

                <section style={section}>
                    <h3 style={header}>Procurement Info</h3>

                    <div style={row}>
                        <label style={label}>Model Number:</label>
                        <input
                            style={input}
                            type="text"
                            value={localItem['Model Number'] || ''}
                            onChange={(e) => handleFieldChange('Model Number', e.target.value)}
                        />
                    </div>

                    <div style={row}>
                        <label style={label}>Manufacturer:</label>
                        <input
                            style={input}
                            type="text"
                            value={getSimpleLinkedValue(localItem['Manufacturer (from Technical Spec)'])}
                            onChange={(e) => handleFieldChange('Manufacturer (from Technical Spec)', e.target.value)}
                        />
                    </div>

                    <div style={row}>
                        <label style={label}>Supplier:</label>
                        <input
                            style={input}
                            type="text"
                            value={getSimpleLinkedValue(localItem['Supplier (from Technical Spec)'])}
                            onChange={(e) => handleFieldChange('Supplier (from Technical Spec)', e.target.value)}
                        />
                    </div>
                </section>
            </div>

            {onDeleteItem && (
                <div style={{ margin: 16, maxWidth: 350, textAlign: 'center' }}>
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
                        <button onClick={() => onUpdateEdge && onUpdateEdge(item.edgeId, { animated: !liveEdge.animated })}>
                            {liveEdge.animated ? 'Disable animation' : 'Enable animation'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <label style={{ width: 70 }}>Color</label>
                        <input
                            type="color"
                            value={(liveEdge.style && liveEdge.style.stroke) || '#000000'}
                            onChange={(e) =>
                                onUpdateEdge && onUpdateEdge(item.edgeId, { style: { ...(liveEdge.style || {}), stroke: e.target.value } })
                            }
                        />
                        <input
                            type="text"
                            value={(liveEdge.style && liveEdge.style.stroke) || ''}
                            onChange={(e) =>
                                onUpdateEdge && onUpdateEdge(item.edgeId, { style: { ...(liveEdge.style || {}), stroke: e.target.value } })
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
