import React, { useState, useEffect } from 'react';

const typeCache = new Map();

export default function ItemDetailCard({ item, onChange }) {
    const [localItem, setLocalItem] = useState(item || {});
    const [resolvedType, setResolvedType] = useState('');

    useEffect(() => {
        setLocalItem(item || {});
    }, [item]);

    // Resolve linked "Type" name (like before)
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
        if (onChange) onChange(updatedItem); // send update to parent
    };

    if (!item) return null;

    const categories = ['Equipment', 'Instrument', 'Inline Valve', 'Pipe', 'Electrical'];

    return (
        <div style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            padding: '16px',
            margin: '16px',
            maxWidth: '350px',
            fontFamily: 'sans-serif'
        }}>
            <section style={{ marginBottom: '16px' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px', marginTop: 0 }}>General Info</h3>
                <div><strong>Code:</strong> <input type="text" value={localItem['Item Code'] || ''} onChange={e => handleFieldChange('Item Code', e.target.value)} /></div>
                <div><strong>Name:</strong> <input type="text" value={localItem['Name'] || ''} onChange={e => handleFieldChange('Name', e.target.value)} /></div>
                <div>
                    <strong>Category:</strong>{' '}
                    <select value={localItem['Category Item Type'] || 'Equipment'} onChange={e => handleFieldChange('Category Item Type', e.target.value)}>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                <div><strong>Class Name:</strong> <input type="text" value={localItem['Class Name'] || ''} onChange={e => handleFieldChange('Class Name', e.target.value)} /></div>
                <div><strong>Type:</strong> {resolvedType}</div>
                <div><strong>Count / Sequence:</strong> <input type="number" value={localItem['Sequence'] || 0} onChange={e => handleFieldChange('Sequence', e.target.value)} /></div>
            </section>

            <section style={{ marginBottom: '16px' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>Procurement Info</h3>
                <div><strong>Model Number:</strong> <input type="text" value={localItem['Model Number'] || ''} onChange={e => handleFieldChange('Model Number', e.target.value)} /></div>
                <div><strong>Manufacturer:</strong> <input type="text" value={getSimpleLinkedValue(localItem['Manufacturer (from Technical Spec)'])} onChange={e => handleFieldChange('Manufacturer (from Technical Spec)', e.target.value)} /></div>
                <div><strong>Supplier:</strong> <input type="text" value={getSimpleLinkedValue(localItem['Supplier (from Technical Spec)'])} onChange={e => handleFieldChange('Supplier (from Technical Spec)', e.target.value)} /></div>
                <div><strong>Supplier Code:</strong> <input type="text" value={localItem['Supplier Code'] || ''} onChange={e => handleFieldChange('Supplier Code', e.target.value)} /></div>
            </section>

            <section>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>Engineering Info</h3>
                <div><strong>Size:</strong> <input type="text" value={localItem['Size'] || ''} onChange={e => handleFieldChange('Size', e.target.value)} /></div>
            </section>
        </div>
    );
}
