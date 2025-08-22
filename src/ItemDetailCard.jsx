// ===================== ItemDetailCard.jsx =====================
import React, { useEffect, useState } from 'react';

const typeCache = new Map();

export default function ItemDetailCard({ item, onChange }) {
    const [localItem, setLocalItem] = useState(item || {});

    // Sync local state with prop changes
    useEffect(() => {
        setLocalItem(item || {});
    }, [item]);

    const handleFieldChange = (fieldName, value) => {
        const updated = { ...localItem, [fieldName]: value };
        setLocalItem(updated);
        if (typeof onChange === 'function') onChange(updated);
    };

    if (!item) return null;

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
            <div style={{ marginBottom: '12px' }}>
                <label style={{ marginRight: '8px' }}>Code:</label>
                <input type="text" value={localItem.Code || ''} onChange={e => handleFieldChange('Code', e.target.value)} />
            </div>

            <div style={{ marginBottom: '12px' }}>
                <label style={{ marginRight: '8px' }}>Name:</label>
                <input type="text" value={localItem.Name || ''} onChange={e => handleFieldChange('Name', e.target.value)} />
            </div>

            <div style={{ marginBottom: '12px' }}>
                <label style={{ marginRight: '8px' }}>Category:</label>
                <select value={localItem.Category || 'Equipment'} onChange={e => handleFieldChange('Category', e.target.value)}>
                    <option>Equipment</option>
                    <option>Instrument</option>
                    <option>Inline Valve</option>
                    <option>Pipe</option>
                    <option>Electrical</option>
                </select>
            </div>
        </div>
    );
}
