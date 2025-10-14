// src/PNIDReportView.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

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

    // Per-tab state
    const [htmlText, setHtmlText] = useState({});      // { tabId: string }
    const [fileName, setFileName] = useState({});      // { tabId: string }
    const [loading, setLoading] = useState({});      // { tabId: bool }
    const [editMode, setEditMode] = useState({});      // { tabId: bool }
    const [reloadKey, setReloadKey] = useState({});    // { tabId: number }
    const [fileHandle, setFileHandle] = useState({});  // { tabId: FileSystemFileHandle } (Chromium only)

    const fileInputRef = useRef(null);
    const supportsFS = typeof window.showSaveFilePicker === "function";

    useEffect(() => {
        localStorage.setItem("pnidReport:activeTab", activeTab);
    }, [activeTab]);

    // Helpers to get/set per-tab values
    const get = (obj, def) => obj[activeTab] ?? def;
    const setForTab = (setter) => (updater) =>
        setter((prev) => ({ ...prev, [activeTab]: typeof updater === "function" ? updater(prev[activeTab]) : updater }));

    const setHtmlForTab = setForTab(setHtmlText);
    const setNameForTab = setForTab(setFileName);
    const setLoadForTab = setForTab(setLoading);
    const setModeForTab = setForTab(setEditMode);
    const bumpReloadForTab = () =>
        setReloadKey((prev) => ({ ...prev, [activeTab]: (prev[activeTab] || 0) + 1 }));

    const currentHtml = get(htmlText, "");
    const currentName = get(fileName, "");
    const isLoading = !!get(loading, false);
    const isEditing = !!get(editMode, false);
    const currentReload = get(reloadKey, 0);
    const currentHandle = get(fileHandle, null);

    // UI styles
    const styles = useMemo(() => {
        const btn = {
            padding: "6px 10px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #111", cursor: "pointer"
        };
        const btnLight = {
            padding: "6px 10px", borderRadius: 8, background: "#fff", color: "#111", border: "1px solid #ddd", cursor: "pointer"
        };
        const tab = (active) => ({
            padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd",
            background: active ? "#111" : "#fff", color: active ? "#fff" : "#111",
            cursor: "pointer", whiteSpace: "nowrap"
        });
        return { btn, btnLight, tab };
    }, []);

    // Pick a local HTML file (input)
    const openPicker = () => fileInputRef.current?.click();

    const onPickFile = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        e.target.value = ""; // allow re-pick same file later

        setLoadForTab(true);
        setNameForTab(f.name || "report.html");
        setModeForTab(false);

        // Read as text for editing + preview
        const text = await f.text().catch(() => "");
        setHtmlForTab(text || "<!-- empty file -->");

        // Clear FS handle (this path uses <input>, not the FS API)
        setFileHandle((prev) => ({ ...prev, [activeTab]: null }));

        bumpReloadForTab();
        setLoadForTab(false);
    };

    // Optional: use File System Access API to open and keep a handle (Chrome/Edge)
    const openWithFSAPI = async () => {
        if (!supportsFS) return;
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: "HTML", accept: { "text/html": [".html", ".htm"] } }],
                multiple: false,
            });
            const file = await handle.getFile();
            const text = await file.text();

            setFileHandle((prev) => ({ ...prev, [activeTab]: handle }));
            setNameForTab(file.name || "report.html");
            setHtmlForTab(text);
            setModeForTab(false);
            bumpReloadForTab();
        } catch {
            // user cancelled
        }
    };

    // Save As: download edited HTML (works in all browsers)
    const saveAsDownload = () => {
        const text = currentHtml || "";
        const blob = new Blob([text], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = (currentName || "report") + ".html";
        a.href = url;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    };

    // Save to Disk: File System Access API (Chrome/Edge)
    const saveToDisk = async () => {
        if (!supportsFS) return;
        try {
            let handle = currentHandle;
            if (!handle) {
                handle = await window.showSaveFilePicker({
                    suggestedName: currentName || "report.html",
                    types: [{ description: "HTML", accept: { "text/html": [".html", ".htm"] } }],
                });
                setFileHandle((prev) => ({ ...prev, [activeTab]: handle }));
            }
            const writable = await handle.createWritable();
            await writable.write(new Blob([currentHtml || ""], { type: "text/html;charset=utf-8" }));
            await writable.close();
            // optional: toast
        } catch {
            // user cancelled or permissions issue
        }
    };

    const clearTab = () => {
        setHtmlForTab("");
        setNameForTab("");
        setModeForTab(false);
        setFileHandle((prev) => ({ ...prev, [activeTab]: null }));
        bumpReloadForTab();
    };

    // Iframe preview: use srcDoc so edited HTML is previewed live
    // NOTE: external relative assets referenced by the HTML will not resolve from srcDoc.
    // Prefer single-file HTML exports (self-contained) from Report Creator.
    const iframeProps = isEditing || currentHtml
        ? { srcDoc: currentHtml }
        : { srcDoc: "" };

    return (
        <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr" }}>
            {/* Tabs */}
            <div
                style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
                    borderBottom: "1px solid #eee", background: "#fafafa", flexWrap: "wrap"
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

            {/* Controls */}
            <div
                style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    borderBottom: "1px solid #eee", background: "#fff", flexWrap: "wrap"
                }}
            >
                <button onClick={openPicker} style={styles.btn}>Load HTML</button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm"
                    onChange={onPickFile}
                    style={{ display: "none" }}
                />
                {supportsFS && (
                    <button onClick={openWithFSAPI} style={styles.btnLight} title="Open with File System Access (Chrome/Edge)">
                        Open (advanced)
                    </button>
                )}

                {currentName ? (
                    <span style={{ fontSize: 12, color: "#555" }}>{currentName}</span>
                ) : (
                    <span style={{ fontSize: 12, color: "#666" }}>No file loaded</span>
                )}

                <span style={{ width: 12 }} />

                <button
                    onClick={() => setModeForTab((v) => !v)}
                    style={styles.btnLight}
                    disabled={!currentHtml}
                >
                    {isEditing ? "Preview" : "Edit"}
                </button>

                <button onClick={saveAsDownload} style={styles.btnLight} disabled={!currentHtml}>Save As (.html)</button>

                {supportsFS && (
                    <button onClick={saveToDisk} style={styles.btnLight} disabled={!currentHtml}>
                        Save to Disk
                    </button>
                )}

                <button onClick={clearTab} style={styles.btnLight} disabled={!currentHtml && !currentName}>
                    Clear
                </button>

                <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                    {isLoading && "Loading…"}
                </div>
            </div>

            {/* Body */}
            {!currentHtml ? (
                <div style={{ padding: 16, color: "#666", lineHeight: 1.5 }}>
                    No report loaded for <b>{TABS.find(t => t.id === activeTab)?.label}</b>. Click <b>Load HTML</b> and pick
                    the exported Report Creator HTML.
                    <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
                        Tip: For best results, export a <b>single-file</b> (self-contained) HTML.
                        Relative CSS/JS/images referenced by the HTML will not load from an inline preview.
                    </div>
                </div>
            ) : (
                <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
                    {/* Editor (left) */}
                    {isEditing && (
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", borderRight: "1px solid #eee" }}>
                            <div style={{ padding: 8, fontSize: 12, color: "#666", borderBottom: "1px solid #f0f0f0" }}>
                                Editing: {currentName || "report.html"}
                            </div>
                            <textarea
                                value={currentHtml}
                                onChange={(e) => setHtmlForTab(e.target.value)}
                                spellCheck={false}
                                style={{
                                    flex: 1, width: "100%", padding: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                                    fontSize: 12, border: "none", outline: "none", resize: "none"
                                }}
                            />
                        </div>
                    )}

                    {/* Preview (right) */}
                    <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                        {isLoading && (
                            <div style={{
                                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                background: "rgba(255,255,255,0.6)", zIndex: 2, backdropFilter: "blur(2px)"
                            }}>
                                <div style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", background: "#fff", color: "#333" }}>
                                    Loading…
                                </div>
                            </div>
                        )}
                        <iframe
                            key={activeTab + ":" + currentReload}
                            title={`Preview - ${TABS.find(t => t.id === activeTab)?.label}`}
                            style={{ width: "100%", height: "100%", border: "none" }}
                            {...iframeProps}
                            onLoad={() => setLoadForTab(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
