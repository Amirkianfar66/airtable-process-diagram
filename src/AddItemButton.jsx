// src/components/AddItemButton.jsx
import React from 'react';

export default function AddItemButton({
    addItem,
    defaultUnit = '',
    defaultSubUnit = '',
    onAdded, // optional callback fired after item is added
    label = 'Add Item',
}) {
    const handleAdd = async () => {
        console.log('[AddItemButton] clicked. addItem prop:', addItem);

        if (typeof addItem !== 'function') {
            console.error('[AddItemButton] addItem is not a function - cannot add item');
            return;
        }

        const rawItem = {
            Name: 'New Item',
            'Item Code': `CODE-${Date.now()}`,
            Unit: defaultUnit,
            SubUnit: defaultSubUnit,
            'Category Item Type': 'Equipment',
        };

        try {
            // support both sync and async addItem implementations
            const result = addItem(rawItem);
            const added = result instanceof Promise ? await result : result;

            console.log('[AddItemButton] addItem resolved:', added);

            if (typeof onAdded === 'function') {
                try { onAdded(added || rawItem); } catch (err) { console.warn('onAdded callback threw:', err); }
            }
        } catch (err) {
            console.error('[AddItemButton] addItem threw an error:', err);
        }
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
            aria-label={label}
        >
            {label}
        </button>
    );
}
