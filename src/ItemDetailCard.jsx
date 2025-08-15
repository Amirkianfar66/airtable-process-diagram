import React from 'react';

export default function ItemDetailCard({ item }) {
    if (!item) return null;

    const getLinkedValue = (field) => {
        // If the field is an array of objects (expanded linked records), show their 'Name' or a specific property
        if (Array.isArray(field)) {
            return field.map(f => f.Name || f.name || f).join(', ');
        }
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
                <div><strong>Category:</strong> {item['Category Item Type'] || '-'}</div>
                <div><strong>Class Name:</strong> {item['Class Name'] || '-'}</div>
                <div><strong>Type:</strong> {getLinkedValue(item['Type'])}</div>
                <div><strong>Count / Sequence:</strong> {item['Sequence'] || '-'}</div>
            </section>

            {/* Procurement Info */}
            <section style={{ marginBottom: '16px' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>Procurement Info</h3>
                <div><strong>Model Number:</strong> {item['Model Number'] || '-'}</div>
                <div><strong>Manufacturer:</strong> {item['Manufacturer'] || '-'}</div>
                <div><strong>Supplier:</strong> {item['Supplier'] || '-'}</div>
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
