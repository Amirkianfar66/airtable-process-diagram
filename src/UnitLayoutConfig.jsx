import React, { useState, useEffect } from "react";

// Example list of available units
const AVAILABLE_UNITS = ["UnitA", "UnitB", "UnitC", "UnitD", "UnitE", "UnitF"];

export default function UnitLayoutConfig({ onChange }) {
    const [rows, setRows] = useState(3); // default 3 rows
    const [rowValues, setRowValues] = useState(Array(rows).fill([]));

    useEffect(() => {
        setRowValues(prev => {
            const newVals = Array(rows).fill([]);
            prev.forEach((val, idx) => {
                if (idx < rows) newVals[idx] = val;
            });
            return newVals;
        });
    }, [rows]);

    const handleSelectChange = (rowIdx, unit) => {
        setRowValues(prev => {
            const newRows = [...prev];
            // toggle unit selection
            if (newRows[rowIdx].includes(unit)) {
                newRows[rowIdx] = newRows[rowIdx].filter(u => u !== unit);
            } else {
                newRows[rowIdx].push(unit);
            }
            // send back 2D array
            onChange(newRows);
            return newRows;
        });
    };

    return (
        <div style={{ marginBottom: 20, fontFamily: "sans-serif" }}>
            <label style={{ fontWeight: 600 }}>Number of Rows: </label>
            <select
                value={rows}
                onChange={e => setRows(Number(e.target.value))}
                style={{
                    marginLeft: 10,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid #ccc"
                }}
            >
                {[1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n}</option>
                ))}
            </select>

            <div style={{ marginTop: 15, display: "flex", flexDirection: "column", gap: 12 }}>
                {Array.from({ length: rows }).map((_, idx) => (
                    <div
                        key={idx}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                        }}
                    >
                        <div style={{ minWidth: 60, fontWeight: 500 }}>Row {idx + 1}:</div>
                        {AVAILABLE_UNITS.map(unit => (
                            <button
                                key={unit}
                                type="button"
                                onClick={() => handleSelectChange(idx, unit)}
                                style={{
                                    padding: "4px 10px",
                                    borderRadius: 20,
                                    border: "1px solid #aaa",
                                    background: rowValues[idx].includes(unit) ? "#4f46e5" : "#fff",
                                    color: rowValues[idx].includes(unit) ? "#fff" : "#333",
                                    cursor: "pointer",
                                    transition: "0.2s",
                                }}
                            >
                                {unit}
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
