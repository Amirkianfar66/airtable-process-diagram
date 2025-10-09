// AirtableItemsTable.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { DataGrid } from "@mui/x-data-grid";
import {
    Box, Stack, Button, Typography, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Grid, Tooltip
} from "@mui/material";

// ----------- fetch (read) -----------
async function fetchAirtableItems() {
    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
    const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

    if (!baseId || !token || !table) {
        throw new Error("Missing VITE_AIRTABLE_BASE_ID / VITE_AIRTABLE_TOKEN / VITE_AIRTABLE_TABLE_NAME");
    }

    let items = [];
    let offset = null;
    const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?pageSize=100`;

    do {
        const url = offset ? `${baseUrl}&offset=${offset}` : baseUrl;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        items = items.concat(data.records || []);
        offset = data.offset;
    } while (offset);

    return items.map(r => {
        const f = r.fields || {};
        const rawCat = f["Category Item Type"] ?? f["Category"] ?? "";
        const cat = Array.isArray(rawCat) ? (rawCat[0] ?? "") : String(rawCat || "");
        const rawType = Array.isArray(f.Type) ? (f.Type[0] ?? "") : String(f.Type || "");
        return {
            id: r.id,
            code: f["Item Code"] || f["Code"] || "",
            name: f["Name"] || "",
            unit: f["Unit"] || "",
            subUnit: f["SubUnit"] || f["Sub Unit"] || "",
            category: cat,
            type: rawType,
            sequence: f["Sequence"] ?? "",
        };
    });
}

// ----------- update (edit inline) -----------
async function patchAirtableRecord({ id, fields }) {
    const r = await fetch("/api/airtable/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, fields }),
    });
    if (!r.ok) throw new Error(await r.text());
}

// ----------- create -----------
async function createAirtableRecord(fields) {
    const r = await fetch("/api/airtable/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    return (data.records && data.records[0]) || null;
}

// ----------- delete -----------
async function deleteAirtableRecords(ids) {
    const r = await fetch("/api/airtable/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    return data.deleted || [];
}

export default function AirtableItemsTable() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selection, setSelection] = useState([]);

    const [addOpen, setAddOpen] = useState(false);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({
        name: "",
        category: "",
        type: "",
        unit: "",
        subUnit: "",
        sequence: "",
        code: "",
    });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const list = await fetchAirtableItems();
            setRows(list);
        } catch (e) {
            setError(String(e?.message || e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const columns = useMemo(() => ([
        { field: "code", headerName: "Item Code", flex: 1, minWidth: 140 },
        { field: "name", headerName: "Name", flex: 1.4, minWidth: 160, editable: true },
        { field: "category", headerName: "Category", flex: 1, minWidth: 120, editable: true },
        { field: "type", headerName: "Type", flex: 1, minWidth: 140, editable: true },
        { field: "unit", headerName: "Unit", width: 120, editable: true },
        { field: "subUnit", headerName: "Sub Unit", width: 140, editable: true },
        { field: "sequence", headerName: "Seq", width: 90, editable: true },
    ]), []);

    async function processRowUpdate(newRow, oldRow) {
        const fields = {
            ...(newRow.name !== oldRow.name ? { "Name": newRow.name } : {}),
            ...(newRow.category !== oldRow.category ? { "Category": newRow.category } : {}),
            ...(newRow.type !== oldRow.type ? { "Type": newRow.type } : {}),
            ...(newRow.unit !== oldRow.unit ? { "Unit": newRow.unit } : {}),
            ...(newRow.subUnit !== oldRow.subUnit ? { "Sub Unit": newRow.subUnit } : {}),
            ...(newRow.sequence !== oldRow.sequence ? { "Sequence": newRow.sequence } : {}),
            // optional: change code
            ...(newRow.code !== oldRow.code ? { "Item Code": newRow.code } : {}),
        };
        if (Object.keys(fields).length > 0) {
            await patchAirtableRecord({ id: newRow.id, fields });
        }
        // reflect locally
        setRows(prev => prev.map(r => (r.id === newRow.id ? newRow : r)));
        return newRow;
    }

    // ----- Add dialog handlers -----
    const openAdd = () => { setForm({ name: "", category: "", type: "", unit: "", subUnit: "", sequence: "", code: "" }); setAddOpen(true); };
    const closeAdd = () => setAddOpen(false);

    const saveAdd = async () => {
        if (!form.name.trim()) { alert("Name is required"); return; }
        setAdding(true);
        try {
            // Map to Airtable fields (use your actual column names)
            const fields = {
                "Name": form.name || "",
                "Category": form.category || "",
                "Type": form.type || "",
                "Unit": form.unit || "",
                "Sub Unit": form.subUnit || "",
                "Sequence": form.sequence || "",
                "Item Code": form.code || "",
            };
            const rec = await createAirtableRecord(fields);
            if (!rec) throw new Error("Create failed");

            // Normalize like fetchAirtableItems()
            const nf = rec.fields || {};
            const rawCat = nf["Category Item Type"] ?? nf["Category"] ?? "";
            const cat = Array.isArray(rawCat) ? (rawCat[0] ?? "") : String(rawCat || "");
            const rawType = Array.isArray(nf.Type) ? (nf.Type[0] ?? "") : String(nf.Type || "");
            const newRow = {
                id: rec.id,
                code: nf["Item Code"] || nf["Code"] || "",
                name: nf["Name"] || "",
                unit: nf["Unit"] || "",
                subUnit: nf["SubUnit"] || nf["Sub Unit"] || "",
                category: cat,
                type: rawType,
                sequence: nf["Sequence"] ?? "",
            };
            setRows(prev => [newRow, ...prev]);
            setAddOpen(false);
        } catch (e) {
            alert(e?.message || String(e));
        } finally {
            setAdding(false);
        }
    };

    // ----- Delete selected -----
    const onDeleteSelected = async () => {
        if (selection.length === 0) return;
        if (!confirm(`Delete ${selection.length} selected row(s)?`)) return;
        try {
            const deletedIds = await deleteAirtableRecords(selection);
            if (deletedIds.length > 0) {
                setRows(prev => prev.filter(r => !deletedIds.includes(r.id)));
                setSelection(prev => prev.filter(id => !deletedIds.includes(id)));
            }
        } catch (e) {
            alert(e?.message || String(e));
        }
    };

    return (
        <Box sx={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column", gap: 1 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Airtable Items</Typography>
                <Stack direction="row" spacing={1}>
                    <Button variant="outlined" onClick={load} disabled={loading}>Refresh</Button>
                    <Button variant="contained" onClick={openAdd}>Add Item</Button>
                    <Tooltip title={selection.length ? `Delete ${selection.length} selected` : "Select rows to delete"}>
                        <span>
                            <Button color="error" variant="outlined" onClick={onDeleteSelected} disabled={selection.length === 0}>
                                Delete Selected
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>

            {error ? (
                <Box sx={{ color: "error.main" }}>{error}</Box>
            ) : (
                <DataGrid
                    rows={rows}
                    columns={columns}
                    loading={loading}
                    checkboxSelection
                    onRowSelectionModelChange={(m) => setSelection(m)}
                    rowSelectionModel={selection}
                    disableRowSelectionOnClick
                    pageSizeOptions={[10, 25, 50, 100]}
                    initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
                    processRowUpdate={processRowUpdate}
                    onProcessRowUpdateError={(err) => alert(err?.message || String(err))}
                    experimentalFeatures={{ newEditingApi: true }}
                />
            )}

            {/* Add dialog */}
            <Dialog open={addOpen} onClose={closeAdd} fullWidth maxWidth="sm">
                <DialogTitle>New Item</DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2} sx={{ mt: 0 }}>
                        <Grid item xs={12}><TextField label="Name *" fullWidth value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Grid>
                        <Grid item xs={6}><TextField label="Category" fullWidth value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></Grid>
                        <Grid item xs={6}><TextField label="Type" fullWidth value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} /></Grid>
                        <Grid item xs={6}><TextField label="Unit" fullWidth value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} /></Grid>
                        <Grid item xs={6}><TextField label="Sub Unit" fullWidth value={form.subUnit} onChange={e => setForm(f => ({ ...f, subUnit: e.target.value }))} /></Grid>
                        <Grid item xs={6}><TextField label="Sequence" fullWidth value={form.sequence} onChange={e => setForm(f => ({ ...f, sequence: e.target.value }))} /></Grid>
                        <Grid item xs={6}><TextField label="Item Code" fullWidth value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} /></Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeAdd} disabled={adding}>Cancel</Button>
                    <Button variant="contained" onClick={saveAdd} disabled={adding}>Save</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
