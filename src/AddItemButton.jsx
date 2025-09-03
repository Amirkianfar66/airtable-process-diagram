// src/components/AddItemButton.jsx
import React from 'react';

export default function AddItemButton({ addItem }) {
    const handleAdd = () => {
        console.log('[AddItemButton] clicked. addItem prop:', addItem);
        if (typeof addItem !== 'function') {
            console.error('[AddItemButton] addItem is not a function - cannot add item');
            return;
        }

        addItem({
            Name: 'New Item',
            'Item Code': `CODE-${Date.now()}`,
            Unit: '',
            SubUnit: '',
            'Category Item Type': 'Equipment',
        });
    };

    return (
        <button
            onClick={handleAdd}
            style={{
                padding: '8px 16px',
                margin: '10px',
                background: '#4CAF50',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
            }}
        >
            Add Item
        </button>
    );
}
