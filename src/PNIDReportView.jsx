import React, { useMemo, useRef, useState, useEffect } from "react";
import Papa from "papaparse";

const DEFAULT_GROUPS = [
    { name: "Class", cols: ["Pipe Class", "Tag"] },
    { name: "Segment Size", cols: ["Size", "Size OD", "Size ID"] },
    { name: "Finishing", cols: ["Description", "Corrosion Allowance", "Insulation Type", "Insulation Thick", "Trace", "Painting"] },
    { name: "P&ID", cols: ["P&ID", "From", "To"] },
    { name: "Design", cols: ["Pressure Drop", "Insulation"] },
    { name: "Operation", cols: ["Operation Pressure", "Operation Temperature"] },
    { name: "Fluid", cols: ["Fluid Tag"] },
];

export default function PNIDReportView() {
    const [rows, setRows] = useState([]);
    const [columns, setColumns] = useState([]);
    const [fileMeta, setFileMeta] = useState(null);
    const [filter, setFilter] = useState("");
    const [sort, setSort] = useState({ key: "", dir: 1 });
    const [msg, setMsg] = useState("");
    const [mode, setMode] = useState(() => localStorage.getItem("pnidReport:mode") || "report"); // 'report' | 'simple'
    const inputRef = useRef(null);

    // Report chrome
    const [title, setTitle] = useState(() => localStorage.getItem("pnidReport:title") || "Linelist");
    const [project, setProject] = useState(() => localStorage.getItem("pnidReport:project") || "Project");
    const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem("pnidReport:logo") || "");
    const [groups, setGroups] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("pnidReport:groups") || "null") || DEFAULT_GROUPS;
        } catch { return DEFAULT_GROUPS; }
    });

    // restore last loaded CSV
    useEffect(() => {
        try {
            const saved = localStorage.getItem("pnidReport:data");
            const meta = localStorage.getItem("pnidReport:meta");
            if (saved) {
                const { rows, columns } = JSON.parse(saved);
                setRows(rows || []); setColumns(columns || []);
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
            worker: true,
            dynamicTyping: false,
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
                e.target.value = "";
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

    // filter + sort (used only in simple mode)
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

    // ---- Report Mode helpers ----
    // Only keep group columns that exist in CSV; collect "Other" for leftovers.
    const reportLayout = useMemo(() => {
        if (!columns.length) return { groups: [], allOrder: [] };

        const colSet = new Set(columns);
        const normalized = groups.map(g => ({
            name: g.name,
            cols: (g.cols || []).filter(c => colSet.has(c))
        })).filter(g => g.cols.length);

        const inGroups = new Set(normalized.flatMap(g => g.cols));
        const leftovers = columns.filter(c => !inGroups.has(c));

        const finalGroups = [...normalized];
        if (leftovers.length) finalGroups.push({ name: "Other", cols: leftovers });

        const order = finalGroups.flatMap(g => g.cols);
        return { groups: finalGroups, allOrder: order };
    }, [columns, groups]);

    function printReport() {
        window.print();
    }

    // Persist chrome + mode
    useEffect(() => { localStorage.setItem("pnidReport:mode", mode); }, [mode]);
    useEffect(() => { localStorage.setItem("pnidReport:title", title); }, [title]);
    useEffect(() => { localStorage.setItem("pnidReport:project", project); }, [project]);
    useEffect(() => { localStorage.setItem("pnidReport:logo", logoUrl); }, [logoUrl]);
    useEffect(() => { localStorage.setItem("pnidReport:groups", JSON.stringify(groups)); }, [groups]);

    // --- UI ---
    return (
        <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr", height: "100%" }}>
            {/* Top bar */}
            <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                borderBottom: "1px solid #eee", background: "#fafafa"
            }}>
                <button onClick={onPickFile} style={btn}>Load CSV</button>
                <input ref={inputRef} type="file" accept=".csv" onChange={onFileChange} style={{ display: "none" }} />
                <button onClick={downloadCSV} disabled={!rows.length} style={btnLight}>Download CSV</button>
                <button onClick={clearList} disabled={!rows.length} style={btnLight}>Clear</button>

                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                    <label style={{ fontSize: 12, color: "#555" }}>View:</label>
                    <select value={mode} onChange={(e) => setMode(e.target.value)} style={sel}>
                        <option value="report">Report</option>
                        <option value="simple">Simple</option>
                    </select>
                    {fileMeta && (
                        <div style={{ fontSize: 12, color: "#666" }}>
                            {fileMeta.name} • {rows.length} rows
                        </div>
                    )}
                    {!!msg && <div style={{ color: "crimson", fontSize: 12 }}>{msg}</div>}
                </div>
            </div>

            {/* Report chrome (visible in Report mode) */}
            {mode === "report" && (
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 10px", borderBottom: "1px solid #eee" }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, marginBottom: 2 }}>{title}</div>
                        <div style={{ fontSize: 12, color: "#333" }}>
                            <b>Project</b>&nbsp;&nbsp;{project}
                        </div>
                    </div>
                    {logoUrl ? <img src={logoUrl} alt="logo" style={{ height: 36, objectFit: "contain" }} /> : null}
                    <button onClick={printReport} disabled={!rows.length} style={btn}>Print / Save PDF</button>
                </div>
            )}

            {/* Body */}
            <div style={{ overflow: "auto" }}>
                {!rows.length ? (
                    <div style={{ padding: 16, color: "#666" }}>
                        No report loaded. Export a <b>CSV</b> from Plant 3D Report Creator and click <b>Load CSV</b>.
                    </div>
                ) : mode === "simple" ? (
                    // ---------- SIMPLE TABLE ----------
                    <div style={{ padding: 10 }}>
                        <input
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Filter…"
                            style={{ marginBottom: 10, padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8 }}
                        />
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                                <tr>
                                    {columns.map((c) => (
                                        <th
                                            key={c}
                                            onClick={() => setSort(s => ({ key: c, dir: s.key === c ? -s.dir : 1 }))}
                                            title="Click to sort"
                                            style={thSimple(sort.key === c ? (sort.dir === 1 ? "▲" : "▼") : "")}
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
                    </div>
                ) : (
                    // ---------- REPORT TABLE (graphic like your screenshot) ----------
                    <div style={{ padding: 12 }}>
                        {/* Config editor (inline, collapsible if you want) */}
                        <details style={{ marginBottom: 10 }}>
                            <summary style={{ cursor: "pointer", color: "#444" }}>Report settings</summary>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                                <Labeled label="Title"><input value={title} onChange={e => setTitle(e.target.value)} style={inp} /></Labeled>
                                <Labeled label="Project"><input value={project} onChange={e => setProject(e.target.value)} style={inp} /></Labeled>
                                <Labeled label="Logo URL"><input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} style={{ ...inp, minWidth: 380 }} /></Labeled>
                            </div>
                            <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                                Column groups (drag to reorder by editing arrays in code later, or just change names below):
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8, marginTop: 8 }}>
                                {groups.map((g, idx) => (
                                    <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
                                        <input
                                            value={g.name}
                                            onChange={(e) => {
                                                const copy = groups.slice(); copy[idx] = { ...g, name: e.target.value }; setGroups(copy);
                                            }}
                                            style={{ ...inp, width: "100%", marginBottom: 6 }}
                                        />
                                        <div style={{ fontSize: 12, color: "#666" }}>{g.cols.join(" • ") || <i>(no matching columns in CSV)</i>}</div>
                                    </div>
                                ))}
                            </div>
                        </details>

                        <table style={tableReport}>
                            <thead>
                                {/* Group row */}
                                <tr>
                                    {reportLayout.groups.map(g => (
                                        <th key={g.name} colSpan={g.cols.length} style={thGroup}>{g.name}</th>
                                    ))}
                                </tr>
                                {/* Column row */}
                                <tr>
                                    {reportLayout.groups.flatMap(g => g.cols).map(col => (
                                        <th key={col} style={thCol}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={i}>
                                        {reportLayout.allOrder.map((col) => (
                                            <td key={col} style={tdReport}>{String(r[col] ?? "")}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
                            {rows.length} rows • Printed on {new Date().toLocaleString()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------- small UI helpers ----------
function Labeled({ label, children }) {
    return (
        <label style={{ display: "grid", gridTemplateColumns: "80px 1fr", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
            {children}
        </label>
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
    border: "1px solid "#ddd"",
    borderRadius: 8,
    cursor: "pointer"
};
const sel = { padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8 };
const inp = { padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8 };

// simple table header cell
const thSimple = (marker) => ({
    textAlign: "left", padding: "8px 10px",
    borderBottom: "1px solid #eee", cursor: "pointer", whiteSpace: "nowrap"
});

// report styles
const tableReport = {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: 12,
    border: "1px solid #999",
};
const thGroup = {
    background: "#6c6c6c",
    color: "#fff",
    padding: "6px 8px",
    textAlign: "center",
    borderRight: "1px solid #999",
    borderBottom: "1px solid #999",
};
const thCol = {
    background: "#e9e9e9",
    color: "#000",
    padding: "6px 8px",
    textAlign: "left",
    borderRight: "1px solid #ccc",
    borderBottom: "1px solid #999",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
};
const tdReport = {
    padding: "6px 8px",
    borderRight: "1px solid #eee",
    borderBottom: "1px solid #eee",
    verticalAlign: "top",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
};

// Print: only print the report table cleanly
const printCSS = `
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  header, footer { display: none !important; }
  input, button, details, summary { display: none !important; }
  table { page-break-inside: auto; }
  tr    { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("pnid-report-print-css")) {
    const style = document.createElement("style");
    style.id = "pnid-report-print-css";
    style.textContent = printCSS;
    document.head.appendChild(style);
}
