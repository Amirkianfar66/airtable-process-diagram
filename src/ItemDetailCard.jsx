// ItemDetailCard.js
import React from 'react';

export default function ItemDetailCard({ item }) {
    return (
        <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
            {/* General Info Section */}
            <section style={{ marginBottom: 20 }}>
                <h3>General Info</h3>
                <p><strong>Generated Code:</strong> {item.Code || ''}</p>
                <p><strong>Count:</strong> {item.Count || ''}</p>
                <p><strong>Category:</strong> {item.Category || ''}</p>
                <p><strong>Class Name:</strong> {item.ClassName || ''}</p>
                <p><strong>Type Name:</strong> {item.TypeName || ''}</p>
            </section>

            {/* Procurement Info Section */}
            <section style={{ marginBottom: 20 }}>
                <h3>Procurement Info</h3>
                <p><strong>Model Number:</strong> {item.ModelNumber || ''}</p>
                <p><strong>Size:</strong> {item.Size || ''}</p>
                <p><strong>Manufacturer:</strong> {item.Manufacturer || ''}</p>
                <p><strong>Supplier:</strong> {item.Supplier || ''}</p>
                <p><strong>Supplier Code:</strong> {item.SupplierCode || ''}</p>
            </section>

            {/* Engineering Info Section */}
            <section>
                <h3>Engineering Info</h3>
                {/* Placeholder for future engineering data */}
                <p>No engineering data available yet.</p>
            </section>
        </div>
    );
}
