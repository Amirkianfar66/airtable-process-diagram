// diagramBuilder.js
import { fetchData } from './ProcessDiagram';
import React, { useState, useEffect } from "react";

export default function UnitLayoutConfig({ onChange }) {
    const [rows, setRows] = useState(3); // default 3 rows
    const [rowValues, setRowValues] = useState(Array(rows).fill(""));

    // update rowValues when number of rows changes
    useEffect(() => {
        setRowValues(prev => {
            const newVals = Array(rows).fill("");
            prev.forEach((val, idx) => {
                if (idx < rows) newVals[idx] = val;
            });
            return newVals;
        });
    }, [rows]);

    const handleRowChange = (index, value) => {
        const newRowValues = [...rowValues];
        newRowValues[index] = value;
        setRowValues(newRowValues);
        // send back a 2D array: [["UnitA","UnitB"], ["UnitC","UnitD"], ...]
        onChange(newRowValues.map(v => v.split(",").map(s => s.trim()).filter(Boolean)));
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
                {Array.from({ length: rows }).map((_, idx) => (
                    <div key={idx} style={{ marginBottom: 5 }}>
                        <label>Row {idx + 1}:</label>
                        <input
                            type="text"
                            value={rowValues[idx] || ""}
                            onChange={e => handleRowChange(idx, e.target.value)}
                            placeholder="Enter units separated by commas"
                            style={{ width: 300, marginLeft: 10 }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
