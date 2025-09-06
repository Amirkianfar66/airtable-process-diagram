// src/components/UnitLayoutConfig.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function UnitLayoutConfig({ availableUnits = [], onChange }) {
    const [rows, setRows] = useState(3);
    const [rowSelections, setRowSelections] = useState([]); // [[id, id], [id], ...]
    const [openDropdownRow, setOpenDropdownRow] = useState(null); // which row's palette is open
    const [searchByRow, setSearchByRow] = useState({}); // { [rowIndex]: "query" }

    // Build quick lookup maps
    const idToName = useMemo(() => {
        const m = new Map();
        availableUnits.forEach(u => m.set(String(u.id), u.Name ?? String(u.id)));
        return m;
    }, [availableUnits]);

    // Ensure rowSelections has correct length when rows/availableUnits change
    useEffect(() => {
        setRowSelections(prev => Array.from({ length: rows }, (_, i) => prev[i] || []));
    }, [rows, availableUnits]);

    // Emit changes upstream (names per row), keep original immediate behavior
    useEffect(() => {
        const names = rowSelections.map(sel => sel
            .map(id => idToName.get(String(id)))
            .filter(Boolean)
        );
        onChange?.(names);
    }, [rowSelections, idToName, onChange]);

    // ---- Helpers ----
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const incRows = () => setRows(r => clamp(r + 1, 1, 6));
    const decRows = () => setRows(r => clamp(r - 1, 1, 6));

    const setQuery = (rowIndex, v) =>
        setSearchByRow(q => ({ ...q, [rowIndex]: v }));

    const filteredOptions = (rowIndex) => {
        const q = (searchByRow[rowIndex] || "").toLowerCase().trim();
        if (!q) return availableUnits;
        return availableUnits.filter(u =>
            (u.Name || "").toLowerCase().includes(q)
            || String(u.id).toLowerCase().includes(q)
        );
    };

    const addUnitToRow = (rowIndex, id) => {
        setRowSelections(prev => {
            const next = prev.map(a => [...a]);
            const strId = String(id);
            if (!next[rowIndex].includes(strId)) next[rowIndex].push(strId);
            return next;
        });
    };

    const removeUnitFromRow = (rowIndex, id) => {
        setRowSelections(prev => {
            const next = prev.map(a => [...a]);
            const strId = String(id);
            next[rowIndex] = next[rowIndex].filter(x => x !== strId);
            return next;
        });
    };

    const clearRow = (rowIndex) => {
        setRowSelections(prev => {
            const next = prev.map(a => [...a]);
            next[rowIndex] = [];
            return next;
        });
    };

    // Drag & drop between/within rows
    const dragDataRef = useRef(null); // { fromRow, id }
    const onChipDragStart = (e, fromRow, id) => {
        dragDataRef.current = { fromRow, id: String(id) };
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", JSON.stringify(dragDataRef.current)); } catch { }
    };
    const onRowDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };
    const onRowDrop = (e, toRow) => {
        e.preventDefault();
        let payload = dragDataRef.current;
        try {
            const t = e.dataTransfer.getData("text/plain");
            if (t) payload = JSON.parse(t);
        } catch { }
        if (!payload) return;

        const { fromRow, id } = payload;
        if (fromRow === undefined || !id) return;

        setRowSelections(prev => {
            const next = prev.map(a => [...a]);
            // remove from origin
            next[fromRow] = next[fromRow].filter(x => x !== id);
            // insert at end of target row (simple & predictable)
            if (!next[toRow].includes(id)) next[toRow].push(id);
            dragDataRef.current = null;
            return next;
        });
    };

    // ---- Styles ----
    const wrap = {
        display: "grid",
        gap: 12,
    };
    const header = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 10px",
        background: "#f6f7f9",
        border: "1px solid #e4e7ec",
        borderRadius: 8,
    };
    const stepper = {
        display: "flex",
        alignItems: "center",
        gap: 8,
    };
    const stepBtn = {
        border: "1px solid #d0d5dd",
        background: "#fff",
        padding: "4px 8px",
        borderRadius: 6,
        cursor: "pointer",
    };
    const rowsBox = {
        display: "grid",
        gap: 10,
    };
    const rowCard = {
        border: "1px solid #e4e7ec",
        borderRadius: 10,
        padding: 10,
        background: "#fff",
    };
    const rowHeader = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    };
    const rowActions = {
        display: "flex",
        alignItems: "center",
        gap: 8,
    };
    const ghostBtn = {
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #e4e7ec",
        background: "#f8fafc",
        cursor: "pointer",
    };
    const chipArea = {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        minHeight: 40,
        alignItems: "center",
        border: "1px dashed #dce1e7",
        borderRadius: 8,
        padding: 8,
        background: "#fafbfc",
    };
    const chip = {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        cursor: "grab",
        userSelect: "none",
        fontSize: 12,
    };
    const chipClose = {
        width: 18,
        height: 18,
        borderRadius: 999,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontSize: 12,
    };
    const dropdown = {
        marginTop: 8,
        border: "1px solid #e4e7ec",
        borderRadius: 10,
        background: "#fff",
        boxShadow: "0 8px 24px rgba(16,24,40,0.08)",
    };
    const searchRow = {
        display: "flex",
        gap: 8,
        padding: 10,
        borderBottom: "1px solid #f0f2f5",
    };
    const searchInput = {
        flex: 1,
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid #d0d5dd",
        outline: "none",
    };
    const optionGrid = {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 8,
        padding: 10,
        maxHeight: 180,
        overflow: "auto",
    };
    const optionPill = (active) => ({
        border: active ? "1px solid #2563eb" : "1px solid #e2e8f0",
        background: active ? "rgba(37,99,235,0.06)" : "#fff",
        borderRadius: 999,
        padding: "6px 10px",
        cursor: "pointer",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
    });
    const preview = {
        marginTop: 6,
        padding: 8,
        border: "1px dashed #e4e7ec",
        borderRadius: 8,
        background: "#fafafa",
    };
    const previewRow = {
        display: "flex",
        gap: 8,
        padding: "6px 0",
        alignItems: "center",
        flexWrap: "wrap",
    };
    const previewTag = {
        fontSize: 11,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid #e2e8f0",
        background: "#fff",
    };

    return (
        <div style={wrap}>
            {/* Header / stepper */}
            <div style={header}>
                <div style={{ fontWeight: 600 }}>Unit Layout</div>
                <div style={stepper}>
                    <span style={{ fontSize: 12, color: "#667085" }}>Rows</span>
                    <button style={stepBtn} onClick={decRows} aria-label="Decrease rows">−</button>
                    <div style={{ minWidth: 24, textAlign: "center", fontWeight: 600 }}>{rows}</div>
                    <button style={stepBtn} onClick={incRows} aria-label="Increase rows">+</button>
                </div>
            </div>

            {/* Rows */}
            <div style={rowsBox}>
                {Array.from({ length: rows }).map((_, rowIndex) => {
                    const sel = rowSelections[rowIndex] || [];
                    const isOpen = openDropdownRow === rowIndex;

                    return (
                        <div key={rowIndex} style={rowCard}>
                            <div style={rowHeader}>
                                <div style={{ fontWeight: 600 }}>Row {rowIndex + 1}</div>
                                <div style={rowActions}>
                                    <button
                                        style={ghostBtn}
                                        onClick={() => setOpenDropdownRow(isOpen ? null : rowIndex)}
                                    >
                                        {isOpen ? "Close Palette" : "Add Units"}
                                    </button>
                                    <button
                                        style={ghostBtn}
                                        onClick={() => clearRow(rowIndex)}
                                        title="Clear this row"
                                    >
                                        Clear Row
                                    </button>
                                </div>
                            </div>

                            {/* Chips & drop target */}
                            <div
                                style={chipArea}
                                onDragOver={onRowDragOver}
                                onDrop={(e) => onRowDrop(e, rowIndex)}
                                role="list"
                                aria-label={`Row ${rowIndex + 1} selection`}
                            >
                                {sel.length === 0 && (
                                    <span style={{ color: "#98a2b3", fontSize: 12 }}>
                                        Drop or add units here…
                                    </span>
                                )}
                                {sel.map((id) => (
                                    <div
                                        key={id}
                                        style={chip}
                                        draggable
                                        onDragStart={(e) => onChipDragStart(e, rowIndex, id)}
                                        title="Drag to reorder or move to another row"
                                        role="listitem"
                                    >
                                        <span>{idToName.get(String(id)) || id}</span>
                                        <span
                                            style={chipClose}
                                            onClick={() => removeUnitFromRow(rowIndex, id)}
                                            title="Remove"
                                        >
                                            ×
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Inline dropdown / palette */}
                            {isOpen && (
                                <div style={dropdown}>
                                    <div style={searchRow}>
                                        <input
                                            style={searchInput}
                                            placeholder="Search units…"
                                            value={searchByRow[rowIndex] || ""}
                                            onChange={(e) => setQuery(rowIndex, e.target.value)}
                                        />
                                    </div>
                                    <div style={optionGrid}>
                                        {filteredOptions(rowIndex).map((u) => {
                                            const active = sel.includes(String(u.id));
                                            return (
                                                <div
                                                    key={u.id}
                                                    style={optionPill(active)}
                                                    onClick={() =>
                                                        active
                                                            ? removeUnitFromRow(rowIndex, String(u.id))
                                                            : addUnitToRow(rowIndex, String(u.id))
                                                    }
                                                    title={active ? "Remove from row" : "Add to row"}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        readOnly
                                                        checked={active}
                                                        style={{ pointerEvents: "none" }}
                                                    />
                                                    <span>{u.Name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Compact preview */}
            <div style={preview}>
                <div style={{ fontWeight: 600, fontSize: 12, color: "#475467", marginBottom: 6 }}>
                    Preview
                </div>
                {rowSelections.map((sel, i) => (
                    <div key={i} style={previewRow}>
                        <div style={{ width: 52, color: "#667085", fontSize: 12 }}>Row {i + 1}</div>
                        {sel.length ? (
                            sel.map((id) => (
                                <span key={id} style={previewTag}>
                                    {idToName.get(String(id)) || id}
                                </span>
                            ))
                        ) : (
                            <span style={{ color: "#98a2b3", fontSize: 12 }}>— empty —</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
