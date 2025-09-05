import React, { useEffect, useMemo, useRef, useState } from 'react';

const typeCache = new Map();

// --- tolerant string helpers ---
const STOPWORDS = new Set(['valve', 'the', 'a', 'an', 'inline', 'item']);
const normalizeText = (s = '') =>
    String(s)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const tokenize = (s = '') =>
    normalizeText(s)
        .split(' ')
        .filter(Boolean)
        .filter(t => !STOPWORDS.has(t));

const tokenOverlapScore = (a = '', b = '') => {
    const A = new Set(tokenize(a));
    const B = new Set(tokenize(b));
    let common = 0;
    for (const t of A) if (B.has(t)) common++;
    const denom = Math.max(A.size, B.size, 1);
    return common / denom; // 0..1
};

const tokenDiff = (a = '', b = '') => {
    const A = new Set(tokenize(a));
    const B = new Set(tokenize(b));
    let extraA = 0,
        extraB = 0;
    for (const t of A) if (!B.has(t)) extraA++;
    for (const t of B) if (!A.has(t)) extraB++;
    return { total: extraA + extraB, extraA, extraB };
};

// find best type object by (tolerant) name
const findBestTypeByName = (name, list) => {
    if (!name || !Array.isArray(list) || !list.length) return null;

    const n = normalizeText(name);

    // exact match first
    const exact = list.find(t => normalizeText(t.name) === n);
    if (exact) return exact;

    // otherwise score by diff + overlap
    let best = null;
    let bestScore = -Infinity;
    for (const t of list) {
        const diff = tokenDiff(t.name, name);
        const overlap = tokenOverlapScore(t.name, name);
        // reward small diff, then overlap
        const score = (diff.total <= 1 ? 10 : 0) + overlap;
        if (score > bestScore) {
            bestScore = score;
            best = t;
        }
    }
    return best;
};

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

    const safeOnChange = (payload, options) => {
        if (typeof onChange !== 'function') return;
        try {
            onChange(payload, options);
        } catch (err) {
            console.error('[ItemDetailCard] onChange threw:', err);
        }
    };

    // keep local in sync when selection changes
    useEffect(() => {
        setLocalItem(item || {});
    }, [item?.id]);

    // GET types from Airtable "types" table (names + categories)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
                const token = import.meta.env.VITE_AIRTABLE_TOKEN;
                const typesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
                if (!baseId || !token || !typesTableId) return;

                const url = `https://api.airtable.com/v0/${baseId}/${typesTableId}`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                if (!mounted) return;
                const data = await res.json();

                const typesList = (data.records || []).map(r => ({
                    id: r.id,
                    name: r.fields['Still Pipe'],
                    category: r.fields['Category'] || 'Equipment',
                }));
                setAllTypes(typesList);
            } catch (err) {
                console.error('Failed to fetch types:', err);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // infer first connection → convenience fields
    useEffect(() => {
        if (!item || !edges || !Array.isArray(edges) || !items || !Array.isArray(items)) return;

        const firstConnId = item.Connections?.[0];
        if (!firstConnId) return;

        const edge = edges.find(e => e.id === firstConnId);
        if (!edge) return;

        const findItemById = id => items.find(it => it.id === id) || {};
        const fromItem = findItemById(edge.source);
        const toItem = findItemById(edge.target);

        setLocalItem(prev => ({
            ...prev,
            edgeId: edge.id,
            from: fromItem.Name ? `${fromItem.Name} (${edge.source})` : edge.source,
            to: toItem.Name ? `${toItem.Name} (${edge.target})` : edge.target,
        }));
    }, [item, edges, items]);

    // Debounced push to parent (local only; parent does not write to Airtable)
    const commitUpdate = (patch = {}, options = { reposition: false }) => {
        const authoritativeId = patch?.id ?? item?.id ?? localItem?.id;
        const payload = { ...localItem, ...patch, id: authoritativeId };

        setLocalItem(prev => ({ ...prev, ...patch }));

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            safeOnChange(payload, options);
            debounceRef.current = null;
        }, 350);
    };

    const handleFieldChange = (field, value, options) => {
        // numeric fields
        if ((field === 'x' || field === 'y') && (value === '' || Number.isNaN(value))) {
            setLocalItem(prev => ({ ...prev, [field]: '' }));
            return;
        }
        // Type changed from dropdown: store id array + friendly name
        if (field === 'Type') {
            const picked = allTypes.find(t => t.id === value);
            const next = {
                ...localItem,
                Type: value ? [value] : [],
                TypeName: picked?.name || '',
            };
            commitUpdate(next, options);
            return;
        }
        commitUpdate({ [field]: value }, options);
    };

    const categories = ['Equipment', 'Instrument', 'Inline Valve', 'Pipe', 'Electrical'];
    const activeCategory =
        localItem['Category Item Type'] || localItem.Category || 'Equipment';

    // types list for the active category
    const filteredTypes = useMemo(
        () => allTypes.filter(t => t.category === activeCategory),
        [allTypes, activeCategory]
    );

    // compute the selected <option> value (a rec id). Accepts:
    // - localItem.Type as [recId]
    // - localItem.Type as a plain string name coming from Items table
    // - localItem.TypeName as a friendly name
    const selectedTypeId = useMemo(() => {
        // already an id?
        if (Array.isArray(localItem?.Type) && localItem.Type[0]) return localItem.Type[0];

        // friendly name available?
        const byName =
            localItem?.TypeName ||
            (typeof localItem?.Type === 'string' ? localItem.Type : '');

        if (!byName) return '';

        // try category-filtered first, then fallback to all
        const firstTry = findBestTypeByName(byName, filteredTypes);
        if (firstTry) return firstTry.id;

        const anyTry = findBestTypeByName(byName, allTypes);
        return anyTry?.id || '';
    }, [localItem?.Type, localItem?.TypeName, filteredTypes, allTypes]);

    // simple linked display
    const getSimpleLinkedValue = field =>
        Array.isArray(field) ? field.join(', ') || '' : field || '';

    if (!item) {
        return (
            <div style={{ padding: 20, color: '#888' }}>
                No item selected. Select a node or edge to view details.
            </div>
        );
    }

    const row = { display: 'flex', alignItems: 'center', marginBottom: 12 };
    const label = { width: 130, fontWeight: 500, color: '#555', textAlign: 'right', marginRight: 12 };
    const input = { flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, outline: 'none', background: '#fafafa' };
    const section = { marginBottom: 24 };
    const header = { borderBottom: '1px solid #eee', paddingBottom: 6, marginBottom: 12, marginTop: 0, color: '#333' };

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
                    maxWidth: 360,
                    fontFamily: 'sans-serif',
                }}
            >
                <section style={section}>
                    <h3 style={header}>General Info</h3>

                    <div style={row}>
                        <label style={label}>Code:</label>
                        <input style={input} type="text" value={localItem['Item Code'] || ''} onChange={e => handleFieldChange('Item Code', e.target.value)} />
                    </div>

                    <div style={row}>
                        <label style={label}>Name:</label>
                        <input style={input} type="text" value={localItem['Name'] || ''} onChange={e => handleFieldChange('Name', e.target.value)} />
                    </div>

                    <div style={row}>
                        <label style={label}>Category:</label>
                        <select
                            style={input}
                            value={activeCategory}
                            onChange={e => {
                                const newCategory = e.target.value;
                                const updated = { ...localItem, 'Category Item Type': newCategory, Category: newCategory, Type: [], TypeName: '' };
                                commitUpdate(updated, { reposition: false });
                            }}
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div style={row}>
                        <label style={label}>Type:</label>
                        <select
                            style={input}
                            value={selectedTypeId}
                            onChange={e => handleFieldChange('Type', e.target.value)}
                        >
                            <option value="">Select Type</option>
                            {filteredTypes.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={row}>
                        <label style={label}>Unit:</label>
                        <input style={input} type="text" value={localItem['Unit'] || ''} onChange={e => handleFieldChange('Unit', e.target.value)} />
                    </div>

                    <div style={row}>
                        <label style={label}>Sub Unit:</label>
                        <input style={input} type="text" value={localItem['SubUnit'] || ''} onChange={e => handleFieldChange('SubUnit', e.target.value)} />
                    </div>

                    <div style={row}>
                        <label style={label}>From Item:</label>
                        <input style={input} type="text" value={localItem['from'] || ''} onChange={e => handleFieldChange('from', e.target.value)} placeholder="Source item ID / name" />
                    </div>

                    <div style={row}>
                        <label style={label}>To Item:</label>
                        <input style={input} type="text" value={localItem['to'] || ''} onChange={e => handleFieldChange('to', e.target.value)} placeholder="Target item ID / name" />
                    </div>

                    <div style={row}>
                        <label style={label}>Edge ID:</label>
                        <input style={input} type="text" value={localItem['edgeId'] || ''} onChange={e => handleFieldChange('edgeId', e.target.value)} placeholder="edge-xxx" />
                    </div>

                    <div style={row}>
                        <label style={label}>X Position:</label>
                        <input style={input} type="number" value={localItem['x'] ?? ''} onChange={e => handleFieldChange('x', e.target.value === '' ? '' : parseFloat(e.target.value))} />
                    </div>

                    <div style={row}>
                        <label style={label}>Y Position:</label>
                        <input style={input} type="number" value={localItem['y'] ?? ''} onChange={e => handleFieldChange('y', e.target.value === '' ? '' : parseFloat(e.target.value))} />
                    </div>
                </section>

                <section style={section}>
                    <h3 style={header}>Procurement Info</h3>

                    <div style={row}>
                        <label style={label}>Model Number:</label>
                        <input style={input} type="text" value={localItem['Model Number'] || ''} onChange={e => handleFieldChange('Model Number', e.target.value)} />
                    </div>

                    <div style={row}>
                        <label style={label}>Manufacturer:</label>
                        <input style={input} type="text" value={getSimpleLinkedValue(localItem['Manufacturer (from Technical Spec)'])} onChange={e => handleFieldChange('Manufacturer (from Technical Spec)', e.target.value)} />
                    </div>

                    <div style={row}>
                        <label style={label}>Supplier:</label>
                        <input style={input} type="text" value={getSimpleLinkedValue(localItem['Supplier (from Technical Spec)'])} onChange={e => handleFieldChange('Supplier (from Technical Spec)', e.target.value)} />
                    </div>
                </section>
            </div>

            {onDeleteItem && (
                <div style={{ margin: 16, maxWidth: 360, textAlign: 'center' }}>
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
                <div style={{ margin: '0 16px 16px 16px', maxWidth: 360 }}>
                    <h4 style={{ margin: '8px 0' }}>Edge controls</h4>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input
                            style={{ flex: 1, padding: 8 }}
                            value={liveEdge.label ?? ''}
                            placeholder="Edge label"
                            onChange={e => onUpdateEdge && onUpdateEdge(item.edgeId, { label: e.target.value })}
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
                            onChange={e => onUpdateEdge && onUpdateEdge(item.edgeId, { style: { ...(liveEdge.style || {}), stroke: e.target.value } })}
                        />
                        <input
                            type="text"
                            value={(liveEdge.style && liveEdge.style.stroke) || ''}
                            onChange={e => onUpdateEdge && onUpdateEdge(item.edgeId, { style: { ...(liveEdge.style || {}), stroke: e.target.value } })}
                            style={{ flex: 1, padding: 8 }}
                        />
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
