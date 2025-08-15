import React, { useState, useEffect } from 'react';

// A simple in-memory cache to store fetched type names.
// This prevents making the same API call repeatedly if you click the same items.
const typeCache = new Map();

export default function ItemDetailCard({ item }) {
    // State to hold the resolved, human-readable name of the 'Type' field.
    const [resolvedType, setResolvedType] = useState('');

    // This is for debugging: Log the data passed from the parent component.
    // Check your browser's console when you click a node.
    console.log("Data passed to ItemDetailCard:", item);

    useEffect(() => {
        // This function runs whenever the 'item' prop changes.
        const fetchTypeName = async () => {
            // Check if the 'Type' field exists and is in the expected format.
            if (!item || !item.Type || !Array.isArray(item.Type) || item.Type.length === 0) {
                setResolvedType('-'); // Set a default value if there's no type.
                return;
            }

            const typeId = item.Type[0]; // Get the record ID, e.g., 'rec4npyPo4LmsDYJ7'

            // 1. Check the cache first to avoid unnecessary API calls.
            if (typeCache.has(typeId)) {
                setResolvedType(typeCache.get(typeId));
                return;
            }

            // 2. If not in cache, show a loading state and fetch from the API.
            setResolvedType('Loading...');

            try {
                // Read credentials from .env file.
                const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
                const token = import.meta.env.VITE_AIRTABLE_TOKEN;
                const typesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;

                // Safety check for the environment variable.
                if (!typesTableId) {
                    throw new Error("VITE_AIRTABLE_TYPES_TABLE_ID is not defined in your .env file.");
                }

                // Construct the specific URL to fetch a single record by its ID.
                const url = `https://api.airtable.com/v0/${baseId}/${typesTableId}/${typeId}`;

                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    throw new Error(`Failed to fetch type name. Status: ${res.status}`);
                }

                const record = await res.json();

                // This is for debugging: Log the raw response for the "Type" lookup.
                // Check the console to see the structure of the returned record.
                console.log("Resolved Type record from API:", record);

                // Extract the value from the 'Type' field of the returned record.
                // This is the line we corrected in the last step.
                const typeName = record.fields.Type || 'Unknown Type';

                // Update the state with the fetched name and add it to the cache.
                setResolvedType(typeName);
                typeCache.set(typeId, typeName);

            } catch (error) {
                console.error("Error resolving Type ID:", error);
                setResolvedType(typeId); // On error, show the ID as a fallback.
            }
        };

        fetchTypeName();
    }, [item]); // The dependency array ensures this effect runs only when the 'item' prop changes.

    // Helper function for simple linked fields that are returned as an array of strings.
    const getSimpleLinkedValue = (field) => {
        if (Array.isArray(field)) {
            return field.join(', ') || '-';
        }
        return field || '-';
    };

    // Don't render anything if no item is selected.
    if (!item) return null;

    return (
        <div style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            padding: '16px',
            margin: '16px', // Added margin for better spacing
            maxWidth: '350px',
            fontFamily: 'sans-serif'
        }}>
            {/* General Info Section */}
            <section style={{ marginBottom: '16px' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px', marginTop: 0 }}>General Info</h3>
                <div><strong>Code:</strong> {item['Item Code'] || '-'}</div>
                <div><strong>Name:</strong> {item['Name'] || '-'}</div>
                <div><strong>Category:</strong> {getSimpleLinkedValue(item['Category Item Type'])}</div>
                <div><strong>Class Name:</strong> {item['Class Name'] || '-'}</div>
                <div><strong>Type:</strong> {resolvedType}</div>
                <div><strong>Count / Sequence:</strong> {item['Sequence'] || '-'}</div>
            </section>

            {/* Procurement Info Section */}
            <section style={{ marginBottom: '16px' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>Procurement Info</h3>
                <div><strong>Model Number:</strong> {item['Model Number'] || '-'}</div>
                <div><strong>Manufacturer:</strong> {getSimpleLinkedValue(item['Manufacturer'])}</div>
                <div><strong>Supplier:</strong> {getSimpleLinkedValue(item['Supplier'])}</div>
                <div><strong>Supplier Code:</strong> {item['Supplier Code'] || '-'}</div>
            </section>

            {/* Engineering Info Section */}
            <section>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>Engineering Info</h3>
                <div><strong>Size:</strong> {item['Size'] || '-'}</div>
            </section>
        </div>
    );
}