// AppTabs.jsx
import React from "react";
import AirtableItemsTable from "./AirtableItemsTable.jsx"; // Tab 1 (you already created this)
import PNIDCanvas from "./pnidCanvas.jsx";                 // Tab 2 (your existing canvas)

function TabButton({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "8px 14px",
                border: "1px solid #ddd",
                borderBottom: active ? "2px solid #111" : "1px solid #ddd",
                background: active ? "#fff" : "#f8f8f8",
                cursor: "pointer",
                fontWeight: active ? 600 : 400
            }}
        >
            {children}
        </button>
    );
}

export default function AppTabs() {
    const [tab, setTab] = React.useState(0);

    // Keep PNID state inside React; start from global if present
    const [pnid, setPnid] = React.useState(() => window.__pnid || { nodes: [], edges: [] });

    // Keep the global mirror updated so /api/ai-generate has context
    React.useEffect(() => {
        window.__pnid = pnid;
    }, [pnid]);

    // Listen for external updates (from sendMessage in your entry file)
    React.useEffect(() => {
        function onUpdate(e) {
            if (e?.detail) setPnid(e.detail);
        }
        window.addEventListener("pnid:update", onUpdate);
        return () => window.removeEventListener("pnid:update", onUpdate);
    }, []);

    return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            {/* Tabs header */}
            <div style={{ display: "flex", gap: 6, padding: 8, borderBottom: "1px solid #e1e1e1" }}>
                <TabButton active={tab === 0} onClick={() => setTab(0)}>Items (Airtable)</TabButton>
                <TabButton active={tab === 1} onClick={() => setTab(1)}>2D Canvas</TabButton>
                <TabButton active={tab === 2} onClick={() => setTab(2)}>3D View (soon)</TabButton>
            </div>

            {/* Tabs content */}
            <div style={{ flex: 1, minHeight: 0 }}>
                {/* Tab 1: Items table */}
                <div style={{ display: tab === 0 ? "block" : "none", height: "100%" }}>
                    <AirtableItemsTable />
                </div>

                {/* Tab 2: your existing 2D canvas */}
                <div style={{ display: tab === 1 ? "block" : "none", height: "100%" }}>
                    <PNIDCanvas pnid={pnid} />
                </div>

                {/* Tab 3: placeholder */}
                <div style={{ display: tab === 2 ? "block" : "none", padding: 16 }}>
                    3D preview coming soon…
                </div>
            </div>
        </div>
    );
}
