// src/PNIDReportView.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";

const TABS = [
    { id: "line", label: "Line List" },
    { id: "equipment", label: "Equipment List" },
    { id: "valve", label: "Valve List" },
    { id: "ctrl-valve", label: "Control Valve List" },
    { id: "relief", label: "Relief Valve List" },
    { id: "inline", label: "Inline List" },
    { id: "manifold", label: "Manifold List" },
];

export default function PNIDReportView() {
    const [activeTab, setActiveTab] = useState(
        () => localStorage.getItem("pnidReport:activeTab") || "line"
    );

    // Per-tab state maps
    const [blobs, setBlobs] = useState({});       // { [tabId]: blobUrl }
    const [names, setNames] = useState({});       // { [tabId]: fileName }
    const [loading, setLoading] = useState({});   // { [tabId]: bool }
    const [reloadKeys, setReloadKeys] = useState({}); // { [tabId]: number }

    const fileInputRef = useRef(null);

    useEffect(() => {
        localStorage.setItem("pnidReport:activeTab", activeTab);
    }, [activeTab]);

    const currentBlob = blobs[activeTab] || "";
    const currentName = names[activeTab] || "";
    const currentLoading = !!loading[activeTab];
    const currentReloadKey = reloadKeys[activeTab] || 0;

    const openPicker = () => fileInputRef.current?.click();

    const onPickFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;

        // Revoke old blob for this tab if exists
        const old = blobs[activeTab];
        if (old) {
            try { URL.revokeObjectURL(old); } catch { }

            // remove old first to avoid leaks
            setBlobs(prev => ({ ...prev, [activeTab]: undefined }));
        }

        const url = URL.createObjectURL(f);
        setBlobs(prev => ({ ...prev, [activeTab]: url }));
        setNames(prev => ({ ...prev, [activeTab]: f.name || "local.html" }));
        setLoading(prev => ({ ...prev, [activeTab]: true }));
        setReloadKeys(prev => ({ ...prev, [activeTab]: (prev[activeTab] || 0) + 1 }));
        e.target.value = ""; // allow picking the same file again later
    };

    const clearFile = () => {
        const old = blobs[activeTab];
        if (old) {
            try { URL.revokeObjectURL(old); } catch { }
        }
        setBlobs(prev => {
            const n = { ...prev }; delete n[activeTab]; return n;
        });
        setNames(prev => {
            const n = { ...prev }; delete n[activeTab]; return n;
        });
        setLoading(prev => {
            const n = { ...prev }; delete n[activeTab]; return n;
        });
        setReloadKeys(prev => {
            const n = { ...prev }; delete n[activeTab]; return n;
        });
    };

    // Cleanup all blobs when the component unmounts
    useEffect(() => {
        return () => {
            Object.values(blobs).forEach((u) => {
                if (u) try { URL.revokeObjectURL(u); } catch { }
            });
        };
    }, [blobs]);

    const styles = useMemo(() => {
        const btn = {
            padding: "6px 10px",
            borderRadius: 8,
            background: "#111",
            color: "#fff",
            border: "1px solid #111",
            cursor: "pointer",
        };
        const btnLight = {
            padding: "6px 10px",
            borderRadius: 8,
            background: "#fff",
            color: "#111",
            border: "1px solid #ddd",
            cursor: "pointer",
        };
        const tab = (active) => ({
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: active ? "#111" : "#fff",
            color: active ? "#fff" : "#111",
            cursor: "pointer",
            whiteSpace: "nowrap",
        });
        return { btn, btnLight, tab };
    }, []);

    return (
        <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr" }}>
            {/* Tabs row */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 10px",
                    borderBottom: "1px solid #eee",
                    background: "#fafafa",
                    flexWrap: "wrap",
                }}
            >
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        style={styles.tab(activeTab === t.id)}
                        title={t.label}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Controls for the active tab */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderBottom: "1px solid #eee",
                    background: "#fff",
                    flexWrap: "wrap",
                }}
            >
                <button onClick={openPicker} style={styles.btn}>
                    Load HTML for “{TABS.find(t => t.id === activeTab)?.label}”
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm"
                    onChange={onPickFile}
                    style={{ display: "none" }}
                />

                {currentBlob ? (
                    <>
                        <span style={{ fontSize: 12, color: "#555" }}>{currentName}</span>
                        <button onClick={clearFile} style={styles.btnLight}>Clear</button>
                        <button
                            onClick={() => window.open(currentBlob, "_blank")}
                            style={styles.btnLight}
                        >
                            Open in new tab
                        </button>
                    </>
                ) : (
                    <span style={{ fontSize: 12, color: "#666" }}>
                        Pick an HTML file exported by Report Creator.
                    </span>
                )}

                <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                    {currentLoading && "Loading…"}
                </div>
            </div>

            {/* Body */}
            {!currentBlob ? (
                <div style={{ padding: 16, color: "#666", lineHeight: 1.5 }}>
                    No report loaded for <b>{TABS.find(t => t.id === activeTab)?.label}</b>. Click
                    {" "}
                    <b>Load HTML</b> and select the corresponding report.
                    <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
                        Tip: If the report references external assets (CSS/images/JS files),
                        browsers may block loading them locally inside an iframe. Prefer a
                        <b> single-file HTML</b> export (self-contained) or export as PDF.
                    </div>
                </div>
            ) : (
                <div style={{ position: "relative" }}>
                    {currentLoading && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "rgba(255,255,255,0.6)",
                                zIndex: 2,
                                backdropFilter: "blur(2px)",
                            }}
                        >
                            <div style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", background: "#fff", color: "#333" }}>
                                Loading report…
                            </div>
                        </div>
                    )}
                    <iframe
                        key={activeTab + ":" + currentReloadKey}
                        title={`PNID Report - ${TABS.find(t => t.id === activeTab)?.label}`}
                        src={currentBlob}
                        style={{ width: "100%", height: "100vh", border: "none" }}
                        onLoad={() => setLoading(prev => ({ ...prev, [activeTab]: false }))}
                    />
                </div>
            )}
        </div>
    );
}
