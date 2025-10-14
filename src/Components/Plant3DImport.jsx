import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

/** Minimal, opinionated importer for Plant 3D Report Creator (XLSX/CSV) → Airtable ("Table 13") */
export default function Plant3DImport({ onDone }) {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState([]);
    const [preview, setPreview] = useState([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");

    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
    const table = encodeURIComponent(import.meta.env.VITE_AIRTABLE_TABLE_ID || import.meta.env.VITE_AIRTABLE_TABLE_NAME || "Table 13");

    const help = `Expected columns (auto-detected if present):
- Equipment/Item: Tag or Line Number Tag (→ Item Code), Description/Component (→ Name)
- Size (→ ND), Spec (→ Type), Service (→ SubUnit), Area/Unit (→ Unit)
- Optional From / To (build simple Connections)`;

    function parseFile(file) {
        return new Promise((resolve, reject) => {
            const name = (file?.name || "").toLowerCase();
            if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
                const fr = new FileReader();
                fr.onload = () => {
                    const wb = XLSX.read(fr.result, { type: "array" });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    resolve(XLSX.utils.sheet_to_json(ws, { defval: "" }));
                };
                fr.onerror = reject;
                fr.readAsArrayBuffer(file);
            } else if (name.endsWith(".csv")) {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (res) => resolve(res.data || []),
                    error: reject,
                });
            } else {
                reject(new Error("Please select .xlsx, .xls or .csv"));
            }
        });
    }

    const mapRow = (r0 = {}) => {
        // normalize keys once (case + spaces)
        const r = Object.fromEntries(
            Object.entries(r0).map(([k, v]) => [String(k).trim().toLowerCase(), v])
        );

        // Common Plant 3D / P&ID report headers
        const pick = (...cands) => {
            for (const c of cands) {
                const v = r[c.toLowerCase()];
                if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
            }
            return "";
        };

        const itemCode = pick("tag", "line number tag", "line tag", "line number", "number", "id");
        const name = pick("description", "component", "name", "item", "title") || itemCode;
        const size = pick("size", "nd", "nominal diameter");
        const spec = pick("spec", "specification", "type", "valve type");
        const service = pick("service", "subsystem", "sub unit", "subunit");
        const unit = pick("unit", "area", "plant area") || "Unit 1";
        const fromVal = pick("from");
        const toVal = pick("to");
        const klass = pick("class", "category");
        const catGuess =
            /valve/i.test(klass || spec) ? "Inline Valve" :
                /instrument/i.test(klass) ? "Instrument" :
                    /pipe/i.test(klass) ? "Pipe" :
                        "Equipment";

        // Build minimal record for your Table 13 schema
        const rec = {
            "Item Code": itemCode,
            Code: itemCode,
            Name: name,
            Unit: unit,
            SubUnit: service || "Default SubUnit",
            "Category Item Type": catGuess,
            Category: catGuess,
            Type: spec || "",
            ND: size ? Number(size) : undefined,
        };

        // Optional simple connection from report rows
        if (toVal) rec.Connections = [toVal];

        return rec;
    };

    async function fetchExistingByCode() {
        // Pull existing records (id + Item Code) to support upsert
        const out = new Map();
        let offset = null;
        do {
            const url = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100${offset ? `&offset=${offset}` : ""}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            (data.records || []).forEach(r => {
                const code = (r.fields?.["Item Code"] || r.fields?.Code || "").trim();
                if (code) out.set(code.toLowerCase(), r.id);
            });
            offset = data.offset;
        } while (offset);
        return out;
    }

    const chunk = (arr, n = 10) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));

    async function upsertToAirtable(mappedRows) {
        const existing = await fetchExistingByCode();
        const toCreate = [];
        const toPatch = [];

        mappedRows.forEach(row => {
            const codeKey = (row["Item Code"] || "").toLowerCase();
            const id = existing.get(codeKey);
            if (id) {
                toPatch.push({ id, fields: row });
            } else {
                toCreate.push({ fields: row });
            }
        });

        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };

        // Create in batches
        for (const grp of chunk(toCreate, 10)) {
            await fetch(`https://api.airtable.com/v0/${baseId}/${table}`, {
                method: "POST", headers, body: JSON.stringify({ records: grp })
            });
        }
        // Patch in batches
        for (const grp of chunk(toPatch, 10)) {
            await fetch(`https://api.airtable.com/v0/${baseId}/${table}`, {
                method: "PATCH", headers, body: JSON.stringify({ records: grp })
            });
        }
    }

    async function handleFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setMsg("");
        try {
            const raw = await parseFile(file);
            const mapped = raw.map(mapRow).filter(r => r["Item Code"]);
            setRows(mapped);
            setPreview(mapped.slice(0, 10)); // show first 10
        } catch (err) {
            setMsg(err.message || String(err));
        }
    }

    async function doImport() {
        if (!rows.length) return;
        setBusy(true);
        setMsg("Importing…");
        try {
            await upsertToAirtable(rows);
            setMsg(`Imported ${rows.length} rows.`);
            onDone?.();
        } catch (e) {
            setMsg(`Import failed: ${e.message || e}`);
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <button onClick={() => setOpen(true)} style={{ padding: "6px 10px" }}>
                Import from Plant 3D
            </button>

            {open && (
                <div
                    onMouseDown={() => setOpen(false)}
                    style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
                        display: "grid", placeItems: "center", zIndex: 9999
                    }}
                >
                    <div onMouseDown={e => e.stopPropagation()} style={{
                        width: "min(900px, 96vw)", height: "min(600px, 90vh)", background: "#fff",
                        borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column"
                    }}>
                        <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", gap: 8 }}>
                            <strong>Import from Plant 3D Report (XLSX/CSV)</strong>
                            <div style={{ marginLeft: "auto" }}>
                                <button onClick={() => setOpen(false)}>Close</button>
                            </div>
                        </div>

                        <div style={{ padding: 12, display: "grid", gap: 10, gridAutoRows: "min-content", overflow: "auto" }}>
                            <div style={{ fontSize: 12, color: "#666", whiteSpace: "pre-wrap" }}>{help}</div>

                            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
                            {!!rows.length && (
                                <>
                                    <div style={{ fontSize: 12 }}>
                                        Parsed <b>{rows.length}</b> rows. Preview below (first 10):
                                    </div>
                                    <div style={{ border: "1px solid #eee", borderRadius: 6, overflow: "auto", maxHeight: 280 }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                            <thead>
                                                <tr>{["Item Code", "Name", "Unit", "SubUnit", "Category", "Type", "ND", "Connections"].map(h => (
                                                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>{h}</th>
                                                ))}</tr>
                                            </thead>
                                            <tbody>
                                                {preview.map((r, i) => (
                                                    <tr key={i}>
                                                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>{r["Item Code"]}</td>
                                                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>{r.Name}</td>
                                                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>{r.Unit}</td>
                                                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>{r.SubUnit}</td>
                                                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>{r.Category}</td>
                                                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>{r.Type}</td>
                                                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>{r.ND ?? ""}</td>
                                                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>{Array.isArray(r.Connections) ? r.Connections.join(", ") : ""}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={doImport} disabled={busy} style={{ padding: "6px 10px" }}>
                                            {busy ? "Importing…" : "Import to Airtable"}
                                        </button>
                                        {!!msg && <span style={{ fontSize: 12, color: "#444" }}>{msg}</span>}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
