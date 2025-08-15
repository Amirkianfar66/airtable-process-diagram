import React from 'react';

export default function ItemDetailCard({ item }) {
    if (!item) return null;

    // --- MODIFICATION ---
    // This helper function now cleanly handles arrays of strings (the default for linked records)
    // or arrays of objects (if you ever expand them in the future).
    const getLinkedValue = (field) => {
        if (Array.isArray(field) && field.length > 0) {
            // Map over the array and join the values with a comma.
            // This works whether the array contains strings like ['Equipment']
            // or objects like [{Name: 'Value'}].
            return field.map(value => {
                if (typeof value === 'object' && value !== null) {
                    return value.Name || value.name; // For expanded records
                }
                return value; // For simple string arrays
            }).join(', ');
        }
        // If it's not an array, return it directly.
        return field || '-';
    };

    return (
        <div style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            padding: '16px',
            maxWidth: '350px',
            fontFamily: 'sans-serif'
        }}>
            {/* General Info */}
            <section style={{ marginBottom: '16px' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>General Info</h3>
                <div><strong>Code:</strong> {item['Item Code'] || '-'}</div>
                <div><strong>Name:</strong> {item['Name'] || '-'}</div>
                {/* --- FIX APPLIED HERE --- */}
                <div><strong>Category:</strong> {getLinkedValue(item['Category Item Type'])}</div>
                <div><strong>Class Name:</strong> {item['Class Name'] || '-'}</div>
                <div><strong>Type:</strong> {getLinkedValue(item['Type'])}</div>
                <div><strong>Count / Sequence:</strong> {item['Sequence'] || '-'}</div>
            </section>

            {/* Procurement Info */}
            <section style={{ marginBottom: '16px' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>Procurement Info</h3>
                <div><strong>Model Number:</strong> {item['Model Number'] || '-'}</div>
                <div><strong>Manufacturer:</strong> {getLinkedValue(item['Manufacturer'])}</div>
                <div><strong>Supplier:</strong> {getLinkedValue(item['Supplier'])}</div>
                <div><strong>Supplier Code:</strong> {item['Supplier Code'] || '-'}</div>
            </section>

            {/* Engineering Info */}
            <section>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>Engineering Info</h3>
                <div><strong>Size:</strong> {item['Size'] || '-'}</div>
            </section>
        </div>
    );
}