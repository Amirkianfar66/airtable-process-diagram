import React, { useState } from 'react';

export default function AddItemButton({ addItem }) {
    const [showForm, setShowForm] = useState(false);
    const [newItem, setNewItem] = useState({
        Code: '',
        Name: '',
        Category: 'Equipment',
        Unit: '',
        SubUnit: '',
    });

    const handleSubmit = () => {
        if (!newItem.Code || !newItem.Name || !newItem.Unit || !newItem.SubUnit) {
            alert('Please fill all fields');
            return;
        }
        addItem({
            ...newItem,
            id: `item-${Date.now()}`,
        });
        setShowForm(false);
        setNewItem({ Code: '', Name: '', Category: 'Equipment', Unit: '', SubUnit: '' });
    };

    return (
        <div>
            <button
                onClick={() => setShowForm(true)}
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

            {showForm && (
                <div style={{
                    position: 'absolute',
                    top: 50,
                    left: 50,
                    background: '#fff',
                    padding: 20,
                    borderRadius: 8,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                }}>
                    <h4>New Item</h4>
                    <input
                        type="text"
                        placeholder="Item Code"
                        value={newItem.Code}
                        onChange={(e) => setNewItem({ ...newItem, Code: e.target.value })}
                        style={{ marginBottom: 10, width: '100%' }}
                    />
                    <input
                        type="text"
                        placeholder="Item Name"
                        value={newItem.Name}
                        onChange={(e) => setNewItem({ ...newItem, Name: e.target.value })}
                        style={{ marginBottom: 10, width: '100%' }}
                    />
                    <select
                        value={newItem.Category}
                        onChange={(e) => setNewItem({ ...newItem, Category: e.target.value })}
                        style={{ marginBottom: 10, width: '100%' }}
                    >
                        <option value="Equipment">Equipment</option>
                        <option value="Instrument">Instrument</option>
                        <option value="Inline Valve">Inline Valve</option>
                        <option value="Pipe">Pipe</option>
                        <option value="Electrical">Electrical</option>
                    </select>
                    <input
                        type="text"
                        placeholder="Unit"
                        value={newItem.Unit}
                        onChange={(e) => setNewItem({ ...newItem, Unit: e.target.value })}
                        style={{ marginBottom: 10, width: '100%' }}
                    />
                    <input
                        type="text"
                        placeholder="SubUnit"
                        value={newItem.SubUnit}
                        onChange={(e) => setNewItem({ ...newItem, SubUnit: e.target.value })}
                        style={{ marginBottom: 10, width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={handleSubmit} style={{ background: '#4CAF50', color: '#fff', padding: '6px 12px', border: 'none', borderRadius: 4 }}>Add</button>
                        <button onClick={() => setShowForm(false)} style={{ background: '#ccc', padding: '6px 12px', border: 'none', borderRadius: 4 }}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}
