// ===================== File: src/components/AddItemButton.jsx =====================
// Purpose: create items using field names that match ItemDetailCard expectations

import React, { useState } from 'react';

export default function AddItemButton({ addItem }) {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        'Item Code': '', // ✅ use Item Code to match ItemDetailCard
        Name: '',
        'Category Item Type': 'Equipment', // ✅ unified category field
        Unit: '',
        SubUnit: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleAdd = (e) => {
        e?.preventDefault?.();
        const newItem = {
            id: `item-${Date.now()}`,
            ...formData,
            // keep Code in sync for labels
            Code: formData['Item Code'] || '',
            Category: formData['Category Item Type'] || 'Equipment',
        };
        addItem(newItem);
        setFormData({ 'Item Code': '', Name: '', 'Category Item Type': 'Equipment', Unit: '', SubUnit: '' });
        setShowForm(false);
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
                <form onSubmit={handleAdd} style={{ position: 'absolute', background: '#fff', padding: 20, border: '1px solid #ccc', borderRadius: 4 }}>
                    <div>
                        <label>Item Code:</label>
                        <input name="Item Code" value={formData['Item Code']} onChange={handleChange} />
                    </div>
                    <div>
                        <label>Name:</label>
                        <input name="Name" value={formData.Name} onChange={handleChange} />
                    </div>
                    <div>
                        <label>Category:</label>
                        <select name="Category Item Type" value={formData['Category Item Type']} onChange={handleChange}>
                            <option>Equipment</option>
                            <option>Instrument</option>
                            <option>Inline Valve</option>
                            <option>Pipe</option>
                            <option>Electrical</option>
                        </select>
                    </div>
                    <div>
                        <label>Unit:</label>
                        <input name="Unit" value={formData.Unit} onChange={handleChange} />
                    </div>
                    <div>
                        <label>SubUnit:</label>
                        <input name="SubUnit" value={formData.SubUnit} onChange={handleChange} />
                    </div>

                    <button type="submit" style={{ marginTop: 10, padding: '5px 10px' }}>
                        Add
                    </button>
                    <button type="button" onClick={() => setShowForm(false)} style={{ marginLeft: 10, padding: '5px 10px' }}>
                        Cancel
                    </button>
                </form>
            )}
        </div>
    );
}
