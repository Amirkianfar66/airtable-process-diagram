// UnitLayoutConfig.jsx
import React, { useState, useEffect } from "react";

export default function UnitLayoutConfig({ availableUnits = [], onChange }) {
    const [rows, setRows] = useState(3); // default rows
    const [rowSelections, setRowSelections] = useState([]);

    // Initialize rowSelections whenever rows or availableUnits change
    useEffect(() => {
        setRowSelections(prev => {
            const newSelections = Array.from({ length: rows }, (_, idx) => prev[idx] || []);
            return newSelections;
        });
    }, [rows, availableUnits]);

    const handleSelectChange = (rowIndex, unitId) => {
        const newSelections = [...rowSelections];
        if (unitId === "") {
            // Remove selection
            newSelections[rowIndex] = [];
        } else {
            newSelections[rowIndex] = [unitId];
        }
        setRowSelections(newSelections);
        // Send selected units array back to parent
        onChange(newSelections.map(sel => sel.map(id => availableUnits.find(u => u.id === id)?.Name).filter(Boolean)));
    };

    return (
        <div style={{ marginBottom: 20 }}>
            <label>
                Number of Rows:{" "}
                <select value={rows} onChange={e => setRows(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                </select>
            </label>

            <div style={{ marginTop: 10 }}>
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div key={rowIndex} style={{ marginBottom: 10, display: "flex", alignItems: "center" }}>
                        <label style={{ marginRight: 10 }}>Row {rowIndex + 1}:</label>
                        <select
                            value={rowSelections[rowIndex]?.[0] || ""}
                            onChange={e => handleSelectChange(rowIndex, e.target.value)}
                            style={{ minWidth: 200, padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc" }}
                        >
                            <option value="">-- Select a unit --</option>
                            {availableUnits.map(unit => (
                                <option key={unit.id} value={unit.id}>{unit.Name}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        </div>
    );
}
