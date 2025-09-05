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

    const handleSelectChange = (rowIndex, selectedIds) => {
        const newSelections = [...rowSelections];
        newSelections[rowIndex] = selectedIds;
        setRowSelections(newSelections);

        // Send back selected unit names
        onChange(
            newSelections.map(sel =>
                sel.map(id => availableUnits.find(u => u.id === id)?.Name).filter(Boolean)
            )
        );
    };

    return (
        <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600, marginBottom: 10, display: "block" }}>
                Number of Rows:
                <select
                    value={rows}
                    onChange={e => setRows(Number(e.target.value))}
                    style={{ marginLeft: 10, padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc" }}
                >
                    {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </label>

            <div style={{ marginTop: 10 }}>
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div
                        key={rowIndex}
                        style={{
                            marginBottom: 10,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}
                    >
                        <span style={{ fontWeight: 500, width: 60 }}>Row {rowIndex + 1}:</span>
                        <select
                            multiple
                            value={rowSelections[rowIndex] || []}
                            onChange={e =>
                                handleSelectChange(
                                    rowIndex,
                                    Array.from(e.target.selectedOptions).map(o => o.value)
                                )
                            }
                            style={{
                                minWidth: 200,
                                padding: "6px 10px",
                                borderRadius: 6,
                                border: "1px solid #ccc",
                                background: "#f9f9f9",
                                cursor: "pointer",
                            }}
                        >
                            {availableUnits.map(unit => (
                                <option key={unit.id} value={unit.id}>
                                    {unit.Name}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        </div>
    );
}
