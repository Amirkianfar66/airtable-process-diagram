// src/PNIDReportView.jsx
import React, { useEffect, useRef, useState } from "react";

export default function PNIDReportView() {
    const fileInputRef = useRef(null);
    const [blobUrl, setBlobUrl] = useState("");
    const [fileName, setFileName] = useState("");
    const [loading, setLoading] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const openPicker = () => fileInputRef.current?.click();

    const onPickFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;

        // revoke old blob if any
        if (blobUrl) {
            try { URL.revokeObjectURL(blobUrl); } catch { }
        }

        const url = URL.createObjectURL(f);
        setBlobUrl(url);
        setFileName(f.name || "local.html");
        setLoading(true);
        setReloadKey((k) => k + 1);
        e.target.value = ""; // allow selecting the same file again later
    };

    const clearFile = () => {
        if (blobUrl) {
            try { URL.revokeObjectURL(blobUrl); } catch { }
        }
        setBlobUrl("");
        setFileName("");
        setReloadKey((k) => k + 1);
    };

    // cleanup on unmount
    useEffect(() => {
        return () => {
            if (blobUrl) {
                try { URL.revokeObjectURL(blobUrl); } catch { }
            }
        };
    }, [blobUrl]);

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

    return (
        <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateRows: "auto 1fr" }}>
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderBottom: "1px solid #eee",
                    background: "#fafafa",
                    flexWrap: "wrap",
                }}
            >
                <button onClick={openPicker} style={btn}>Load HTML from my PC</button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm"
                    onChange={onPickFile}
                    style={{ display: "none" }}
                />
                {blobUrl ? (
                    <>
                        <span style={{ fontSize: 12, color: "#555" }}>{fileName}</span>
                        <button onClick={clearFile} style={btnLight}>Clear</button>
                    </>
                ) : (
                    <span style={{ fontSize: 12, color: "#666" }}>
                        Choose an HTML report exported by Report Creator.
                    </span>
                )}
                <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                    {loading && "Loading…"}
                </div>
            </div>

            {/* Body */}
            {!blobUrl ? (
                <div style={{ padding: 16, color: "#666", lineHeight: 1.5 }}>
                    No report loaded. Click <b>Load HTML from my PC</b> and pick your Plant 3D Report Creator HTML file.
                    <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
                        Tip: if your HTML references extra files (CSS/images/JS in sibling folders),
                        browsers may block loading them from disk. Use a <b>single-file HTML</b> export, or export as <b>PDF</b>.
                    </div>
                </div>
            ) : (
                <div style={{ position: "relative" }}>
                    {loading && (
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
                        key={reloadKey}
                        title="PNID Report (Local HTML)"
                        src={blobUrl}
                        style={{ width: "100%", height: "100vh", border: "none" }}
                        onLoad={() => setLoading(false)}
                    />
                </div>
            )}
        </div>
    );
}
