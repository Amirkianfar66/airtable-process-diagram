// src/components/ItemDetailCard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

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
    const [allTypes, setAllTypes] = useState([]); // { id, name, category }[]
    const [isLoadingTypes, setIsLoadingTypes] = useState(false);
    const debounceRef = useRef(null);

    useEffect(() => {
        setLocalItem(item || {});
    }, [item?.id]);

    // Read-only: fetch Types (names) so UI shows labels
    useEffect(() => {
        const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
        const token = import.meta.env.VITE_AIRTABLE_TOKEN;
        const typesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;

        if (!baseId || !token || !typesTableId) {
            console.warn('[ItemDetailCard] Missing env vars for types table.');
            return;
        }

        let mounted = true;
        (async () => {
            try {
                setIsLoadingTypes(true);
                const res = await fetch(
                    `https://api.airtable.com/v0/${baseId}/${typesTableId}?pageSize=100`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (!res.ok) {
                    console.error('Failed to fetch types:', res.status, res.statusText);
                    return;
                }
                const data = await res.json();
                const list = (data.records || []).map((r) => ({
                    id: r.id,
                    name:
                        r.fields['Still Pipe'] ||
                        r.fields['Name'] ||
                        r.fields['Title'] ||
                        `Type ${r.id}`,
                    category: r.fields['Category'] || 'Equipment',
                }));
                if (mounted) setAllTypes(list);
            } catch (e) {
                console.error('Error fetching types:', e);
            } finally {
                if (mounted) setIsLoadingTypes(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Fallback single-record fetch to resolve id -> name (when needed)
    const fetchTypeNameById = async (typeId) => {
        if (!typeId) return '';
        if (typeNameCache.has(typeId)) return typeNameCache.get(typeId);

        const fromList = allTypes.find((t) => t.id === typeId)?.name;
        if (fromList) {
            typeNameCache.set(typeId, fromList);
            return fromList;
        }

        try {
            const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
            const token = import.meta.env.VITE_AIRTABLE_TOKEN;
            const typesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
            if (!baseId || !token || !typesTableId) return '';

            const res = await fetch(
                `https://api.airtable.com/v0/${baseId}/${typesTableId}/${typeId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
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
            console.error('fetchTypeNameById error', e);
            return '';
        }
    };

    // --------- derive id currently selected ----------
    const activeCategory =
        localItem['Category Item Type'] || localItem.Category || 'Equipment';

    const typesByCategory = useMemo(() => {
        const map = new Map();
        allTypes.forEach((t) => {
            if (!map.has(t.category)) map.set(t.category, []);
            map.get(t.category).push(t);
        });
        for (const [, arr] of map.entries()) {
            arr.sort((a, b) => a.name.localeCompare(b.name));
        }
        return map;
    }, [allTypes]);

    const typeOptions = typesByCategory.get(activeCategory) || [];

    const currentTypeId = useMemo(() => {
        const t = localItem?.Type;
        if (!t) return '';
        if (Array.isArray(t) && t.length > 0) return typeof t[0] === 'string' ? t[0] : '';
        if (typeof t === 'string' && t.startsWith('rec')) return t;
        if (typeof t === 'string') {
            // legacy string name -> map to id if possible
            const found = typeOptions.find((opt) => opt.name === t) || allTypes.find((opt) => opt.name === t);
            return found ? found.id : '';
        }
        return '';
    }, [localItem?.Type, typeOptions, allTypes]);

    // Ensure we also keep a readable TypeName alongside the id array
    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!currentTypeId) {
                if (!localItem?.TypeName) return;
                // if type cleared, clear the name too
                setLocalItem((prev) => ({ ...prev, TypeName: '' }));
                if (onChange) onChange({ ...(item || {}), TypeName: '' });
                return;
            }
            // if we already have the name and it matches the id, skip
            const already = localItem?.TypeName;
            const known = allTypes.find((t) => t.id === currentTypeId)?.name;
            const name = known || (await fetchTypeNameById(currentTypeId));
            if (!mounted) return;

            if (name && already !== name) {
                const patch = { TypeName: name };
                setLocalItem((prev) => ({ ...prev, ...patch }));
                if (onChange) onChange({ ...(item || {}), ...patch });
            }
        })();
        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTypeId, allTypes]);

    // --------- LOCAL-ONLY CHANGE PLUMBING (no writes) ----------
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
        }, 200);
    };

    const handleFieldChange = (fieldName, value) => {
        if ((fieldName === 'x' || fieldName === 'y') && value === '') {
            commitUpdate({ [fieldName]: '' });
            return;
        }

        if (fieldName === 'Type') {
            // value is the selected rec id; also include TypeName so icons can update immediately
            const selected = allTypes.find((t) => t.id === value);
            commitUpdate({
                Type: value ? [value] : [],
                TypeName: selected?.name || '',
            });
            return;
        }

        if (fieldName === 'Category Item Type' || fieldName === 'Category') {
            // reset type when category changes
            commitUpdate({
                'Category Item Type': value,
                Category: value,
                Type: [],
                TypeName: '',
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

                    {/* Optional read-only resolved name */}
                    {!!localItem.TypeName && (
                        <div style={{ ...rowStyle, color: '#666', fontSize: 12 }}>
                            <label style={labelStyle}>Type name:</label>
                            <div style={{ flex: 1 }}>{localItem.TypeName}</div>
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
                            value={(item._edge?.label ?? '')}
                            placeholder="Edge label"
                            onChange={(e) =>
                                onUpdateEdge && onUpdateEdge(item.edgeId, { label: e.target.value })
                            }
                        />
                        <button
                            onClick={() =>
                                onUpdateEdge && onUpdateEdge(item.edgeId, { animated: !item._edge?.animated })
                            }
                        >
                            {item._edge?.animated ? 'Disable animation' : 'Enable animation'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <label style={{ width: 70 }}>Color</label>
                        <input
                            type="color"
                            value={(item._edge?.style && item._edge.style.stroke) || '#000000'}
                            onChange={(e) =>
                                onUpdateEdge &&
                                onUpdateEdge(item.edgeId, {
                                    style: { ...(item._edge?.style || {}), stroke: e.target.value },
                                })
                            }
                        />
                        <input
                            type="text"
                            value={(item._edge?.style && item._edge.style.stroke) || ''}
                            onChange={(e) =>
                                onUpdateEdge &&
                                onUpdateEdge(item.edgeId, {
                                    style: { ...(item._edge?.style || {}), stroke: e.target.value },
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
