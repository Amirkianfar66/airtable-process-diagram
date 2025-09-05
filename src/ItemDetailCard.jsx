// src/components/ItemDetailCard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

// tiny cache for single-record lookups (fallbacks)
const typeNameCache = new Map();

export default function ItemDetailCard({
    item,
    onChange,
    items = [],
    edges = [],
    onDeleteEdge,
    onUpdateEdge,
    onCreateInlineValve,  // retained in case you call it elsewhere
    onDeleteItem,
}) {
    const [localItem, setLocalItem] = useState(item || {});
    const [allTypes, setAllTypes] = useState([]); // { id, name, category }[]
    const [isLoadingTypes, setIsLoadingTypes] = useState(false);
    const debounceRef = useRef(null);

    // keep local state in sync when selection changes
    useEffect(() => {
        setLocalItem(item || {});
    }, [item?.id]);

    // ---------- LOAD TYPES (READ-ONLY; NO WRITES) ----------
    // This pulls type records from your Types table so we can show names instead of rec IDs.
    useEffect(() => {
        const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
        const token = import.meta.env.VITE_AIRTABLE_TOKEN;
        const typesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID; // <- IMPORTANT

        if (!baseId || !token || !typesTableId) {
            console.warn(
                '[ItemDetailCard] Missing env vars. Set VITE_AIRTABLE_BASE_ID, VITE_AIRTABLE_TOKEN, VITE_AIRTABLE_TYPES_TABLE_ID.'
            );
            return;
        }

        let isMounted = true;
        const load = async () => {
            try {
                setIsLoadingTypes(true);
                const url = `https://api.airtable.com/v0/${baseId}/${typesTableId}?pageSize=100`;
                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                    console.error('[ItemDetailCard] Failed to fetch types:', res.status, res.statusText);
                    return;
                }
                const data = await res.json();
                const list = (data.records || []).map((r) => ({
                    id: r.id,
                    // Use your real name field; your example used "Still Pipe"
                    name:
                        r.fields['Still Pipe'] ||
                        r.fields['Name'] ||
                        r.fields['Title'] ||
                        `Type ${r.id}`,
                    category: r.fields['Category'] || 'Equipment',
                }));
                if (isMounted) setAllTypes(list);
            } catch (err) {
                console.error('[ItemDetailCard] Error loading types:', err);
            } finally {
                if (isMounted) setIsLoadingTypes(false);
            }
        };

        load();
        return () => {
            isMounted = false;
        };
    }, []);

    // ---------- FALLBACK: resolve a type id -> name if not in allTypes ----------
    const fetchTypeNameById = async (typeId) => {
        if (!typeId) return '';
        if (typeNameCache.has(typeId)) return typeNameCache.get(typeId);

        // try list first
        const found = allTypes.find((t) => t.id === typeId);
        if (found) {
            typeNameCache.set(typeId, found.name);
            return found.name;
        }

        // fallback: fetch single record (read-only)
        try {
            const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
            const token = import.meta.env.VITE_AIRTABLE_TOKEN;
            const typesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
            if (!baseId || !token || !typesTableId) return '';

            const url = `https://api.airtable.com/v0/${baseId}/${typesTableId}/${typeId}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) return '';
            const record = await res.json();
            const name =
                record?.fields?.['Still Pipe'] ||
                record?.fields?.['Name'] ||
                record?.fields?.['Title'] ||
                '';
            if (name) typeNameCache.set(typeId, name);
            return name;
        } catch (e) {
            console.error('[ItemDetailCard] fetchTypeNameById error', e);
            return '';
        }
    };

    // Build a category -> list of type objects map for the dropdown
    const typesByCategory = useMemo(() => {
        const map = new Map();
        allTypes.forEach((t) => {
            if (!map.has(t.category)) map.set(t.category, []);
            map.get(t.category).push(t);
        });
        for (const [cat, arr] of map.entries()) {
            arr.sort((a, b) => a.name.localeCompare(b.name));
        }
        return map;
    }, [allTypes]);

    // Derive the currently selected category
    const activeCategory =
        localItem['Category Item Type'] ||
        localItem.Category ||
        'Equipment';

    // Types for the current category
    const typeOptions = typesByCategory.get(activeCategory) || [];

    // Normalize a value that could be "recXXX" (id), array of ids, or a plain name -> to an id
    const currentTypeId = useMemo(() => {
        const t = localItem?.Type;
        if (!t) return '';

        // If it's an array (Airtable linked format), take the first id
        if (Array.isArray(t) && t.length > 0) {
            return typeof t[0] === 'string' ? t[0] : '';
        }

        // If it's already a rec id
        if (typeof t === 'string' && t.startsWith('rec')) {
            return t;
        }

        // Otherwise it's probably a name; resolve name -> id from current options
        if (typeof t === 'string') {
            const found = typeOptions.find((opt) => opt.name === t) || allTypes.find((opt) => opt.name === t);
            return found ? found.id : '';
        }

        return '';
    }, [localItem?.Type, typeOptions, allTypes]);

    // For read-only display of the current type name (optional)
    const [resolvedTypeName, setResolvedTypeName] = useState('');
    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!currentTypeId) {
                setResolvedTypeName('');
                return;
            }
            const fromList = allTypes.find((t) => t.id === currentTypeId)?.name;
            if (fromList) {
                setResolvedTypeName(fromList);
                return;
            }
            const name = await fetchTypeNameById(currentTypeId);
            if (mounted) setResolvedTypeName(name);
        })();
        return () => {
            mounted = false;
        };
    }, [currentTypeId, allTypes]);

    // sync first connection into localItem (for from/to display)
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

    // ---------- change plumbing (local only; no network writes) ----------
    const safeOnChange = (payload) => {
        if (typeof onChange !== 'function') return;
        try {
            onChange(payload);
        } catch (e) {
            console.error('[ItemDetailCard] onChange error:', e, payload);
        }
    };

    const commitUpdate = (updated) => {
        setLocalItem((prev) => ({ ...prev, ...updated }));
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            safeOnChange({ ...(item || {}), ...(updated || {}) });
            debounceRef.current = null;
        }, 300);
    };

    const handleFieldChange = (fieldName, value) => {
        // x/y inputs: keep empty string when cleared
        if ((fieldName === 'x' || fieldName === 'y') && value === '') {
            commitUpdate({ [fieldName]: '' });
            return;
        }

        // Type selection: store as an array of ids to match Airtable schema (even though we don't write)
        if (fieldName === 'Type') {
            const next = value ? [value] : [];
            commitUpdate({ Type: next });
            return;
        }

        // Category change -> also clear Type
        if (fieldName === 'Category Item Type' || fieldName === 'Category') {
            commitUpdate({
                'Category Item Type': value,
                Category: value,
                Type: [],
            });
            return;
        }

        commitUpdate({ [fieldName]: value });
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

    const rowStyle = { display: 'flex', alignItems: 'center', marginBottom: '12px' };
    const labelStyle = { width: '130px', fontWeight: 500, color: '#555', textAlign: 'right', marginRight: '12px' };
    const inputStyle = { flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', outline: 'none', background: '#fafafa' };
    const sectionStyle = { marginBottom: '24px' };
    const headerStyle = { borderBottom: '1px solid #eee', paddingBottom: '6px', marginBottom: '12px', marginTop: 0, color: '#333' };

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
                            onChange={(e) => handleFieldChange('Category Item Type', e.target.value)}
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
                            value={currentTypeId}
                            onChange={(e) => handleFieldChange('Type', e.target.value)}
                            disabled={isLoadingTypes}
                        >
                            <option value="">{isLoadingTypes ? 'Loading types...' : 'Select Type'}</option>
                            {typeOptions.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Optional read-only resolved name display */}
                    {currentTypeId && (
                        <div style={{ ...rowStyle, color: '#666', fontSize: 12 }}>
                            <label style={labelStyle}>Type name:</label>
                            <div style={{ flex: 1 }}>{resolvedTypeName || '—'}</div>
                        </div>
                    )}

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
