import React, { useEffect, useMemo, useRef, useState } from "react";

/** Tabs */
const TABS = [
    { id: "line", label: "Line List" },
    { id: "equipment", label: "Equipment List" },
    { id: "valve", label: "Valve List" },
    { id: "ctrl-valve", label: "Control Valve List" },
    { id: "relief", label: "Relief Valve List" },
    { id: "inline", label: "Inline List" },
    { id: "manifold", label: "Manifold List" },
];

/** Review tools */
const TOOLS = { NONE: "none", TEXT: "text", LINE: "line" };

/** Small path resolver for ../ and ./ */
function resolveRelPath(baseDir, rel) {
    if (/^https?:\/\//i.test(rel) || /^data:/i.test(rel)) return rel;
    if (rel.startsWith("/")) return rel.replace(/^\/+/, "");
    const base = (baseDir || "").split("/").filter(Boolean);
    const parts = rel.split("/").filter(Boolean);
    const out = [...base];
    for (const p of parts) {
        if (p === ".") continue;
        if (p === "..") out.pop();
        else out.push(p);
    }
    return out.join("/");
}

async function fileToDataURL(fileHandle) {
    const file = await fileHandle.getFile();
    const buf = await file.arrayBuffer();
    const mime =
        file.type ||
        ({
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            svg: "image/svg+xml",
            webp: "image/webp",
            css: "text/css",
            js: "text/javascript",
            html: "text/html",
        }[file.name.split(".").pop().toLowerCase()] || "application/octet-stream");
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return `data:${mime};base64,${base64}`;
}

async function getHandleByPath(rootDirHandle, relPath) {
    const parts = relPath.split("/").filter(Boolean);
    if (!parts.length) return null;
    let dir = rootDirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
        try {
            dir = await dir.getDirectoryHandle(parts[i], { create: false });
        } catch {
            return null;
        }
    }
    try {
        return await dir.getFileHandle(parts[parts.length - 1], { create: false });
    } catch {
        return null;
    }
}

/** Inline url(...) in CSS text */
async function inlineCssUrls(cssText, rootDirHandle, cssBaseDir) {
    if (!rootDirHandle) return cssText;
    const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    const matches = [...cssText.matchAll(urlRe)];
    let out = cssText;
    for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        const raw = m[2];
        if (!raw || /^data:/i.test(raw) || /^https?:\/\//i.test(raw)) continue;
        const rel = resolveRelPath(cssBaseDir, raw);
        const fh = await getHandleByPath(rootDirHandle, rel);
        if (!fh) continue;
        const dataUrl = await fileToDataURL(fh);
        // replace this occurrence only
        out = out.slice(0, m.index) + `url(${dataUrl})` + out.slice(m.index + m[0].length);
    }
    return out;
}

/** Inline images, CSS, and scripts into the HTML string using a chosen folder */
async function inlineAssetsIntoHtml(htmlText, rootDirHandle) {
    if (!rootDirHandle) return htmlText;

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    // <img>
    const imgs = Array.from(doc.querySelectorAll("img[src]"));
    for (const img of imgs) {
        const src = img.getAttribute("src") || "";
        if (!src || /^https?:\/\//i.test(src) || /^data:/i.test(src)) continue;
        const fh = await getHandleByPath(rootDirHandle, resolveRelPath("", src));
        if (!fh) continue;
        img.setAttribute("src", await fileToDataURL(fh));
    }

    // <link rel="stylesheet">
    const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'));
    for (const link of links) {
        const href = link.getAttribute("href") || "";
        if (!href || /^https?:\/\//i.test(href) || /^data:/i.test(href)) continue;

        const relPath = resolveRelPath("", href);
        const baseDir = relPath.split("/").slice(0, -1).join("/");

        const fh = await getHandleByPath(rootDirHandle, relPath);
        if (!fh) continue;

        const file = await fh.getFile();
        let cssText = await file.text();

        // inline url(...) inside CSS
        cssText = await inlineCssUrls(cssText, rootDirHandle, baseDir);

        const style = doc.createElement("style");
        style.setAttribute("data-inlined-from", href);
        style.textContent = cssText;
        link.replaceWith(style);
    }

    // <script src="..."> -> inline (optional)
    const scripts = Array.from(doc.querySelectorAll("script[src]"));
    for (const s of scripts) {
        const src = s.getAttribute("src") || "";
        if (!src || /^https?:\/\//i.test(src) || /^data:/i.test(src)) continue;
        const fh = await getHandleByPath(rootDirHandle, resolveRelPath("", src));
        if (!fh) continue;
        const file = await fh.getFile();
        const jsText = await file.text();
        const inline = doc.createElement("script");
        inline.textContent = jsText;
        // copy type/defer if any
        if (s.type) inline.type = s.type;
        if (s.defer) inline.defer = true;
        if (s.async) inline.async = true;
        s.replaceWith(inline);
    }

    // Return serialized HTML (keep doctype)
    return "<!doctype html>\n" + doc.documentElement.outerHTML;
}

export default function PNIDReportView() {
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem("pnidReport:activeTab") || "line");

    // Per-tab state
    const [htmlText, setHtmlText] = useState({});          // raw/edited HTML
    const [fileName, setFileName] = useState({});          // original file name
    const [reloadKey, setReloadKey] = useState({});        // bump to refresh iframe
    const [editEnabled, setEditEnabled] = useState({});    // contentEditable flag
    const [ann, setAnn] = useState({});                    // { id: { lines:[], texts:[] } }
    const [tool, setTool] = useState(TOOLS.NONE);          // current drawing tool (shared)
    const [assetsDir, setAssetsDir] = useState({});        // { id: DirectoryHandle }
    const [isInlining, setIsInlining] = useState(false);

    const drawingRef = useRef({ isDown: false, x1: 0, y1: 0 });
    const fileInputRef = useRef(null);
    const iframeRef = useRef(null);

    const supportsDirPicker = typeof window.showDirectoryPicker === "function";

    useEffect(() => {
        localStorage.setItem("pnidReport:activeTab", activeTab);
    }, [activeTab]);

    // Helpers (per-tab setters/getters)
    const get = (obj, def) => obj[activeTab] ?? def;
    const setForTab = (setter) => (valOrFn) =>
        setter((prev) => ({ ...prev, [activeTab]: typeof valOrFn === "function" ? valOrFn(prev[activeTab]) : valOrFn }));

    const setHtmlForTab = setForTab(setHtmlText);
    const setNameForTab = setForTab(setFileName);
    const setEditForTab = setForTab(setEditEnabled);
    const setDirForTab = setForTab(setAssetsDir);
    const bumpReloadForTab = () => setReloadKey((p) => ({ ...p, [activeTab]: (p?.[activeTab] || 0) + 1 }));

    const currentHtml = get(htmlText, "");
    const currentName = get(fileName, "");
    const currentReload = get(reloadKey, 0);
    const isEditingPage = !!get(editEnabled, false);
    const currentAnn = get(ann, { lines: [], texts: [] });
    const currentDir = get(assetsDir, null);

    // Styles
    const styles = useMemo(() => {
        const btn = { padding: "6px 10px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #111", cursor: "pointer" };
        const btnLight = { padding: "6px 10px", borderRadius: 8, background: "#fff", color: "#111", border: "1px solid #ddd", cursor: "pointer" };
        const tab = (active) => ({ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: active ? "#111" : "#fff", color: active ? "#fff" : "#111", cursor: "pointer", whiteSpace: "nowrap" });
        const toolBtn = (active) => ({ padding: "6px 10px", borderRadius: 8, background: active ? "#111" : "#fff", color: active ? "#fff" : "#111", border: "1px solid #ddd", cursor: "pointer" });
        return { btn, btnLight, tab, toolBtn };
    }, []);

    /** Load HTML file as text */
    const openPicker = () => fileInputRef.current?.click();
    const onPickFile = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        e.target.value = "";
        const text = await f.text().catch(() => "");
        setHtmlForTab(text || "<!-- empty file -->");
        setNameForTab(f.name || "report.html");
        setEditForTab(false);
        setAnn((prev) => ({ ...prev, [activeTab]: { lines: [], texts: [] } }));
        bumpReloadForTab();
    };

    /** Pick the folder that contains images/CSS referenced by the HTML */
    const pickAssetsFolder = async () => {
        if (!supportsDirPicker) {
            alert("Folder picker requires Chrome/Edge desktop over HTTPS.");
            return;
        }
        try {
            const dir = await window.showDirectoryPicker();
            setDirForTab(dir);
            alert("Assets folder attached. Click ‘Inline assets’ to embed images/CSS.");
        } catch {
            // cancelled
        }
    };

    /** Inline assets -> make HTML self-contained so images render */
    const inlineAssets = async () => {
        if (!currentDir) {
            alert("Attach the assets folder first (the folder that has images/styles referenced by the report).");
            return;
        }
        if (!currentHtml) return;
        setIsInlining(true);
        try {
            const inlined = await inlineAssetsIntoHtml(currentHtml, currentDir);
            setHtmlForTab(inlined);
            bumpReloadForTab();
            alert("Assets inlined. Images should now appear, and the saved HTML will be self-contained.");
        } catch (e) {
            console.error(e);
            alert("Failed to inline some assets. Check paths or attach the correct folder.");
        } finally {
            setIsInlining(false);
        }
    };

    /** Overlay creation/rendering inside the iframe */
    const ensureOverlay = () => {
        const iframe = iframeRef.current;
        if (!iframe) return null;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return null;

        doc.body.contentEditable = isEditingPage ? "true" : "false";
        doc.body.style.caretColor = isEditingPage ? "auto" : "";

        let host = doc.getElementById("__pnid_overlay_host");
        if (!host) {
            host = doc.createElement("div");
            host.id = "__pnid_overlay_host";
            host.style.position = "fixed";
            host.style.inset = "0";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = tool === TOOLS.NONE || isEditingPage ? "none" : "auto";
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
        return { doc, host: host, svg: doc.getElementById("__pnid_overlay_svg") };
    };

    const renderOverlay = () => {
        const r = ensureOverlay();
        if (!r || !r.svg) return;
        const { svg } = r;
        while (svg.firstChild) svg.removeChild(svg.firstChild);

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

    const attachOverlayEvents = () => {
        const r = ensureOverlay();
        if (!r || !r.host) return;
        const { host } = r;

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
                    const per = prev[activeTab] || { lines: [], texts: [] };
                    return { ...prev, [activeTab]: { ...per, lines: [...(per.lines || []), { x1: drawingRef.current.x1, y1: drawingRef.current.y1, x2, y2 }] } };
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
                    const per = prev[activeTab] || { lines: [], texts: [] };
                    return { ...prev, [activeTab]: { ...per, texts: [...(per.texts || []), { x, y, text }] } };
                });
            };
        }
    };

    useEffect(() => {
        const t = setTimeout(() => {
            ensureOverlay();
            attachOverlayEvents();
            renderOverlay();
        }, 0);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, currentHtml, currentReload, tool, isEditingPage]);

    useEffect(() => { renderOverlay(); /* eslint-disable-next-line */ }, [ann, activeTab]);

    const clearAnnotations = () => setAnn((prev) => ({ ...prev, [activeTab]: { lines: [], texts: [] } }));

    const toggleEditPage = () => {
        setEditForTab((v) => !v);
        setTool(TOOLS.NONE);
        bumpReloadForTab();
    };

    /** Save current (with annotations) as a self-contained .html (after you inline assets) */
    const saveAsAnnotated = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;

        ensureOverlay();
        renderOverlay();
        const host = doc.getElementById("__pnid_overlay_host");
        if (host) host.style.pointerEvents = "none";
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
            doc.body.contentEditable = isEditingPage ? "true" : "false";
            if (host) host.style.pointerEvents = tool === TOOLS.NONE || isEditingPage ? "none" : "auto";
        }, 0);
    };

    return (
        <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr" }}>
            {/* Tabs */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: "1px solid #eee", background: "#fafafa", flexWrap: "wrap" }}>
                {TABS.map((t) => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} style={styles.tab(activeTab === t.id)} title={t.label}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: "1px solid #eee", background: "#fff", flexWrap: "wrap" }}>
                <button onClick={openPicker} style={styles.btn}>Load HTML</button>
                <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={onPickFile} style={{ display: "none" }} />
                {currentName ? <span style={{ fontSize: 12, color: "#555" }}>{currentName}</span> : <span style={{ fontSize: 12, color: "#666" }}>No file loaded</span>}

                <span style={{ width: 8 }} />

                <button onClick={toggleEditPage} style={styles.btnLight} disabled={!currentHtml}>
                    {isEditingPage ? "Disable page text edit" : "Enable page text edit"}
                </button>

                {/* Drawing tools (disabled while editing page text) */}
                <button onClick={() => setTool(TOOLS.NONE)} style={styles.toolBtn(tool === TOOLS.NONE)} disabled={!currentHtml || isEditingPage}>Pointer</button>
                <button onClick={() => setTool(TOOLS.LINE)} style={styles.toolBtn(tool === TOOLS.LINE)} disabled={!currentHtml || isEditingPage}>Line</button>
                <button onClick={() => setTool(TOOLS.TEXT)} style={styles.toolBtn(tool === TOOLS.TEXT)} disabled={!currentHtml || isEditingPage}>Text</button>
                <button onClick={clearAnnotations} style={styles.btnLight} disabled={!currentHtml || ((currentAnn.lines || []).length + (currentAnn.texts || []).length === 0)}>Clear annotations</button>

                {/* Assets inlining */}
                <span style={{ width: 8 }} />
                <button onClick={pickAssetsFolder} style={styles.btnLight} disabled={!supportsDirPicker}>Attach assets folder</button>
                <button onClick={inlineAssets} style={styles.btnLight} disabled={!currentHtml || !currentDir || isInlining}>{isInlining ? "Inlining…" : "Inline assets"}</button>

                <span style={{ width: 8 }} />
                <button onClick={saveAsAnnotated} style={styles.btnLight} disabled={!currentHtml}>Save As (.annotated.html)</button>
            </div>

            {/* Viewer */}
            {!currentHtml ? (
                <div style={{ padding: 16, color: "#666", lineHeight: 1.5 }}>
                    No report loaded for <b>{TABS.find(t => t.id === activeTab)?.label}</b>.
                    Load the report HTML. If images don’t show, click <b>Attach assets folder</b> (pick the folder that contains the report’s <i>images / css</i>) and then <b>Inline assets</b>.
                </div>
            ) : (
                <iframe
                    key={activeTab + ":" + currentReload}
                    ref={iframeRef}
                    title={`PNID Review - ${TABS.find(t => t.id === activeTab)?.label}`}
                    srcDoc={currentHtml}
                    style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                    onLoad={() => {
                        ensureOverlay();
                        attachOverlayEvents();
                        renderOverlay();
                    }}
                />
            )}
        </div>
    );
}
