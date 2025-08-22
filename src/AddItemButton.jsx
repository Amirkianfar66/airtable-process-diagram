// ===================== File: src/components/AddItemButton.jsx =====================
import React from 'react';

export default function AddItemButton({ addItem }) {
    const handleAdd = () => {
        // call parent handler which normalizes fields and auto-selects
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
