import React, { useState, useEffect } from 'react';

const typeCache = new Map();

export default function ItemDetailCard({ item, onChange }) {
    const [resolvedType, setResolvedType] = useState('');
    const [localItem, setLocalItem] = useState(item);

    useEffect(() => setLocalItem(item), [item]);

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

                if (!typesTableId) {
                    throw new Error("VITE_AIRTABLE_TYPES_TABLE_ID is not defined in your .env file.");
                }

                const url = `https://api.airtable.com/v0/${baseId}/${typesTableId}/${typeId}`;
                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });

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

    const getSimpleLinkedValue = (field) => {
        if (Array.isArray(field)) return field.join(', ') || '-';
        return field || '-';
    };

    if (!localItem) return null;

    const isEditable = !item.id.startsWith('rec'); // Airtable IDs start with "rec", new items are editable

    const handleFieldChange = (field, value) => {
        const updated = { ...localItem, [field]: value };
        setLocalItem(updated);
        if (onChange) onChange(updated);
    };

    const renderField = (label, fieldName) => (
        <div style={{ marginBottom: 6 }}>
            <strong>{label}:</strong>{' '}
            {isEditable ? (
                <input
                    style={{ width: '100%', padding: 4, fontSize: 14 }}
                    value={localItem[fieldName] || ''}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                />
            ) : (
                <span>{getSimpleLinkedValue(localItem[fieldName])}</span>
            )}
        </div>
    );

    return (
        <div style={{
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            padding: 16,
            margin: 16,
            maxWidth: 350,
            fontFamily: 'sans-serif'
        }}>
            <section style={{ marginBottom: 16 }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 4, marginBottom: 8, marginTop: 0 }}>General Info</h3>
                {renderField('Code', 'Item Code')}
                {renderField('Name', 'Name')}
                {renderField('Category', 'Category Item Type')}
                {renderField('Class Name', 'Class Name')}
                {!isEditable && <div><strong>Type:</strong> {resolvedType}</div>}
                {renderField('Count / Sequence', 'Sequence')}
            </section>

            <section style={{ marginBottom: 16 }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 4, marginBottom: 8 }}>Procurement Info</h3>
                {renderField('Model Number', 'Model Number')}
                {renderField('Manufacturer', 'Manufacturer (from Technical Spec)')}
                {renderField('Supplier', 'Supplier (from Technical Spec)')}
                {renderField('Supplier Code', 'Supplier Code')}
            </section>

            <section>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 4, marginBottom: 8 }}>Engineering Info</h3>
                {renderField('Size', 'Size')}
            </section>
        </div>
    );
}
