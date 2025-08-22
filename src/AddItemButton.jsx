import React, { useState } from 'react';

export default function AddItemButton({ addItem, setSelectedItem, setSelectedNodes }) {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        Code: '',
        Name: '',
        Category: 'Equipment',
        Unit: '',
        SubUnit: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleAdd = () => {
        const newItem = {
            id: `item-${Date.now()}`,
            ...formData,
        };

        // Call parent's addItem
        if (typeof addItem === 'function') {
            addItem(newItem);
        } else {
            console.error('addItem is not a function');
        }

        // Update selection so ItemDetailCard shows
        if (typeof setSelectedItem === 'function') {
            setSelectedItem(newItem);
        }
        if (typeof setSelectedNodes === 'function') {
            setSelectedNodes([newItem]);
        }

        setFormData({ Code: '', Name: '', Category: 'Equipment', Unit: '', SubUnit: '' });
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
                <div style={{ position: 'absolute', background: '#fff', padding: 20, border: '1px solid #ccc', borderRadius: 4 }}>
                    <div>
                        <label>Code:</label>
                        <input name="Code" value={formData.Code} onChange={handleChange} />
                    </div>
                    <div>
                        <label>Name:</label>
                        <input name="Name" value={formData.Name} onChange={handleChange} />
                    </div>
                    <div>
                        <label>Category:</label>
                        <select name="Category" value={formData.Category} onChange={handleChange}>
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

                    <button onClick={handleAdd} style={{ marginTop: 10, padding: '5px 10px' }}>
                        Add
                    </button>
                    <button onClick={() => setShowForm(false)} style={{ marginLeft: 10, padding: '5px 10px' }}>
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}
