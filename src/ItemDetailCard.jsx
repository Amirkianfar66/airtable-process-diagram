import React, { useState, useEffect } from 'react';

// A cache to store fetched type names to avoid repeated API calls
const typeCache = new Map();

export default function ItemDetailCard({ item }) {
    // State to hold the resolved name of the 'Type' field
    const [resolvedType, setResolvedType] = useState('');

    useEffect(() => {
        // This function will run whenever the 'item' prop changes
        const fetchTypeName = async () => {
            if (!item || !item.Type || !Array.isArray(item.Type) || item.Type.length === 0) {
                setResolvedType('-'); // No type to resolve
                return;
            }

            const typeId = item.Type[0]; // e.g., 'rec4npyPo4LmsDYJ7'

            // 1. Check cache first
            if (typeCache.has(typeId)) {
                setResolvedType(typeCache.get(typeId));
                return;
            }

            // 2. If not in cache, show loading and fetch from API
            setResolvedType('Loading...');

            try {
                const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
                const token = import.meta.env.VITE_AIRTABLE_TOKEN;
                // You MUST add this new variable to your .env file.
                // It's the ID of the table where the types are stored (e.g., your "Overall" table)
                const typesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;

                const url = `https://api.airtable.com/v0/${baseId}/${typesTableId}/${typeId}`;

                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    throw new Error('Failed to fetch type name');
                }

                const record = await res.json();
                // Assuming the field you want to display is called 'Name'
                const typeName = record.fields.Name || 'Unknown Type';

                // Update state and cache
                setResolvedType(typeName);
                typeCache.set(typeId, typeName);

            } catch (error) {
                console.error("Error resolving Type ID:", error);
                setResolvedType(typeId); // Show the ID as a fallback on error
            }
        };

        fetchTypeName();
    }, [item]); // Dependency array ensures this runs when 'item' changes

    const getSimpleLinkedValue = (field) => {
        // This handles fields that are simple string arrays, like 'Category Item Type'
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
                {/* --- FIX APPLIED HERE --- */}
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