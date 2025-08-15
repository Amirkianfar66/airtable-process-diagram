import React, { useState, useEffect } from 'react';

const typeCache = new Map();

export default function ItemDetailCard({ item, onChange }) {
    const [localItem, setLocalItem] = useState(item || {});
    const [resolvedType, setResolvedType] = useState('');

    useEffect(() => {
        setLocalItem(item || {});
    }, [item]);

    useEffect(() => {
        const fetchTypeName = async () => {
            if (!item || !item.Type || !Array.isArray(item.Type) || item.Type.length === 0) {
                setResolvedType('-');
                return;
            }

            const typeId = item.Type[0];

            if (typeCache.has(typeId)) {
                setResolvedType(typeCache.get(typeId));
                return;
            }

            setResolvedType('Loading...');

            try {
                const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
                const token = import.meta.env.VITE_AIRTABLE_TOKEN;
                const typesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
                if (!typesTableId) throw new Error("VITE_AIRTABLE_TYPES_TABLE_ID is not defined");

                const url = `https://api.airtable.com/v0/${baseId}/${typesTableId}/${typeId}`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) throw new Error(`Failed to fetch type name. Status: ${res.status}`);
                const record = await res.json();
                const typeName = record.fields['Still Pipe'] || 'Unknown Type';

                setResolvedType(typeName);
                typeCache.set(typeId, typeName);
            } catch (error) {
                console.error("Error resolving Type ID:", error);
                setResolvedType(typeId);
            }
        };
        fetchTypeName();
    }, [item]);

    const getSimpleLinkedValue = (field) => (Array.isArray(field) ? field.join(', ') || '-' : field || '-');

    const handleFieldChange = (field, value) => {
        const updatedItem = { ...localItem, [field]: value };
        setLocalItem(updatedItem);
        if (onChange) onChange(updatedItem);
    };

    if (!item) return null;

    const categories = ['Equipment', 'Instrument', 'Inline Valve', 'Pipe', 'Electrical'];

    const sectionStyle = { marginBottom: '20px' };
    const sectionTitleStyle = { fontSize: '14px', fontWeight: 600, color: '#444', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '6px' };
    const rowStyle = { display: 'flex', alignItems: 'center', marginBottom: '10px' };
    const labelStyle = { width: '120px', fontWeight: 500, color: '#555' };
    const inputStyle = { flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', outline: 'none', transition: 'border 0.2s', background: '#fafafa' };

    return (
        <div style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            padding: '20px',
            margin: '16px',
            maxWidth: '360px',
            fontFamily: 'Arial, sans-serif'
        }}>
            {/* General Info */}
            <section style={sectionStyle}>
                <h3 style={sectionTitleStyle}>General Info</h3>
                <div style={rowStyle}><span style={labelStyle}>Code:</span><input type="text" style={inputStyle} value={localItem['Item Code'] || ''} onChange={e => handleFieldChange('Item Code', e.target.value)} /></div>
                <div style={rowStyle}><span style={labelStyle}>Name:</span><input type="text" style={inputStyle} value={localItem['Name'] || ''} onChange={e => handleFieldChange('Name', e.target.value)} /></div>
                <div style={rowStyle}>
                    <span style={labelStyle}>Category:</span>
                    <select style={inputStyle} value={localItem['Category Item Type'] || 'Equipment'} onChange={e => handleFieldChange('Category Item Type', e.target.value)}>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                <div style={rowStyle}><span style={labelStyle}>Unit:</span><input type="text" style={inputStyle} value={localItem['Unit'] || ''} onChange={e => handleFieldChange('Unit', e.target.value)} /></div>
                <div style={rowStyle}><span style={labelStyle}>Sub Unit:</span><input type="text" style={inputStyle} value={localItem['SubUnit'] || localItem['Sub Unit'] || ''} onChange={e => handleFieldChange('SubUnit', e.target.value)} /></div>
                <div style={rowStyle}><span style={labelStyle}>Class Name:</span><input type="text" style={inputStyle} value={localItem['Class Name'] || ''} onChange={e => handleFieldChange('Class Name', e.target.value)} /></div>
                <div style={rowStyle}><span style={labelStyle}>Type:</span><span>{resolvedType}</span></div>
                <div style={rowStyle}><span style={labelStyle}>Count / Sequence:</span><input type="number" style={inputStyle} value={localItem['Sequence'] || 0} onChange={e => handleFieldChange('Sequence', e.target.value)} /></div>
            </section>

            {/* Procurement Info */}
            <section style={sectionStyle}>
                <h3 style={sectionTitleStyle}>Procurement Info</h3>
                <div style={rowStyle}><span style={labelStyle}>Model Number:</span><input type="text" style={inputStyle} value={localItem['Model Number'] || ''} onChange={e => handleFieldChange('Model Number', e.target.value)} /></div>
                <div style={rowStyle}><span style={labelStyle}>Manufacturer:</span><input type="text" style={inputStyle} value={getSimpleLinkedValue(localItem['Manufacturer (from Technical Spec)'])} onChange={e => handleFieldChange('Manufacturer (from Technical Spec)', e.target.value)} /></div>
                <div style={rowStyle}><span style={labelStyle}>Supplier:</span><input type="text" style={inputStyle} value={getSimpleLinkedValue(localItem['Supplier (from Technical Spec)'])} onChange={e => handleFieldChange('Supplier (from Technical Spec)', e.target.value)} /></div>
                <div style={rowStyle}><span style={labelStyle}>Supplier Code:</span><input type="text" style={inputStyle} value={localItem['Supplier Code'] || ''} onChange={e => handleFieldChange('Supplier Code', e.target.value)} /></div>
            </section>

            {/* Engineering Info */}
            <section style={sectionStyle}>
                <h3 style={sectionTitleStyle}>Engineering Info</h3>
                <div style={rowStyle}><span style={labelStyle}>Size:</span><input type="text" style={inputStyle} value={localItem['Size'] || ''} onChange={e => handleFieldChange('Size', e.target.value)} /></div>
            </section>
        </div>
    );
}
