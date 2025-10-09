// ItemDetailCard.jsx (rewritten with 2s debounce + ND/ID/OD + inline valve type)
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
    const [isTypeFocused, setIsTypeFocused] = useState(false);

    const DEBUG_SYNC = true;
    const normalizeTypeKey = (s) =>
        (s || "")
            .toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_-]/g, "");

    // after the useState hooks
    const currentCategory = useMemo(() => {
        const raw = localItem?.['Category Item Type'] ?? localItem?.Category ?? '';
        const val = Array.isArray(raw) ? raw[0] : raw;
        return (val ?? '').toString().trim() || 'Equipment';
    }, [localItem]);

    const filteredTypes = allTypes.filter(t => t.category === currentCategory);


    // Debounce timer to delay writes to parent/canvas
    const debounceRef = useRef(null);

    const safeOnChange = (payload, options) => {
        if (typeof onChange !== 'function') return;
        try {
            onChange(payload, options);
        } catch (err) {
            console.error('[safeOnChange] onChange threw:', err);
            try {
                console.log('[safeOnChange] payload:', payload);
                console.log('[safeOnChange] options:', options);
            } catch { }
        }
    };

    // --- Delete by keyboard (Delete / Backspace) — ignore when typing in inputs
    useEffect(() => {
        const handleKeyDown = (e) => {
            const tag = (e.target?.tagName || '').toLowerCase();
            const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
            if (typing) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (item?.id && typeof onDeleteItem === 'function') {
                    onDeleteItem(item.id);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [item?.id, onDeleteItem]);

    // Only update localItem when the selected item's id changes
    useEffect(() => {
        setLocalItem(item || {});
        if (debounceRef.current) clearTimeout(debounceRef.current);
    }, [item?.id]);

    // Fetch Equipment + Inline Valve Types from Airtable
    useEffect(() => {
        let alive = true;
        const fetchTypes = async () => {
            try {
                const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
                const token = import.meta.env.VITE_AIRTABLE_TOKEN;
                const equipTypesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
                const valveTypesTableId = import.meta.env.VITE_AIRTABLE_ValveTYPES_TABLE_ID;
                const agentTypesTableId = import.meta.env.VITE_AIRTABLE_AGENT_TYPES_TABLE_ID;

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

                if (alive) setAllTypes(typesList);
            } catch (err) {
                console.error('Error fetching types:', err);
            }
        };
        fetchTypes();
        return () => { alive = false; };
    }, []);


    // Helper: rec id?
    const isRecId = (s) => typeof s === "string" && s.startsWith("rec");

    // Resolved table name (encode so "Table 13" works)
    const itemsTableRaw =
        import.meta.env.VITE_AIRTABLE_TABLE_ID ||
        import.meta.env.VITE_AIRTABLE_ITEMS_TABLE_ID ||
        "Table 13";
    const itemsTable = encodeURIComponent(itemsTableRaw);

    // Pick a readable name from an Airtable record's fields
    const deriveNameFromFields = (fields = {}) => {
        const candidates = ["Name", "Type", "Type Name", "Title", "Label", "Still Pipe", "Display Name"];
        for (const k of candidates) {
            const v = fields[k];
            if (typeof v === "string" && v.trim()) return v.trim();
            if (Array.isArray(v) && v.length && typeof v[0] === "string") return String(v[0]).trim();
        }
        // fallback: first non-empty string-ish field
        for (const v of Object.values(fields)) {
            if (typeof v === "string" && v.trim()) return v.trim();
            if (Array.isArray(v) && v.length && typeof v[0] === "string") return String(v[0]).trim();
        }
        return "";
    };

    // Map a linked-record id (rec...) to its display name using allTypes or a one-off fetch
    const getTypeName = async (val) => {
        if (!isRecId(val)) return String(val ?? "");
        const hit = (allTypes || []).find((t) => t.id === val);
        if (hit?.name) return hit.name;
        const fetched = await fetchTypeNameById(val);
        return fetched || ""; // return empty if unresolved (don't fabricate "Unknown")
    };
    const withVisualBump = (obj) => ({
        ...obj,
        __iconRev: Date.now(),   // lives next to Type under the same object
    });



    // One-shot pull from Airtable; set force=true to ignore isTypeFocused
    const refreshRemoteType = async (force = false) => {
        const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
        const token = import.meta.env.VITE_AIRTABLE_TOKEN;
        if (!baseId || !token || !itemsTableRaw) {
            console.warn("[Type sync] Missing envs", { baseId: !!baseId, token: !!token, itemsTableRaw });
            return;
        }

        if (!force && isTypeFocused) return;

        const idOrCode = item?.id || localItem?.id || localItem?.["Item Code"] || "";
        if (!idOrCode) return;

        try {
            let rec = null;

            if (isRecId(idOrCode)) {
                // direct record endpoint
                const url = `https://api.airtable.com/v0/${baseId}/${itemsTable}/${idOrCode}?cellFormat=string`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) {
                    console.warn("[Type sync] /record fetch failed", res.status, await res.text());
                    return;
                }
                rec = await res.json();
            } else {
                // fall back: find by Item Code / Code / Name
                const clauses = [];
                if (idOrCode) clauses.push(`{Item Code}='${idOrCode}'`, `{Code}='${idOrCode}'`);
                if (localItem?.Name) clauses.push(`{Name}='${String(localItem.Name).replace(/'/g, "\\'")}'`);
                const formula = `OR(${clauses.join(",")})`;
                const url = `https://api.airtable.com/v0/${baseId}/${itemsTable}?maxRecords=1&cellFormat=string&filterByFormula=${encodeURIComponent(formula)}`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) {
                    console.warn("[Type sync] /list fetch failed", res.status, await res.text());
                    return;
                }
                const data = await res.json();
                rec = data.records?.[0];
                if (!rec) {
                    console.warn("[Type sync] No matching record found for", { idOrCode, name: localItem?.Name });
                    return;
                }
            }

            const f = rec?.fields || {};

            // 1) Find the actual Type field name dynamically
            const pickTypeField = (fields) => {
                const candidates = [
                    "Type",
                    "Type Name",
                    "Item Type",
                    "ItemType",
                    "Type (from Types)",
                    "Type (from Agent)",
                ];
                for (const k of candidates) if (k in fields) return k;
                // Fallback: first key that includes "type" and is not empty
                return Object.keys(fields).find((k) => /type/i.test(k) && fields[k] != null && fields[k] !== "");
            };

            const typeKey = pickTypeField(f);
            if (!typeKey) {
                if (DEBUG_SYNC) console.warn("[Type sync] No type-like field found. Available keys:", Object.keys(f));
                return;
            }

            // 2) Normalize to a single value then resolve any rec... to a display name
            const remoteRaw = f[typeKey];
            const remoteType0 = Array.isArray(remoteRaw) ? remoteRaw[0] : remoteRaw;
            const remoteType = await getTypeName(remoteType0); // ← always a name or ""
            if (!remoteType) return; // don't write unknowns


            const optionValue = (t) => t?.value ?? t?.name ?? String(t ?? "");


            // 3) Try to infer category for this type (so the select options contain it)
            const match = (allTypes || []).find((t) => optionValue(t) === remoteType);
            const inferredCat = match?.category;

            // 4) Write state (update Category too if needed)
            const idForUpdate = item?.id ?? localItem?.id;
            if (inferredCat && inferredCat !== (localItem?.["Category Item Type"] || localItem?.Category)) {
                const updated = { ...(localItem || {}), id: idForUpdate, "Category Item Type": inferredCat, Category: inferredCat, Type: remoteType };
                commitUpdate(withVisualBump(updated), { reposition: false, immediate: true });
            } else if (remoteType && remoteType !== (localItem?.Type ?? "")) {
                const updated = {
                    ...(localItem || {}),
                    id: idForUpdate,
                    /* Category updates if any ... */
                    Type: remoteType,
                    TypeKey: normalizeTypeKey(remoteType),
                };
                commitUpdate(withVisualBump(updated), { reposition: false, immediate: true });

            }


            if (DEBUG_SYNC) {
                console.log("[Type sync] typeKey:", typeKey, "remoteType:", remoteType, "inferredCat:", inferredCat);
            }

        } catch (err) {
            console.warn("[Type sync] error", err);
        }
    };

    useEffect(() => {
        (async () => {
            const v = localItem?.Type;
            if (isRecId(v)) {
                const name = await getTypeName(v);
                if (name && name !== v) {
                    // Update UI only; don't push upstream here
                    setLocalItem(prev => ({ ...(prev || {}), Type: name }));
                }
            }
        })();
    }, [localItem?.Type, allTypes, currentCategory]);


    useEffect(() => {
        let t;
        // initial pull
        refreshRemoteType(false);
        // poll every 5s
        t = setInterval(() => refreshRemoteType(false), 5000);
        return () => clearInterval(t);
        // rebind if item or env changes
    }, [item?.id, localItem?.id, isTypeFocused, itemsTable]);



    const fetchTypeNameById = async (typeId) => {
        if (!typeId) return "";
        if (typeCache.has(typeId)) {
            const cached = typeCache.get(typeId);
            if (cached) return cached;           // only return truthy names
        }

        const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
        const token = import.meta.env.VITE_AIRTABLE_TOKEN;
        const equipTypesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
        const valveTypesTableId = import.meta.env.VITE_AIRTABLE_ValveTYPES_TABLE_ID;

        const tryTable = async (tableId) => {
            if (!tableId) return "";
            try {
                const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${typeId}?cellFormat=string`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) return "";
                const record = await res.json();
                return deriveNameFromFields(record.fields);
            } catch {
                return "";
            }
        };

        // Prefer your main types table, then fall back
        let name = await tryTable(equipTypesTableId);
        if (!name) name = await tryTable(valveTypesTableId);

        if (name) typeCache.set(typeId, name); // cache ONLY real names
        return name;                            // may be ""
    };


    // Resolve Type label if item.Type is an Airtable record id
    // Edge → Item: mirror inlineValveType from ANY connected edge into this inline valve item
    useEffect(() => {
        if (!item) return;

        // Only for inline valve items
        const isInlineValve =
            (localItem?.['Category Item Type'] || localItem?.Category) === 'Inline Valve';
        if (!isInlineValve) return;

        // Find any connected edge carrying inlineValveType
        const connected = Array.isArray(edges)
            ? edges.filter(e => e.source === item.id || e.target === item.id)
            : [];

        const withType = connected.find(e => e?.data?.inlineValveType);
        const inlineType = withType?.data?.inlineValveType || '';

        if (!inlineType) return;

        // If panel shows a different value, update it and persist (debounced)
        if ((localItem?.Type || '') !== inlineType) {
            setLocalItem(prev => ({ ...prev, Type: inlineType }));
            const upd = { ...(localItem || {}), id: item?.id ?? localItem?.id, Type: inlineType };
            commitUpdate(withVisualBump(upd), { reposition: false, immediate: true });
        }

    }, [edges, item?.id, localItem?.['Category Item Type'], localItem?.Category]);


    // When an item has a first connection, surface basic edge context in the panel
    // Item → Edge(s): if user changes Type in this panel, push it to all connected edges
    useEffect(() => {
        if (!item || typeof onUpdateEdge !== 'function') return;

        const isInlineValve =
            (localItem?.['Category Item Type'] || localItem?.Category) === 'Inline Valve';
        if (!isInlineValve) return;

        const desiredType = localItem?.Type || '';

        const connected = Array.isArray(edges)
            ? edges.filter(e => e.source === item.id || e.target === item.id)
            : [];

        connected.forEach(edge => {
            const cur = edge?.data?.inlineValveType || '';
            if (desiredType && desiredType !== cur) {
                onUpdateEdge(edge.id, {
                    data: { ...(edge.data || {}), inlineValveType: desiredType },
                });
            }
        });
    }, [localItem?.Type, localItem?.['Category Item Type'], localItem?.Category, item?.id, edges, onUpdateEdge]);


    // Commit with 2s debounce to avoid live-updating canvas while typing
    const commitUpdate = (updatedObj = {}, options = { reposition: false, immediate: false }) => {
        const authoritativeId =
            updatedObj?.id ?? item?.id ?? localItem?.id;

        const chosenX = typeof updatedObj?.x === 'number' ? updatedObj.x
            : typeof localItem?.x === 'number' ? localItem.x
                : typeof item?.x === 'number' ? item.x
                    : undefined;

        const chosenY = typeof updatedObj?.y === 'number' ? updatedObj.y
            : typeof localItem?.y === 'number' ? localItem.y
                : typeof item?.y === 'number' ? item.y
                    : undefined;

        const payload = { ...updatedObj, id: authoritativeId };

        if (!options.reposition) {
            if (typeof chosenX === 'number') payload.x = Number(chosenX);
            if (typeof chosenY === 'number') payload.y = Number(chosenY);
        }

        // update local panel immediately
        setLocalItem(prev => ({ ...prev, ...updatedObj }));

        if (options.reposition) payload._repositionRequest = true;

        if (debounceRef.current) clearTimeout(debounceRef.current);

        const run = () => {
            safeOnChange(payload, options);
            debounceRef.current = null;
        };

        if (options.immediate) {
            run();
        } else {
            debounceRef.current = setTimeout(run, 2000);
        }
        // If Type is present, also compute a normalized TypeKey the icons can use
        if (Object.prototype.hasOwnProperty.call(updatedObj, "Type")) {
            updatedObj.TypeKey = normalizeTypeKey(updatedObj.Type);
        }

    };

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);
    
    // 2) Item → Edge: if user changes Type in the right tab for an inline valve item,
    //    keep the connected edge's inlineValveType in sync.
    useEffect(() => {
        if (!item?.edgeId || typeof onUpdateEdge !== 'function') return;
        const edge = Array.isArray(edges) ? edges.find(e => e.id === item.edgeId) : null;
        if (!edge) return;

        const isInlineValve =
            (localItem?.['Category Item Type'] || localItem?.Category) === 'Inline Valve';

        if (!isInlineValve) return;

        const currentEdgeType = edge.data?.inlineValveType || '';
        const desiredType = localItem?.Type || '';

        if (desiredType && desiredType !== currentEdgeType) {
            onUpdateEdge && onUpdateEdge(item.edgeId || liveEdge.id, {
                data: { ...(edge.data || {}), inlineValveType: desiredType },
            });
        }
    }, [localItem?.Type, localItem?.['Category Item Type'], localItem?.Category, item?.edgeId, edges, onUpdateEdge]);

    // Avoid auto-forcing reposition for Unit/SubUnit
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
    const typesForSelectedCategory = allTypes.filter(
        (t) => t.category === currentCategory
          );

    // For Edge inspector: list only Inline Valve types
    const inlineValveTypes = allTypes.filter((t) => t.category === 'Inline Valve');

    const rowStyle = { display: 'flex', alignItems: 'center', marginBottom: '12px' };
    const labelStyle = { width: '130px', fontWeight: 500, color: '#555', textAlign: 'right', marginRight: '12px' };
    const inputStyle = { flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', outline: 'none', background: '#fafafa' };
    const sectionStyle = { marginBottom: '24px' };
    const headerStyle = { borderBottom: '1px solid #eee', paddingBottom: '6px', marginBottom: '12px', marginTop: 0, color: '#333' };

    const liveEdge = item._edge || {};

    // Helper to parse number fields safely
    const parseNum = (val) => {
        if (val === '' || val === null || typeof val === 'undefined') return '';
        const n = Number(val);
        return Number.isFinite(n) ? n : '';
        // (If you want to clamp or prevent negatives, add logic here)
    };

    const optionValue = (t) => t.value ?? t.name ?? String(t);
    const typeOptions = typesForSelectedCategory || [];
    const needsTempOption =
         Boolean(localItem.Type) &&
         localItem.Type !== "Unknown Type" &&
         !typeOptions.some((t) => optionValue(t) === localItem.Type);

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
                            value={currentCategory}
                            onChange={(e) => {
                                const newCategory = e.target.value;
                                const updated = {
                                    ...localItem,
                                    'Category Item Type': newCategory,
                                    Category: newCategory,
                                    Type: '',
                                };
                                commitUpdate(updated, { reposition: false });
                            }}
                        >
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>

                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Type:</label>
                        <select
                            style={inputStyle}
                            value={localItem.Type || ''}
                            onChange={(e) => handleFieldChange('Type', e.target.value)}
                            onFocus={() => setIsTypeFocused(true)}
                            onBlur={() => setIsTypeFocused(false)}
                        >
                            <option value="">Select Type</option>
                            {needsTempOption && (
                                <option value={localItem.Type}>• {localItem.Type} (from Airtable)</option>
                            )}

                            {typeOptions.map((t) => (
                                <option
                                    key={(t.value ?? t.id ?? t.name ?? String(t))}
                                    value={(t.value ?? t.name ?? String(t))}
                                >
                                    {t.label ?? t.name ?? String(t)}
                                </option>
                            ))}

                        </select>
                        <button
                            style={{ marginLeft: 8, padding: "6px 10px", borderRadius: 6 }}
                            title="Sync from Airtable"
                            onClick={() => refreshRemoteType(true)}
                        >
                            ↻
                        </button>
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
                            onChange={(e) => handleFieldChange('x', parseNum(e.target.value))}
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Y Position:</label>
                        <input
                            style={inputStyle}
                            type="number"
                            value={localItem['y'] ?? ''}
                            onChange={(e) => handleFieldChange('y', parseNum(e.target.value))}
                        />
                    </div>

                    {/* Dimensional parameters */}
                    <div style={{ ...rowStyle, marginTop: 8 }}>
                        <label style={labelStyle}>ND:</label>
                        <input
                            style={inputStyle}
                            type="number"
                            value={localItem['ND'] ?? ''}
                            onChange={(e) => handleFieldChange('ND', parseNum(e.target.value))}
                            placeholder="Nominal Diameter"
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>ID:</label>
                        <input
                            style={inputStyle}
                            type="number"
                            value={localItem['ID'] ?? ''}
                            onChange={(e) => handleFieldChange('ID', parseNum(e.target.value))}
                            placeholder="Inner Diameter"
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>OD:</label>
                        <input
                            style={inputStyle}
                            type="number"
                            value={localItem['OD'] ?? ''}
                            onChange={(e) => handleFieldChange('OD', parseNum(e.target.value))}
                            placeholder="Outer Diameter"
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
                            onChange={(e) => handleFieldChange('Manufacturer (from Technical Spec)', e.target.value)}
                        />
                    </div>

                    <div style={rowStyle}>
                        <label style={labelStyle}>Supplier:</label>
                        <input
                            style={inputStyle}
                            type="text"
                            value={getSimpleLinkedValue(localItem['Supplier (from Technical Spec)'])}
                            onChange={(e) => handleFieldChange('Supplier (from Technical Spec)', e.target.value)}
                        />
                    </div>
                </section>
            </div>

            {item?._edge && (
                <div style={{ margin: '0 16px 16px 16px', maxWidth: 350 }}>
                    <h4 style={{ margin: '8px 0' }}>Edge controls</h4>

                    {/* CATEGORY area with Inline Valve Type selector */}
                    <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>CATEGORY</div>
                        <div style={rowStyle}>
                            <label style={labelStyle}>Inline Valve Type:</label>
                            <select
                                style={inputStyle}
                                value={liveEdge?.data?.inlineValveType || ''}
                                onChange={(e) =>
                                    onUpdateEdge &&
                                    onUpdateEdge(item.edgeId || liveEdge.id, {
                                        data: { ...(liveEdge.data || {}), inlineValveType: e.target.value },
                                    })
                                }
                            >
                                <option value="">Select type…</option>
                                {inlineValveTypes.map((t) => (
                                    <option key={t.id} value={t.name}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input
                            style={{ flex: 1, padding: 8 }}
                            value={liveEdge.label ?? ''}
                            placeholder="Edge label"
                            onChange={(e) => onUpdateEdge && onUpdateEdge(item.edgeId || liveEdge.id, { label: e.target.value })}
                        />

                            <button onClick={() => onUpdateEdge && onUpdateEdge(item.edgeId || liveEdge.id, { animated: !liveEdge.animated })}>
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
                        <input
                            type="color"
                            value={(liveEdge.style && liveEdge.style.stroke) || '#000000'}
                            onChange={(e) =>
                                onUpdateEdge && onUpdateEdge(item.edgeId || liveEdge.id, { style: { ...(liveEdge.style || {}), stroke: e.target.value } })
                            }
                        />
                        <input
                            type="text"
                            value={(liveEdge.style && liveEdge.style.stroke) || ''}
                            onChange={(e) =>
                                onUpdateEdge &&
                                onUpdateEdge(item.edgeId || liveEdge.id, { style: { ...(liveEdge.style || {}), stroke: e.target.value } })
                            }
                            style={{ flex: 1, padding: 8 }}
                        />
                        {(item?.edgeId || liveEdge?.id) && onDeleteEdge && (
                               <button onClick={() => onDeleteEdge(item.edgeId || liveEdge.id)}
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
