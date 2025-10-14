// PNIDReportView.jsx (CSV-only, read-only)
import React, { useMemo, useRef, useState, useEffect } from "react";
import Papa from "papaparse";

export default function PNIDReportView() {
    const [rows, setRows] = useState([]);
    const [columns, setColumns] = useState([]);
    const [fileMeta, setFileMeta] = useState(null);
    const [filter, setFilter] = useState("");
    const [sort, setSort] = useState({ key: "", dir: 1 });
    const [msg, setMsg] = useState("");
    const inputRef = useRef(null);

    // restore last loaded CSV
    useEffect(() => {
        try {
            const saved = localStorage.getItem("pnidReport:data");
            const meta = localStorage.getItem("pnidReport:meta");
            if (saved) {
                const { rows, columns } = JSON.parse(saved);
                setRows(rows || []);
                setColumns(columns || []);
            }
            if (meta) setFileMeta(JSON.parse(meta));
        } catch { }
    }, []);

    const saveState = (rows, cols, meta) => {
        localStorage.setItem("pnidReport:data", JSON.stringify({ rows, columns: cols }));
        if (meta) localStorage.setItem("pnidReport:meta", JSON.stringify(meta));
    };

    function onPickFile() { inputRef.current?.click(); }

    function onFileChange(e) {
        const f = e.target.files?.[0];
        if (!f) return;
        setMsg("");

        Papa.parse(f, {
            header: true,
            skipEmptyLines: "greedy",
            worker: true,               // faster on large files
            dynamicTyping: false,       // keep as strings for display
            // delimiter: ""  // let Papa auto-detect (comma/semicolon/tab)
            complete: (res) => {
                const data = res.data || [];
                const cols = Array.from(
                    data.reduce((set, r) => { Object.keys(r || {}).forEach(k => set.add(k)); return set; }, new Set())
                );
                setRows(data);
                setColumns(cols);
                const meta = { name: f.name, size: f.size, type: f.type, time: Date.now() };
                setFileMeta(meta);
                saveState(data, cols, meta);
                e.target.value = ""; // reset
            },
            error: (err) => {
                setMsg(err?.message || String(err));
                e.target.value = "";
            },
        });
    }

    function clearList() {
        setRows([]); setColumns([]); setFileMeta(null); setMsg("");
        localStorage.removeItem("pnidReport:data");
        localStorage.removeItem("pnidReport:meta");
    }

    function downloadCSV() {
        if (!rows.length) return;
        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (fileMeta?.name?.replace(/\.\w+$/, "") || "pnid_report") + ".csv";
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    }

    const filtered = useMemo(() => {
        if (!filter) return rows;
        const q = filter.toLowerCase();
        return rows.filter(r => columns.some(k => String(r[k] ?? "").toLowerCase().includes(q)));
    }, [rows, columns, filter]);

    const sorted = useMemo(() => {
        if (!sort.key) return filtered;
        const arr = [...filtered];
        arr.sort((a, b) => {
            const av = String(a[sort.key] ?? "");
            const bv = String(b[sort.key] ?? "");
            return av.localeCompare(bv, undefined, { numeric: true }) * sort.dir;
        });
        return arr;
    }, [filtered, sort]);

    return (
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%" }}>
            {/* Top bar */}
            <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                borderBottom: "1px solid #eee", background: "#fafafa"
            }}>
                <button onClick={onPickFile} style={btn}>Load CSV</button>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".csv"
                    onChange={onFileChange}
                    style={{ display: "none" }}
                />
                <button onClick={downloadCSV} disabled={!rows.length} style={btnLight}>Download CSV</button>
                <button onClick={clearList} disabled={!rows.length} style={btnLight}>Clear</button>
                <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter…"
                    style={{ marginLeft: "auto", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8 }}
                />
                {fileMeta && (
                    <div style={{ fontSize: 12, color: "#666" }}>
                        {fileMeta.name} • {rows.length} rows
                    </div>
                )}
                {!!msg && <div style={{ color: "crimson", fontSize: 12 }}>{msg}</div>}
            </div>

            {/* Table */}
            <div style={{ overflow: "auto" }}>
                {!rows.length ? (
                    <div style={{ padding: 16, color: "#666" }}>
                        No report loaded. Export a <b>CSV</b> from Plant 3D Report Creator and click <b>Load CSV</b>.
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                            <tr>
                                {columns.map((c) => (
                                    <th
                                        key={c}
                                        onClick={() => setSort(s => ({ key: c, dir: s.key === c ? -s.dir : 1 }))}
                                        title="Click to sort"
                                        style={{
                                            textAlign: "left", padding: "8px 10px",
                                            borderBottom: "1px solid #eee", cursor: "pointer", whiteSpace: "nowrap"
                                        }}
                                    >
                                        {c}{sort.key === c ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((r, i) => (
                                <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                                    {columns.map((c) => (
                                        <td key={c} style={{ padding: "6px 10px", verticalAlign: "top" }}>
                                            {String(r[c] ?? "")}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

const btn = {
    padding: "6px 10px",
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
    borderRadius: 8,
    cursor: "pointer"
};
const btnLight = {
    padding: "6px 10px",
    background: "#fff",
    color: "#111",
    border: "1px solid #ddd",
    borderRadius: 8,
    cursor: "pointer"
};
