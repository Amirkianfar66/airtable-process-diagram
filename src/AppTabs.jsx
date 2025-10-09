// src/AppTabs.jsx
import React from "react";
import { Tabs, Tab, Box } from "@mui/material";
import ItemsTable from "./ItemsTable";
import ProcessDiagram from "./ProcessDiagram";

export default function AppTabs() {
    const [tab, setTab] = React.useState(0);

    return (
        <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
            >
                <Tab label="Items (Airtable)" />
                <Tab label="2D Canvas" />
                <Tab label="3D View (soon)" />
            </Tabs>

            <Box sx={{ flex: 1, overflow: "hidden" }}>
                {tab === 0 && (
                    <Box sx={{ p: 2, height: "100%", overflow: "auto" }}>
                        <ItemsTable />
                    </Box>
                )}
                {tab === 1 && (
                    <Box sx={{ height: "100%" }}>
                        <ProcessDiagram />
                    </Box>
                )}
                {tab === 2 && (
                    <Box sx={{ p: 2 }}>3D preview coming soon…</Box>
                )}
            </Box>
        </Box>
    );
}
