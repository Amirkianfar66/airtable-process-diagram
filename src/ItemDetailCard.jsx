import React, { useState, useEffect } from 'react';

const typeCache = new Map();

export default function ItemDetailCard({ item }) {
    const [resolvedType, setResolvedType] = useState('');

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

                if (!res.ok) {
                    throw new Error(`Failed to fetch type name. Status: ${res.status}`);
                }

                const record = await res.json();

                // --- THIS IS THE LINE TO CHANGE ---
                // Replace 'Name' with the actual primary field name from your Airtable table.
                const typeName = record.fields.Name || 'Unknown Type';

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
        if (Array.isArray(field)) {
            return field.join(', ') || '-';
        }
        return field || '-';
    };

    if (!item) return null;

    return (
        <div style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            padding: '16px',
            maxWidth: '350px',
            fontFamily: 'sans-serif'
        }}>
            <section style={{ marginBottom: '16px' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>General Info</h3>
                <div><strong>Code:</strong> {item['Item Code'] || '-'}</div>
                <div><strong>Name:</strong> {item['Name'] || '-'}</div>
                <div><strong>Category:</strong> {getSimpleLinkedValue(item['Category Item Type'])}</div>
                <div><strong>Class Name:</strong> {item['Class Name'] || '-'}</div>
                <div><strong>Type:</strong> {resolvedType}</div>
                <div><strong>Count / Sequence:</strong> {item['Sequence'] || '-'}</div>
            </section>

            {/* Other sections remain the same */}
            <section style={{ marginBottom: '16px' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>Procurement Info</h3>
                <div><strong>Model Number:</strong> {item['Model Number'] || '-'}</div>
                <div><strong>Manufacturer:</strong> {getSimpleLinkedValue(item['Manufacturer'])}</div>
                <div><strong>Supplier:</strong> {getSimpleLinkedValue(item['Supplier'])}</div>
                <div><strong>Supplier Code:</strong> {item['Supplier Code'] || '-'}</div>
            </section>

            <section>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>Engineering Info</h3>
                <div><strong>Size:</strong> {item['Size'] || '-'}</div>
            </section>
        </div>
    );
}