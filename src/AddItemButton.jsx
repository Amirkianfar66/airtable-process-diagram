import React, { useState } from 'react';

export default function AddItemButton({ addItem }) {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        Code: '',
        Name: '',
        "Category Item Type": 'Equipment', // ✅ unified field name
        Unit: '',
        SubUnit: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        addItem(formData); // ✅ pass with correct key
        setShowForm(false);
        setFormData({ Code: '', Name: '', "Category Item Type": 'Equipment', Unit: '', SubUnit: '' });
    };

    return (
        <div>
            <button
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-500 text-white px-4 py-2 rounded"
            >
                + Add Item
            </button>

            {showForm && (
                <form onSubmit={handleSubmit} className="mt-2 p-2 border rounded bg-gray-50">
                    <input
                        type="text"
                        name="Code"
                        placeholder="Code"
                        value={formData.Code}
                        onChange={handleChange}
                        className="border p-1 m-1"
                        required
                    />
                    <input
                        type="text"
                        name="Name"
                        placeholder="Name"
                        value={formData.Name}
                        onChange={handleChange}
                        className="border p-1 m-1"
                        required
                    />
                    <select
                        name="Category Item Type"
                        value={formData["Category Item Type"]}
                        onChange={handleChange}
                        className="border p-1 m-1"
                    >
                        <option value="Equipment">Equipment</option>
                        <option value="Pipe">Pipe</option>
                        <option value="Valve">Valve</option>
                        <option value="Instrument">Instrument</option>
                        <option value="Inline item">Inline item</option>
                    </select>
                    <input
                        type="text"
                        name="Unit"
                        placeholder="Unit"
                        value={formData.Unit}
                        onChange={handleChange}
                        className="border p-1 m-1"
                    />
                    <input
                        type="text"
                        name="SubUnit"
                        placeholder="Sub Unit"
                        value={formData.SubUnit}
                        onChange={handleChange}
                        className="border p-1 m-1"
                    />

                    <button type="submit" className="bg-green-500 text-white px-3 py-1 rounded m-1">
                        Save
                    </button>
                </form>
            )}
        </div>
    );
}
