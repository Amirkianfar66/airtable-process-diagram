// AppTabs.jsx
import React from "react";
import AirtableItemsTable from "./AirtableItemsTable.jsx"; // Tab 1
const ProcessDiagram = React.lazy(() => import("./ProcessDiagram.jsx")); // Tab 2 (lazy)
import ErrorBoundary from "./ErrorBoundary.jsx";

// ---------- define safe globals ASAP (before React runs) ----------
if (typeof window !== "undefined") {
    if (typeof window.setAppTab !== "function") {
        window.setAppTab = (nameOrIndex) => {
            window.__pendingSetAppTab = nameOrIndex;
            window.dispatchEvent(new CustomEvent("tabs:set", { detail: nameOrIndex }));
        };
    }
    if (typeof window.getAppTab !== "function") {
        window.getAppTab = () => "canvas";
    }
}

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

    // Keep PNID in React; start from global if present
    const [pnid, setPnid] = React.useState(() => window.__pnid || { nodes: [], edges: [] });

    // Mirror PNID for /api/ai-generate context
    React.useEffect(() => {
        window.__pnid = pnid;
    }, [pnid]);

    // Listen for external PNID updates
    React.useEffect(() => {
        const onUpdate = (e) => { if (e?.detail) setPnid(e.detail); };
        window.addEventListener("pnid:update", onUpdate);
        return () => window.removeEventListener("pnid:update", onUpdate);
    }, []);

    // Install the REAL global tab API once mounted
    React.useEffect(() => {
        const realSetAppTab = (nameOrIndex) => {
            let idx = typeof nameOrIndex === "number" ? nameOrIndex : TAB_TO_INDEX[nameOrIndex] ?? 1;
            idx = Math.max(0, Math.min(2, idx));
            setTab(idx);
            window.dispatchEvent(new CustomEvent("appTabChanged", { detail: { tab: INDEX_TO_TAB[idx] } }));
        };

        window.setAppTab = realSetAppTab;
        window.getAppTab = () => INDEX_TO_TAB[tab];

        if (window.__pendingSetAppTab !== undefined) {
            const pending = window.__pendingSetAppTab;
            delete window.__pendingSetAppTab;
            realSetAppTab(pending);
        }

        const onSet = (e) => realSetAppTab(e?.detail);
        const onNext = () => realSetAppTab(tab + 1);
        const onPrev = () => realSetAppTab(tab - 1);
        window.addEventListener("tabs:set", onSet);
        window.addEventListener("tabs:next", onNext);
        window.addEventListener("tabs:prev", onPrev);

        return () => {
            window.removeEventListener("tabs:set", onSet);
            window.removeEventListener("tabs:next", onNext);
            window.removeEventListener("tabs:prev", onPrev);
        };
    }, [tab]);

    return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            {/* Tabs header */}
            <div style={{ display: "flex", gap: 6, padding: 8, borderBottom: "1px solid #e1e1e1" }}>
                <TabButton active={tab === 0} onClick={() => window.setAppTab(0)}>Items (Airtable)</TabButton>
                <TabButton active={tab === 1} onClick={() => window.setAppTab(1)}>2D Canvas</TabButton>
                <TabButton active={tab === 2} onClick={() => window.setAppTab(2)}>3D View (soon)</TabButton>
            </div>

            {/* Tabs content */}
            <div style={{ flex: 1, minHeight: 0 }}>
                {/* Tab 1: Items table */}
                {tab === 0 ? (
                    <div style={{ height: "100%" }}>
                        <AirtableItemsTable />
                    </div>
                ) : null}

                {/* Tab 2: your 2D canvas (lazy + boundary; only mounts when active) */}
                {tab === 1 ? (
                    <div style={{ height: "100%" }}>
                        <React.Suspense fallback={<div style={{ padding: 12 }}>Loading canvas…</div>}>
                            <ErrorBoundary>
                                <ProcessDiagram />
                            </ErrorBoundary>
                        </React.Suspense>
                    </div>
                ) : null}

                {/* Tab 3: placeholder */}
                {tab === 2 ? <div style={{ padding: 16 }}>3D preview coming soon…</div> : null}
            </div>
        </div>
    );
}
