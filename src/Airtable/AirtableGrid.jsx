import { DataGrid } from "@mui/x-data-grid";
import { useEffect, useState } from "react";

export default function AirtableGrid() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/airtable");
      const { items } = await res.json();
      setRows(items.map(r => ({ id: r.id, ...r })));
      setLoading(false);
    };
    load();
  }, []);

  const columns = [
    { field: "Name", headerName: "Name", width: 200, editable: true },
    { field: "Item Code", headerName: "Code", width: 150, editable: true },
    { field: "Unit", headerName: "Unit", width: 150, editable: true },
    { field: "Sub Unit", headerName: "Sub Unit", width: 150, editable: true },
    { field: "Category Item Type", headerName: "Category", width: 200, editable: true },
    { field: "Type", headerName: "Type", width: 200, editable: true }
  ];

  const handleProcessRowUpdate = async (newRow) => {
    // Call PATCH on your Airtable API
    await fetch("/api/airtable", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: newRow.id, fields: newRow })
    });
    return newRow;
  };

  return (
    <div style={{ height: 600, width: "100%" }}>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        processRowUpdate={handleProcessRowUpdate}
        experimentalFeatures={{ newEditingApi: true }}
      />
    </div>
  );
}
