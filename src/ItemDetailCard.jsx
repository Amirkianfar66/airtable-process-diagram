import React, { useState, useEffect } from 'react';

const typeCache = new Map();

export default function ItemDetailCard({ item, onChange }) {
    const [localItem, setLocalItem] = useState(item || {});
    const [resolvedType, setResolvedType] = useState('');
    const [allTypes, setAllTypes] = useState([]);

    // Update local state when item changes
    useEffect(() => {
        setLocalItem(item || {});
    }, [item]);

    // Fetch all types from Airtable for dropdown
    useEffect(() => {
        const fetchTypes = async () => {
            try {
                const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
                const token = import.meta.env.VITE_AIRTABLE_TOKEN;
                const typesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
                if (!typesTableId) return;

                const res = await fetch(`https://api.airtable.com/v0/${baseId}/${typesTableId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                // Normalize types: include Category field
                const typesList = data.records.map(r => ({
                    id: r.id,
                    name: r.fields['Still Pipe'],
                    category: r.fields['Category'] || 'Equipment'
                }));
                setAllTypes(typesList);
            } catch (err) {
                console.error("Error fetching types:", err);
            }
        };
        fetchTypes();
    }, []);

    // Resolve linked "Type" name for display
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
                    setResolvedType(typeId);
                }
            };
            fetchTypeName();
        } else {
            setResolvedType(item.Type);
        }
    }, [item]);

    const handleFieldChange = (fieldName, value) => {
        const updated = { ...localItem, [fieldName]: value };
        setLocalItem(updated);
        if (onChange) onChange(updated); // propagate to parent (updates icon)
    };

    const getSimpleLinkedValue = (field) => (Array.isArray(field) ? field.join(', ') || '-' : field || '-');

    if (!item) return null;

    const categories = ['Equipment', 'Instrument', 'Inline Valve', 'Pipe', 'Electrical'];

    // Filter types based on selected category
    const filteredTypes = allTypes.filter(t => t.category === (localItem['Category Item Type'] || 'Equipment'));

    const rowStyle = { display: 'flex', alignItems: 'center', marginBottom: '12px' };
    const labelStyle = { width: '130px', fontWeight: 500, color: '#555', textAlign: 'right', marginRight: '12px' };
    const inputStyle = { flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', outline: 'none', background: '#fafafa' };
    const sectionStyle = { marginBottom: '24px' };
    const headerStyle = { borderBottom: '1px solid #eee', paddingBottom: '6px', marginBottom: '12px', marginTop: 0, color: '#333' };

    return (
        <div style={{
            background: '#fff',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            padding: '20px',
            margin: '16px',
            maxWidth: '350px',
            fontFamily: 'sans-serif'
        }}>
            <section style={sectionStyle}>
                <h3 style={headerStyle}>General Info</h3>

                <div style={rowStyle}>
                    <label style={labelStyle}>Code:</label>
                    <input style={inputStyle} type="text" value={localItem['Item Code'] || ''} onChange={e => handleFieldChange('Item Code', e.target.value)} />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Name:</label>
                    <input style={inputStyle} type="text" value={localItem['Name'] || ''} onChange={e => handleFieldChange('Name', e.target.value)} />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Category:</label>
                    <select
                        style={inputStyle}
                        value={localItem['Category Item Type'] || 'Equipment'}
                        onChange={e => {
                            const newCategory = e.target.value;
                            const updated = {
                                ...localItem,
                                'Category Item Type': newCategory,
                                Category: newCategory, // normalize for IconManager
                                Type: '', // reset Type
                            };
                            setLocalItem(updated);
                            if (onChange) onChange(updated); // propagate single, complete object
                        }}
                    >

                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Type:</label>
                    <select
                        style={inputStyle}
                        value={localItem.Type || ''}
                        onChange={e => handleFieldChange('Type', e.target.value)}
                    >
                        <option value="">Select Type</option>
                        {filteredTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Unit:</label>
                    <input style={inputStyle} type="text" value={localItem['Unit'] || ''} onChange={e => handleFieldChange('Unit', e.target.value)} />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Sub Unit:</label>
                    <input style={inputStyle} type="text" value={localItem['SubUnit'] || ''} onChange={e => handleFieldChange('SubUnit', e.target.value)} />
                </div>
            </section>

            <section style={sectionStyle}>
                <h3 style={headerStyle}>Procurement Info</h3>

                <div style={rowStyle}>
                    <label style={labelStyle}>Model Number:</label>
                    <input style={inputStyle} type="text" value={localItem['Model Number'] || ''} onChange={e => handleFieldChange('Model Number', e.target.value)} />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Manufacturer:</label>
                    <input style={inputStyle} type="text" value={getSimpleLinkedValue(localItem['Manufacturer (from Technical Spec)'])} onChange={e => handleFieldChange('Manufacturer (from Technical Spec)', e.target.value)} />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Supplier:</label>
                    <input style={inputStyle} type="text" value={getSimpleLinkedValue(localItem['Supplier (from Technical Spec)'])} onChange={e => handleFieldChange('Supplier (from Technical Spec)', e.target.value)} />
                </div>
            </section>
        </div>
    );
}
