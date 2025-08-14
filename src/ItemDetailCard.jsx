import React from 'react';

export default function ItemDetailCard({ item }) {
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
      {/* General Info */}
      <section style={{ marginBottom: '16px' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>General Info</h3>
        <div><strong>Code:</strong> {item['Item Code'] || '-'}</div>
        <div><strong>Name:</strong> {item['Name'] || '-'}</div>
        <div><strong>Unit:</strong> {item['Unit'] || '-'}</div>
        <div><strong>Sub-Unit:</strong> {item['Sub Unit'] || '-'}</div>
        <div><strong>Category:</strong> {item['Category Item Type'] || '-'}</div>
        <div><strong>Sequence:</strong> {item['Sequence'] || '-'}</div>
      </section>

      {/* Manufacturer Info */}
      <section style={{ marginBottom: '16px' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>Manufacturer Info</h3>
        <div><strong>Manufacturer:</strong> {item['Manufacturer'] || '-'}</div>
        <div><strong>Model Number:</strong> {item['Model Number'] || '-'}</div>
      </section>

      {/* Supplier Info */}
      <section>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>Supplier Info</h3>
        <div><strong>Supplier:</strong> {item['Supplier'] || '-'}</div>
        <div><strong>Supplier Code:</strong> {item['Supplier Code'] || '-'}</div>
      </section>
    </div>
  );
}
