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

const TOOLS = {
    NONE: "none",
    TEXT: "text",
    LINE: "line",
};

export default function PNIDReportView() {
    const [activeTab, setActiveTab] = useState(
        () => localStorage.getItem("pnidReport:activeTab") || "line"
    );

    // Per-tab data
    const [htmlText, setHtmlText] = useState({});         // { tabId: string (HTML) }
    const [fileName, setFileName] = useState({});         // { tabId: string }
    const [reloadKey, setReloadKey] = useState({});       // { tabId: number }
    const [editEnabled, setEditEnabled] = useState({});   // { tabId: boolean } (contentEditable)
    const [tool, setTool] = useState(TOOLS.NONE);         // active drawing tool (shared)
    const [ann, setAnn] = useState({});                   // { tabId: { lines:[], texts:[] } }

    // for drawing state (not persisted)
    const drawingRef = useRef({ isDown: false, x1: 0, y1: 0 });

    const fileInputRef = useRef(null);
    const iframeRef = useRef(null);

    useEffect(() => {
        localStorage.setItem("pnidReport:activeTab", activeTab);
    }, [activeTab]);

    // Helpers to read/write per-tab values
    const get = (obj, def) => obj[activeTab] ?? def;
    const setForTab = (setter) => (valueOrFn) =>
        setter((prev) => ({
            ...prev,
            [activeTab]: typeof valueOrFn === "function" ? valueOrFn(prev[activeTab]) : valueOrFn,
        }));

    const setHtmlForTab = setForTab(setHtmlText);
    const setNameForTab = setForTab(setFileName);
    const bumpReloadForTab = () =>
        setReloadKey((prev) => ({ ...prev, [activeTab]: (prev?.[activeTab] || 0) + 1 }));
    const setEditForTab = setForTab(setEditEnabled);

    const currentHtml = get(htmlText, "");
    const currentName = get(fileName, "");
    const currentReload = get(reloadKey, 0);
    const isEditingPage = !!get(editEnabled, false);
    const currentAnn = get(ann, { lines: [], texts: [] });

    const styles = useMemo(() => {
        const btn = { padding: "6px 10px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #111", cursor: "pointer" };
        const btnLight = { padding: "6px 10px", borderRadius: 8, background: "#fff", color: "#111", border: "1px solid #ddd", cursor: "pointer" };
        const tab = (active) => ({
            padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd",
            background: active ? "#111" : "#fff", color: active ? "#fff" : "#111",
            cursor: "pointer", whiteSpace: "nowrap"
        });
        const toolBtn = (active) => ({
            padding: "6px 10px", borderRadius: 8,
            background: active ? "#111" : "#fff",
            color: active ? "#fff" : "#111",
            border: "1px solid #ddd", cursor: "pointer",
        });
        return { btn, btnLight, tab, toolBtn };
    }, []);

    // Load .html file as text for this tab
    const openPicker = () => fileInputRef.current?.click();
    const onPickFile = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        e.target.value = "";
        const text = await f.text().catch(() => "");
        setHtmlForTab(text || "<!-- empty file -->");
        setNameForTab(f.name || "report.html");
        setEditForTab(false);
        setAnn((prev) => ({ ...prev, [activeTab]: { lines: [], texts: [] } })); // clear annotations for new file
        bumpReloadForTab();
    };

    // Inject overlay div+svg inside the iframe document (so it scrolls with page)
    const ensureOverlay = () => {
        const iframe = iframeRef.current;
        if (!iframe) return null;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return null;

        // (1) contentEditable toggle
        doc.body.contentEditable = isEditingPage ? "true" : "false";
        doc.body.style.caretColor = isEditingPage ? "auto" : "";
        doc.body.style.outline = isEditingPage ? "" : "";

        // (2) overlay element
        let host = doc.getElementById("__pnid_overlay_host");
        if (!host) {
            host = doc.createElement("div");
            host.id = "__pnid_overlay_host";
            host.style.position = "fixed";
            host.style.inset = "0";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = tool === TOOLS.NONE || isEditingPage ? "none" : "auto";
            // SVG inside for shapes
            const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("id", "__pnid_overlay_svg");
            svg.setAttribute("width", "100%");
            svg.setAttribute("height", "100%");
            svg.style.pointerEvents = "none";
            host.appendChild(svg);
            doc.body.appendChild(host);
        } else {
            host.style.pointerEvents = tool === TOOLS.NONE || isEditingPage ? "none" : "auto";
        }
        return { doc, host, svg: doc.getElementById("__pnid_overlay_svg") };
    };

    // Render current annotations into the iframe's SVG overlay
    const renderOverlay = () => {
        const r = ensureOverlay();
        if (!r || !r.svg) return;
        const { svg } = r;

        // clear
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        // lines
        (currentAnn.lines || []).forEach((ln) => {
            const el = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "line");
            el.setAttribute("x1", String(ln.x1));
            el.setAttribute("y1", String(ln.y1));
            el.setAttribute("x2", String(ln.x2));
            el.setAttribute("y2", String(ln.y2));
            el.setAttribute("stroke", ln.color || "#e53935");
            el.setAttribute("stroke-width", String(ln.width || 2));
            el.setAttribute("stroke-linecap", "round");
            svg.appendChild(el);
        });

        // texts
        (currentAnn.texts || []).forEach((tx) => {
            const el = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "text");
            el.setAttribute("x", String(tx.x));
            el.setAttribute("y", String(tx.y));
            el.setAttribute("fill", tx.color || "#1565c0");
            el.setAttribute("font-size", String(tx.size || 14));
            el.setAttribute("font-family", "system-ui, Segoe UI, Roboto, Helvetica, Arial");
            el.textContent = tx.text || "";
            svg.appendChild(el);
        });
    };

    // Attach drawing handlers on overlay host
    const attachOverlayEvents = () => {
        const r = ensureOverlay();
        if (!r || !r.host) return;
        const { host, doc } = r;

        // Remove previous to avoid doubling
        host.onmousedown = null;
        host.onmousemove = null;
        host.onmouseup = null;
        host.onclick = null;

        if (tool === TOOLS.LINE) {
            host.onmousedown = (ev) => {
                drawingRef.current.isDown = true;
                const rect = host.getBoundingClientRect();
                drawingRef.current.x1 = ev.clientX - rect.left;
                drawingRef.current.y1 = ev.clientY - rect.top;
            };
            host.onmouseup = (ev) => {
                if (!drawingRef.current.isDown) return;
                const rect = host.getBoundingClientRect();
                const x2 = ev.clientX - rect.left;
                const y2 = ev.clientY - rect.top;
                drawingRef.current.isDown = false;

                setAnn((prev) => {
                    const perTab = prev[activeTab] || { lines: [], texts: [] };
                    const next = {
                        ...prev,
                        [activeTab]: {
                            ...perTab,
                            lines: [...(perTab.lines || []), { x1: drawingRef.current.x1, y1: drawingRef.current.y1, x2, y2 }],
                        },
                    };
                    return next;
                });
            };
        } else if (tool === TOOLS.TEXT) {
            host.onclick = (ev) => {
                const rect = host.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                const y = ev.clientY - rect.top;
                const text = window.prompt("Comment text:", "");
                if (!text) return;
                setAnn((prev) => {
                    const perTab = prev[activeTab] || { lines: [], texts: [] };
                    const next = {
                        ...prev,
                        [activeTab]: {
                            ...perTab,
                            texts: [...(perTab.texts || []), { x, y, text }],
                        },
                    };
                    return next;
                });
            };
        }
    };

    // Recreate overlay + handlers on load / tool changes / page-edit toggle / reload
    useEffect(() => {
        // small delay so iframe has rendered srcDoc
        const t = setTimeout(() => {
            ensureOverlay();
            attachOverlayEvents();
            renderOverlay();
        }, 0);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, currentHtml, currentReload, tool, isEditingPage]);

    // Re-render overlay when annotations change
    useEffect(() => {
        renderOverlay();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ann, activeTab]);

    // Clear annotations for current tab
    const clearAnnotations = () => {
        setAnn((prev) => ({ ...prev, [activeTab]: { lines: [], texts: [] } }));
    };

    // Toggle editing text inside the page itself (contentEditable)
    const toggleEditPage = () => {
        setEditForTab((v) => !v);
        setTool(TOOLS.NONE); // disable drawing when editing page text
        // overlay pointerEvents will auto update via ensureOverlay()
        // we also bump reload to re-run ensureOverlay under some browsers
        bumpReloadForTab();
    };

    // Save current page (with in-page text edits) + static overlay into a new .html
    const saveAs = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;

        // ensure overlay exists & reflects current annotations
        ensureOverlay();
        renderOverlay();

        // make overlay non-interactive for saved file
        const host = doc.getElementById("__pnid_overlay_host");
        if (host) {
            host.style.pointerEvents = "none";
        }
        // turn off contentEditable for saved version
        doc.body.contentEditable = "false";

        const html = "<!doctype html>\n" + doc.documentElement.outerHTML;
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = (currentName || "report") + ".annotated.html";
        a.href = url;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            // restore contentEditable flag in the live preview if it was on
            doc.body.contentEditable = isEditingPage ? "true" : "false";
            if (host) host.style.pointerEvents = tool === TOOLS.NONE || isEditingPage ? "none" : "auto";
        }, 0);
    };

    return (
        <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr" }}>
            {/* Tabs */}
            <div
                style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
                    borderBottom: "1px solid #eee", background: "#fafafa", flexWrap: "wrap",
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
                    borderBottom: "1px solid #eee", background: "#fff", flexWrap: "wrap",
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

                {currentName ? (
                    <span style={{ fontSize: 12, color: "#555" }}>{currentName}</span>
                ) : (
                    <span style={{ fontSize: 12, color: "#666" }}>No file loaded</span>
                )}

                <span style={{ width: 12 }} />

                <button
                    onClick={toggleEditPage}
                    style={styles.btnLight}
                    disabled={!currentHtml}
                    title="Toggle editing text inside the page"
                >
                    {isEditingPage ? "Disable page text edit" : "Enable page text edit"}
                </button>

                <span style={{ width: 6 }} />

                {/* Tools */}
                <button
                    onClick={() => setTool(TOOLS.NONE)}
                    style={styles.toolBtn(tool === TOOLS.NONE)}
                    disabled={!currentHtml || isEditingPage}
                    title="Pointer (no drawing)"
                >
                    Pointer
                </button>
                <button
                    onClick={() => setTool(TOOLS.LINE)}
                    style={styles.toolBtn(tool === TOOLS.LINE)}
                    disabled={!currentHtml || isEditingPage}
                    title="Draw line"
                >
                    Line
                </button>
                <button
                    onClick={() => setTool(TOOLS.TEXT)}
                    style={styles.toolBtn(tool === TOOLS.TEXT)}
                    disabled={!currentHtml || isEditingPage}
                    title="Place text comment"
                >
                    Text
                </button>

                <button
                    onClick={clearAnnotations}
                    style={styles.btnLight}
                    disabled={!currentHtml || ((currentAnn.lines || []).length + (currentAnn.texts || []).length === 0)}
                    title="Remove all annotations on this tab"
                >
                    Clear annotations
                </button>

                <button
                    onClick={saveAs}
                    style={styles.btnLight}
                    disabled={!currentHtml}
                    title="Save current HTML with annotations"
                >
                    Save As (.annotated.html)
                </button>
            </div>

            {/* Viewer */}
            {!currentHtml ? (
                <div style={{ padding: 16, color: "#666", lineHeight: 1.5 }}>
                    No report loaded for <b>{TABS.find(t => t.id === activeTab)?.label}</b>. Click <b>Load HTML</b> to select
                    your Report Creator export.
                    <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
                        Tip: Prefer a <b>single-file HTML</b> export so styles/images work locally.
                        Use the toolbar to <b>edit text in the page</b>, drop <b>Text</b> comments, or draw a <b>Line</b>.
                    </div>
                </div>
            ) : (
                <iframe
                    key={activeTab + ":" + currentReload}
                    ref={iframeRef}
                    title={`PNID Review - ${TABS.find(t => t.id === activeTab)?.label}`}
                    srcDoc={currentHtml}
                    style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                    onLoad={() => {
                        // after reload, rebuild overlay with current settings & annotations
                        ensureOverlay();
                        attachOverlayEvents();
                        renderOverlay();
                    }}
                />
            )}
        </div>
    );
}
