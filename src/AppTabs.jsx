// AppTabs.jsx
import React from "react";
import AirtableItemsTable from "./AirtableItemsTable.jsx"; // Tab 1
import PNIDCanvas from "./pnidCanvas.jsx";                 // Tab 2

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
                fontWeight: active ? 600 : 400,
            }}
        >
            {children}
        </button>
    );
}

const TAB_TO_INDEX = { data: 0, canvas: 1, "3d": 2 };
const INDEX_TO_TAB = ["data", "canvas", "3d"];

export default function AppTabs() {
    const [tab, setTab] = React.useState(0); // 0=Data, 1=2D, 2=3D

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

    // Expose global tab controls so MainToolbar can switch tabs
    React.useEffect(() => {
        window.setAppTab = (nameOrIndex) => {
            let idx =
                typeof nameOrIndex === "number"
                    ? nameOrIndex
                    : TAB_TO_INDEX[nameOrIndex] ?? 1; // default to 2D if unknown
            idx = Math.max(0, Math.min(2, idx));
            setTab(idx);
            // notify listeners (e.g., toolbar) which named tab is active
            window.dispatchEvent(
                new CustomEvent("appTabChanged", { detail: { tab: INDEX_TO_TAB[idx] } })
            );
        };
        window.getAppTab = () => INDEX_TO_TAB[tab];

        // Optional: support generic events (if you ever use them)
        const onSet = (e) => window.setAppTab?.(e?.detail);
        const onNext = () => window.setAppTab?.(tab + 1);
        const onPrev = () => window.setAppTab?.(tab - 1);
        window.addEventListener("tabs:set", onSet);
        window.addEventListener("tabs:next", onNext);
        window.addEventListener("tabs:prev", onPrev);

        return () => {
            delete window.setAppTab;
            delete window.getAppTab;
            window.removeEventListener("tabs:set", onSet);
            window.removeEventListener("tabs:next", onNext);
            window.removeEventListener("tabs:prev", onPrev);
        };
    }, [tab]);

    return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            {/* Tabs header */}
            <div style={{ display: "flex", gap: 6, padding: 8, borderBottom: "1px solid #e1e1e1" }}>
                <TabButton active={tab === 0} onClick={() => setTab(0)}>
                    Items (Airtable)
                </TabButton>
                <TabButton active={tab === 1} onClick={() => setTab(1)}>
                    2D Canvas
                </TabButton>
                <TabButton active={tab === 2} onClick={() => setTab(2)}>
                    3D View (soon)
                </TabButton>
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
