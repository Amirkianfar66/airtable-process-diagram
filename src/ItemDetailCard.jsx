// src/components/ItemDetailCard.jsx
import React, { useEffect, useState, useRef, useMemo } from 'react';

// simple runtime cache for type id -> name
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

    // sync local when selected item id changes
    useEffect(() => {
        setLocalItem(item || {});
    }, [item?.id]);

    // fetch types (via your server endpoint)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch('/api/airtable/types');
                if (!mounted) return;
                if (!res.ok) {
                    console.error('Failed to fetch types', res.statusText);
                    return;
                }
                const json = await res.json();
                const types = Array.isArray(json?.types) ? json.types : [];
                setAllTypes(types);
                // warm cache
                types.forEach((t) => {
                    if (t?.id && t?.name) typeNameCache.set(t.id, t.name);
                });
            } catch (err) {
                console.error('Error fetching types:', err);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // derive type name
    const resolvedTypeName = useMemo(() => {
        const typeId = localItem?.Type;
        if (!typeId) return '-';
        return typeNameCache.get(typeId) || (allTypes.find((t) => t.id === typeId)?.name || 'Unknown');
    }, [localItem?.Type, allTypes]);

    // best-effort: infer edge/from/to for display (does not call onChange)
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

    // safe debounce -> onChange (and never send x/y)
    const commitUpdate = (delta = {}) => {
        if (!localItem?.id && !item?.id) return;
        const id = item?.id ?? localItem?.id;

        // never include x/y from the detail card
        const { x, y, ...rest } = delta || {};
        const payload = { id, ...rest };

        // optimistic local
        setLocalItem((prev) => ({ ...prev, ...rest }));

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            try {
                if (typeof onChange === 'function') onChange(payload);
            } catch (err) {
                console.error('[ItemDetailCard] onChange threw:', err, payload);
            } finally {
                debounceRef.current = null;
            }
        }, 400);
    };

    const handleFieldChange = (field, value) => {
        // ignore any attempts to set x/y from the panel
        if (field === 'x' || field === 'y') return;

        // Type is a single record id (string)
        if (field === 'Type') {
            commitUpdate({ Type: value || '' });
            return;
        }

        // Category updates both fields and clears Type
        if (field === 'Category') {
            commitUpdate({
                Category: value || '',
                'Category Item Type': value || '',
                Type: '', // reset Type so the user picks a valid one for the new category
            });
            return;
        }

        commitUpdate({ [field]: value });
    };

    if (!item) {
        return (
            <div style={{ padding: 20, color: '#888' }}>
                No item selected. Select a node or edge to view details.
            </div>
        );
    }

    const categories = ['Equipment', 'Instrument', 'Inline Valve', 'Pipe', 'Electrical'];
    const activeCategory =
        localItem['Category Item Type'] || localItem.Category || 'Equipment';

    const filteredTypes = useMemo(
        () => allTypes.filter((t) => t?.category === activeCategory),
        [allTypes, activeCategory]
    );

    const row = { display: 'flex', alignItems: 'center', marginBottom: 12 };
    const label = {
        width: 130,
        fontWeight: 600,
        color: '#444',
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
        color: '#222',
    };

    const liveEdge = item._edge || {};

    return (
        <>
            <div
                style={{
                    background: '#fff',
                    borderRadius: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: 20,
                    margin: 16,
                    maxWidth: 380,
                    fontFamily: 'ui-sans-serif, system-ui',
                }}
            >
                <section style={section}>
                    <h3 style={header}>General Info</h3>

                    <div style={row}>
                        <span style={label}>Code:</span>
                        <input
                            style={input}
                            type="text"
                            value={localItem['Item Code'] || ''}
                            onChange={(e) => handleFieldChange('Item Code', e.target.value)}
                        />
                    </div>

                    <div style={row}>
                        <span style={label}>Name:</span>
                        <input
                            style={input}
                            type="text"
                            value={localItem['Name'] || ''}
                            onChange={(e) => handleFieldChange('Name', e.target.value)}
                        />
                    </div>

                    <div style={row}>
                        <span style={label}>Category:</span>
                        <select
                            style={input}
                            value={activeCategory}
                            onChange={(e) => handleFieldChange('Category', e.target.value)}
                        >
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={row}>
                        <span style={label}>Type:</span>
                        <select
                            style={input}
                            value={localItem.Type || ''}
                            onChange={(e) => handleFieldChange('Type', e.target.value)}
                        >
                            <option value="">Select Type</option>
                            {filteredTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ ...row, fontSize: 12, color: '#666' }}>
                        <span style={{ ...label, width: 130, color: '#777' }}>Type label:</span>
                        <span style={{ flex: 1 }}>{resolvedTypeName}</span>
                    </div>

                    <div style={row}>
                        <span style={label}>Unit:</span>
                        <input
                            style={input}
                            type="text"
                            value={localItem['Unit'] || ''}
                            onChange={(e) => handleFieldChange('Unit', e.target.value)}
                        />
                    </div>

                    <div style={row}>
                        <span style={label}>Sub Unit:</span>
                        <input
                            style={input}
                            type="text}
              value={localItem['SubUnit'] || ''}
              onChange={(e) => handleFieldChange('SubUnit', e.target.value)}
            />
          </div>

          <div style={row}>
            <span style={label}>From Item:</span>
            <input
              style={input}
              type="text"
                        value={localItem['from'] || ''}
                        onChange={(e) => handleFieldChange('from', e.target.value)}
                        placeholder="Source item ID / name"
            />
                    </div>

                    <div style={row}>
                        <span style={label}>To Item:</span>
                        <input
                            style={input}
                            type="text"
                            value={localItem['to'] || ''}
                            onChange={(e) => handleFieldChange('to', e.target.value)}
                            placeholder="Target item ID / name"
                        />
                    </div>

                    <div style={row}>
                        <span style={label}>Edge ID:</span>
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
                        <span style={label}>Model Number:</span>
                        <input
                            style={input}
                            type="text"
                            value={localItem['Model Number'] || ''}
                            onChange={(e) => handleFieldChange('Model Number', e.target.value)}
                        />
                    </div>

                    <div style={row}>
                        <span style={label}>Manufacturer:</span>
                        <input
                            style={input}
                            type="text"
                            value={
                                Array.isArray(localItem['Manufacturer (from Technical Spec)'])
                                    ? localItem['Manufacturer (from Technical Spec)'].join(', ')
                                    : localItem['Manufacturer (from Technical Spec)'] || ''
                            }
                            onChange={(e) =>
                                handleFieldChange('Manufacturer (from Technical Spec)', e.target.value)
                            }
                        />
                    </div>

                    <div style={row}>
                        <span style={label}>Supplier:</span>
                        <input
                            style={input}
                            type="text"
                            value={
                                Array.isArray(localItem['Supplier (from Technical Spec)'])
                                    ? localItem['Supplier (from Technical Spec)'].join(', ')
                                    : localItem['Supplier (from Technical Spec)'] || ''
                            }
                            onChange={(e) =>
                                handleFieldChange('Supplier (from Technical Spec)', e.target.value)
                            }
                        />
                    </div>
                </section>
            </div>

            {onDeleteItem && (
                <div style={{ margin: '0 16px 16px 16px', maxWidth: 380, textAlign: 'center' }}>
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

            {/* Edge Controls (only if this panel is inspecting an edge) */}
            {item?._edge && (
                <div style={{ margin: '0 16px 16px 16px', maxWidth: 380 }}>
                    <h4 style={{ margin: '8px 0' }}>Edge Controls</h4>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input
                            style={{ flex: 1, padding: 8 }}
                            value={item._edge.label ?? ''}
                            placeholder="Edge label"
                            onChange={(e) =>
                                onUpdateEdge && onUpdateEdge(item.edgeId, { label: e.target.value })
                            }
                        />
                        <button
                            onClick={() =>
                                onUpdateEdge && onUpdateEdge(item.edgeId, { animated: !item._edge.animated })
                            }
                        >
                            {item._edge.animated ? 'Disable animation' : 'Enable animation'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 70 }}>Color</span>
                        <input
                            type="color"
                            value={(item._edge.style && item._edge.style.stroke) || '#000000'}
                            onChange={(e) =>
                                onUpdateEdge &&
                                onUpdateEdge(item.edgeId, {
                                    style: { ...(item._edge.style || {}), stroke: e.target.value },
                                })
                            }
                        />
                        <input
                            type="text"
                            value={(item._edge.style && item._edge.style.stroke) || ''}
                            onChange={(e) =>
                                onUpdateEdge &&
                                onUpdateEdge(item.edgeId, {
                                    style: { ...(item._edge.style || {}), stroke: e.target.value },
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

                    {onCreateInlineValve && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => onCreateInlineValve(item.edgeId)}
                                style={{
                                    background: '#1976d2',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '8px 12px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                }}
                            >
                                Create Inline Valve
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
