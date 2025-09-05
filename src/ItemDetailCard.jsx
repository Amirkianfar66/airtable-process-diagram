// src/components/ItemDetailCard.jsx
import React, { useEffect, useState, useMemo } from 'react';

export default function ItemDetailCard({
    item,
    items,
    edges,
    onChange,           // <- local-only change handler from ProcessDiagram
    onDeleteItem,
    onDeleteEdge,
    onUpdateEdge,
    onCreateInlineValve,
}) {
    const [localItem, setLocalItem] = useState(item || {});

    useEffect(() => {
        setLocalItem(item || {});
    }, [item?.id]); // reset when selection changes

    const isEdgeInspector = !!localItem.edgeId;

    const handleFieldChange = (key, value) => {
        setLocalItem((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        // Local-only: call back up to ProcessDiagram (no fetch, no alerts)
        if (typeof onChange === 'function') onChange(localItem);
    };

    // Optional: show connected edges for this item
    const connectedEdges = useMemo(() => {
        if (!item?.id || !Array.isArray(edges)) return [];
        return edges.filter((e) => e.source === item.id || e.target === item.id);
    }, [item?.id, edges]);

    const label = { fontWeight: 600, fontSize: 12, marginTop: 8 };
    const input = {
        width: '100%',
        padding: '6px 8px',
        border: '1px solid #ddd',
        borderRadius: 6,
        marginTop: 4,
    };

    return (
        <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Details</h3>
                {item?.id && (
                    <button
                        onClick={() => onDeleteItem?.(item.id)}
                        style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 6, border: '1px solid #e33' }}
                    >
                        Delete Item
                    </button>
                )}
            </div>

            {!isEdgeInspector && (
                <>
                    <div style={label}>Name</div>
                    <input
                        style={input}
                        type="text"
                        value={localItem.Name || ''}
                        onChange={(e) => handleFieldChange('Name', e.target.value)}
                        placeholder="Name"
                    />

                    <div style={label}>Item Code</div>
                    <input
                        style={input}
                        type="text"
                        value={localItem['Item Code'] ?? localItem.Code ?? ''}
                        onChange={(e) => {
                            const v = e.target.value;
                            handleFieldChange('Item Code', v);
                            handleFieldChange('Code', v);
                        }}
                        placeholder="Item Code"
                    />

                    <div style={label}>Unit</div>
                    <input
                        style={input}
                        type="text"
                        value={localItem.Unit || ''}
                        onChange={(e) => handleFieldChange('Unit', e.target.value)}
                        placeholder="Unit"
                    />

                    <div style={label}>SubUnit</div>
                    <input
                        style={input}
                        type="text"
                        value={localItem.SubUnit || localItem['Sub Unit'] || ''}
                        onChange={(e) => handleFieldChange('SubUnit', e.target.value)}
                        placeholder="SubUnit"
                    />

                    <div style={label}>Category</div>
                    <input
                        style={input}
                        type="text"
                        value={localItem.Category || localItem['Category Item Type'] || ''}
                        onChange={(e) => {
                            handleFieldChange('Category', e.target.value);
                            handleFieldChange('Category Item Type', e.target.value);
                        }}
                        placeholder="Category"
                    />

                    <div style={label}>Type</div>
                    <input
                        style={input}
                        type="text"
                        value={Array.isArray(localItem.Type) ? localItem.Type[0] : (localItem.Type || '')}
                        onChange={(e) => handleFieldChange('Type', e.target.value)}
                        placeholder="Type"
                    />

                    <div style={label}>Sequence</div>
                    <input
                        style={input}
                        type="number"
                        value={localItem.Sequence ?? 0}
                        onChange={(e) => handleFieldChange('Sequence', Number(e.target.value))}
                        placeholder="0"
                    />

                    <div style={{ marginTop: 12 }}>
                        <button onClick={handleSave} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc' }}>
                            Save (local)
                        </button>
                    </div>

                    {!!connectedEdges.length && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{ ...label, marginBottom: 8 }}>Connected Edges</div>
                            <ul style={{ margin: 0, paddingLeft: 16 }}>
                                {connectedEdges.map((e) => (
                                    <li key={e.id} style={{ marginBottom: 6 }}>
                                        {e.source} → {e.target}{' '}
                                        <button
                                            onClick={() => onDeleteEdge?.(e.id)}
                                            style={{ marginLeft: 8, padding: '2px 6px', borderRadius: 6, border: '1px solid #e33' }}
                                        >
                                            Delete Edge
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}

            {isEdgeInspector && (
                <>
                    <div style={{ background: '#f6f7f9', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                        <div style={{ fontSize: 12, marginBottom: 4 }}>Edge ID</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{localItem.edgeId}</div>
                    </div>

                    <div style={label}>From</div>
                    <input
                        style={input}
                        type="text"
                        value={localItem.from || ''}
                        onChange={(e) => handleFieldChange('from', e.target.value)}
                        placeholder="source node id"
                    />

                    <div style={label}>To</div>
                    <input
                        style={input}
                        type="text"
                        value={localItem.to || ''}
                        onChange={(e) => handleFieldChange('to', e.target.value)}
                        placeholder="target node id"
                    />

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button
                            onClick={() => onUpdateEdge?.(localItem.edgeId, { label: localItem['Item Code'] || localItem.Name || '' })}
                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc' }}
                        >
                            Update Edge Label
                        </button>

                        <button
                            onClick={() => onCreateInlineValve?.(localItem.edgeId)}
                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc' }}
                        >
                            Insert Inline Valve
                        </button>

                        <button
                            onClick={() => onDeleteEdge?.(localItem.edgeId)}
                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e33' }}
                        >
                            Delete Edge
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
