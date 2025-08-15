import React from 'react';

export default function AddItemButton({ addItem }) {
  const handleClick = () => {
    const newItem = {
      id: `item-${Date.now()}`,
      Code: 'NEW001',
      Name: 'New Item',
      Category: 'Equipment',
      Unit: 'Unit 1',
      SubUnit: 'Sub 1',
    };
    addItem(newItem);
  };

  return (
    <button
      onClick={handleClick}
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
