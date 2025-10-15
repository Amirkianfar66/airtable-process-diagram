// src/PNIDReportView.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/* -------------------- Tabs & Tools -------------------- */
const TABS = [
    { id: "line", label: "Line List" },
    { id: "equipment", label: "Equipment List" },
    { id: "valve", label: "Valve List" },
    { id: "ctrl-valve", label: "Control Valve List" },
    { id: "relief", label: "Relief Valve List" },
    { id: "inline", label: "Inline List" },
    { id: "manifold", label: "Manifold List" },
];

const TOOLS = { NONE: "none", TEXT: "text", LINE: "line" };

/* -------------------- Aggressive Asset Inliner (v2) -------------------- */
// Normalize path to forward slashes, strip leading "./", decode %20, etc.
function norm(p = "") {
    return decodeURI(p).replace(/\\/g, "/").replace(/^\.\/+/, "");
}
function baseName(p = "") {
    const n = norm(p);
    return n.substring(n.lastIndexOf("/") + 1);
}
function urlCandidates(raw = "") {
    if (!raw) return [];
    const u = norm(raw).toLowerCase();
    const out = new Set();

    out.add(u);
    const [noQ] = u.split(/[?#]/);
    out.add(noQ);
    out.add(noQ.replace(/^\/+/, "")); // drop leading /
    const base = noQ.substring(noQ.lastIndexOf("/") + 1);
    if (base) out.add(base);

    // windows file:///C:/... and C:/...
    const fileUrlMatch = u.match(/^file:\/\/\/([a-z]:\/.*)$/i);
    if (fileUrlMatch) {
        const filePath = fileUrlMatch[1].replace(/\\/g, "/");
        out.add(filePath);
        const fromRoot = filePath.replace(/^([a-z]:\/)/i, "");
        out.add(fromRoot);
        out.add(fromRoot.replace(/^\/+/, ""));
        out.add(filePath.substring(filePath.lastIndexOf("/") + 1));
    } else if (/^[a-z]:\//i.test(u)) {
        const win = u.replace(/\\/g, "/");
        out.add(win);
        const fromRoot = win.replace(/^([a-z]:\/)/i, "");
        out.add(fromRoot);
        out.add(fromRoot.replace(/^\/+/, ""));
        out.add(win.substring(win.lastIndexOf("/") + 1));
    }

    // progressively drop leading segments: a/b/c.png => add b/c.png, c.png
    const segs = noQ.split("/").filter(Boolean);
    for (let i = 0; i < segs.length; i++) {
        out.add(segs.slice(i).join("/"));
    }

    return [...out];
}
function buildFileMaps(files) {
    const byPath = new Map();
    const byBase = new Map();
    for (const f of files) {
        const rel = norm(f.webkitRelativePath || f.name).toLowerCase();
        const base = baseName(rel).toLowerCase();
        byPath.set(rel, f);
        if (base && !byBase.has(base)) byBase.set(base, f);
    }
    return { byPath, byBase };
}
function resolveFile(raw, maps) {
    if (!maps) return null;
    const { byPath, byBase } = maps;
    for (const key of urlCandidates(raw)) {
        if (byPath.has(key)) return byPath.get(key);
        const base = baseName(key).toLowerCase();
        if (base && byBase.has(base)) return byBase.get(base);
    }
    return null;
}
async function fileToDataURL(file) {
    const buf = await file.arrayBuffer();
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const mime =
        file.type ||
        ({
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            webp: "image/webp",
            svg: "image/svg+xml",
            css: "text/css",
            js: "text/javascript",
            html: "text/html",
            ico: "image/x-icon",
            cur: "image/x-icon",
            bmp: "image/bmp",
            tif: "image/tiff",
            tiff: "image/tiff",
            json: "application/json",
            map: "application/json",
            woff: "font/woff",
            woff2: "font/woff2",
            ttf: "font/ttf",
            otf: "font/otf",
            eot: "application/vnd.ms-fontobject",
            mp4: "video/mp4",
            webm: "video/webm",
            ogg: "video/ogg",
            mp3: "audio/mpeg",
            wav: "audio/wav",
            m4a: "audio/mp4",
        }[ext] || "application/octet-stream");
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return `data:${mime};base64,${base64}`;
}
async function inlineCssUrls(cssText, maps, cssBaseHint = "") {
    const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    const out = [];
    let last = 0;
    for (let m; (m = re.exec(cssText));) {
        out.push(cssText.slice(last, m.index));
        const raw = m[2];
        let dataUrl = null;
        if (raw && !/^data:/i.test(raw) && !/^https?:/i.test(raw)) {
            const joined = cssBaseHint ? norm(cssBaseHint + "/" + raw) : raw;
            const f = resolveFile(joined, maps) || resolveFile(raw, maps);
            if (f) dataUrl = await fileToDataURL(f);
        }
        out.push(`url(${dataUrl || raw})`);
        last = m.index + m[0].length;
    }
    out.push(cssText.slice(last));
    return out.join("");
}
async function inlineAssetsIntoHtmlStrong(htmlText, maps) {
    if (!maps) return htmlText;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    const setUrlAttr = async (el, attr) => {
        const val = el.getAttribute(attr);
        if (!val || /^data:/i.test(val) || /^https?:/i.test(val)) return;
        const f = resolveFile(val, maps);
        if (!f) return;
        el.setAttribute(attr, await fileToDataURL(f));
    };

    // <img src>, <source src>, <object data>, <embed src>
    for (const img of doc.querySelectorAll("img[src]")) await setUrlAttr(img, "src");
    for (const s of doc.querySelectorAll("source[src]")) await setUrlAttr(s, "src");
    for (const o of doc.querySelectorAll("object[data]")) await setUrlAttr(o, "data");
    for (const em of doc.querySelectorAll("embed[src]")) await setUrlAttr(em, "src");

    // srcset
    const fixSrcset = async (el) => {
        const srcset = el.getAttribute("srcset");
        if (!srcset) return;
        const parts = srcset.split(",").map((s) => s.trim()).filter(Boolean);
        const rebuilt = await Promise.all(
            parts.map(async (chunk) => {
                const [url, ...rest] = chunk.split(/\s+/);
                if (!url) return chunk;
                const f = resolveFile(url, maps);
                if (!f) return chunk;
                const data = await fileToDataURL(f);
                return [data, ...rest].join(" ");
            })
        );
        el.setAttribute("srcset", rebuilt.join(", "));
    };
    for (const el of doc.querySelectorAll("img[srcset],source[srcset]")) await fixSrcset(el);

    // SVG <image href|xlink:href>
    for (const im of doc.querySelectorAll("image[href], image[*|href]")) {
        const href = im.getAttribute("href") || im.getAttribute("xlink:href");
        if (!href || /^data:/i.test(href) || /^https?:/i.test(href)) continue;
        const f = resolveFile(href, maps);
        if (f) {
            const data = await fileToDataURL(f);
            im.setAttribute("href", data);
            im.setAttribute("xlink:href", data);
        }
    }

    // <link rel=stylesheet> -> <style> with url(...) inlined
    for (const link of Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'))) {
        const href = link.getAttribute("href");
        if (!href || /^https?:/i.test(href)) continue;
        const f = resolveFile(href, maps);
        if (!f) continue;
        const css = await f.text();
        const baseHint = norm(href).split("/").slice(0, -1).join("/");
        const inlined = await inlineCssUrls(css, maps, baseHint);
        const style = doc.createElement("style");
        style.setAttribute("data-inlined-from", href);
        style.textContent = inlined;
        link.replaceWith(style);
    }

    // inline <style> url(...)
    for (const st of Array.from(doc.querySelectorAll("style"))) {
        st.textContent = await inlineCssUrls(st.textContent || "", maps, "");
    }

    // inline style="background:url(...)"
    for (const el of Array.from(doc.querySelectorAll("[style]"))) {
        const raw = el.getAttribute("style") || "";
        const inlined = await inlineCssUrls(raw, maps, "");
        if (inlined !== raw) el.setAttribute("style", inlined);
    }

    // (optional) inline <script src>
    for (const s of Array.from(doc.querySelectorAll("script[src]"))) {
        const src = s.getAttribute("src");
        if (!src || /^https?:/i.test(src)) continue;
        const f = resolveFile(src, maps);
        if (!f) continue;
        const js = await f.text();
        const inline = doc.createElement("script");
        if (s.type) inline.type = s.type;
        inline.textContent = js;
        s.replaceWith(inline);
    }

    return "<!doctype html>\n" + doc.documentElement.outerHTML;
}

/* -------------------- Component -------------------- */
export default function PNIDReportView() {
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem("pnidReport:activeTab") || "line");

    // per-tab state
    const [htmlByTab, setHtmlByTab] = useState({});            // raw/edited html text
    const [nameByTab, setNameByTab] = useState({});            // file name
    const [reloadByTab, setReloadByTab] = useState({});        // bump to refresh iframe
    const [editByTab, setEditByTab] = useState({});            // contentEditable flag
    const [annByTab, setAnnByTab] = useState({});              // { lines:[], texts:[] }
    const [mapsByTab, setMapsByTab] = useState({});            // file maps (from folder/assets)
    const [tool, setTool] = useState(TOOLS.NONE);              // drawing tool (shared)
    const [inlining, setInlining] = useState(false);

    const iframeRef = useRef(null);
    const drawRef = useRef({ down: false, x1: 0, y1: 0 });

    const currentHtml = htmlByTab[activeTab] || "";
    const currentName = nameByTab[activeTab] || "";
    const currentReload = reloadByTab[activeTab] || 0;
    const isEditing = !!editByTab[activeTab];
    const currentAnn = annByTab[activeTab] || { lines: [], texts: [] };
    const currentMaps = mapsByTab[activeTab] || null;

    useEffect(() => {
        localStorage.setItem("pnidReport:activeTab", activeTab);
    }, [activeTab]);

    const setForTab = (setter) => (value) =>
        setter((prev) => ({ ...prev, [activeTab]: value }));

    const setHtmlForTab = setForTab(setHtmlByTab);
    const setNameForTab = setForTab(setNameByTab);
    const setEditForTab = setForTab(setEditByTab);
    const setMapsForTab = setForTab(setMapsByTab);
    const bumpReload = () => setReloadByTab((p) => ({ ...p, [activeTab]: (p?.[activeTab] || 0) + 1 }));

    /* ---------- UI Styles ---------- */
    const s = useMemo(() => {
        const btn = { padding: "6px 10px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #111", cursor: "pointer" };
        const btnLight = { padding: "6px 10px", borderRadius: 8, background: "#fff", color: "#111", border: "1px solid #ddd", cursor: "pointer" };
        const tab = (on) => ({ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: on ? "#111" : "#fff", color: on ? "#fff" : "#111", cursor: "pointer", whiteSpace: "nowrap" });
        const toolBtn = (on) => ({ padding: "6px 10px", borderRadius: 8, background: on ? "#111" : "#fff", color: on ? "#fff" : "#111", border: "1px solid #ddd", cursor: "pointer" });
        return { btn, btnLight, tab, toolBtn };
    }, []);

    /* ---------- File pickers ---------- */
    const folderInputRef = useRef(null);
    const htmlInputRef = useRef(null);
    const assetsInputRef = useRef(null);

    const pickFolder = () => folderInputRef.current?.click();
    const pickHtml = () => htmlInputRef.current?.click();
    const pickAssets = () => assetsInputRef.current?.click();

    const onPickFolder = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length) return;

        const maps = buildFileMaps(files);
        setMapsForTab(maps);

        // choose a .html to load (prefer one matching the tab name)
        let htmlFile =
            files.find((f) => /\.html?$/i.test(f.name) && f.name.toLowerCase().includes(TABS.find(t => t.id === activeTab)?.label.toLowerCase().split(" ")[0])) ||
            files.find((f) => /\.html?$/i.test(f.name)) ||
            null;

        if (!htmlFile) {
            setHtmlForTab("");
            setNameForTab("");
            alert("No HTML file found in that folder. Please pick the folder that contains your report HTML and its *_files assets.");
            return;
        }

        const text = await htmlFile.text();
        setHtmlForTab(text);
        setNameForTab(htmlFile.name);
        bumpReload();
    };

    const onPickHtml = async (e) => {
        const [file] = e.target.files || [];
        e.target.value = "";
        if (!file) return;
        const text = await file.text();
        setHtmlForTab(text);
        setNameForTab(file.name);
        bumpReload();
    };

    const onPickAssets = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length) return;
        const maps = buildFileMaps(files);
        setMapsForTab(maps);
        alert("Assets folder attached. Click ‘Inline assets’ to embed images/CSS/JS so they always show.");
    };

    const onInlineAssets = async () => {
        if (!currentHtml) return;
        if (!currentMaps) {
            alert("Pick the report folder (recommended) or attach the assets folder first.");
            return;
        }
        setInlining(true);
        try {
            const inlined = await inlineAssetsIntoHtmlStrong(currentHtml, currentMaps);
            setHtmlForTab(inlined);
            bumpReload();
        } catch (e) {
            console.error(e);
            alert("Inlining failed for some assets. Make sure you selected the correct folder that contains the *_files directory.");
        } finally {
            setInlining(false);
        }
    };

    /* ---------- Review overlay inside iframe ---------- */
    const ensureOverlay = () => {
        const iframe = iframeRef.current;
        if (!iframe) return null;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return null;

        doc.body.contentEditable = isEditing ? "true" : "false";
        doc.body.style.caretColor = isEditing ? "auto" : "";

        let host = doc.getElementById("__pnid_overlay_host");
        if (!host) {
            host = doc.createElement("div");
            host.id = "__pnid_overlay_host";
            Object.assign(host.style, {
                position: "fixed",
                inset: "0",
                zIndex: "2147483647",
                pointerEvents: tool === TOOLS.NONE || isEditing ? "none" : "auto",
            });
            const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("id", "__pnid_overlay_svg");
            svg.setAttribute("width", "100%");
            svg.setAttribute("height", "100%");
            svg.style.pointerEvents = "none";
            host.appendChild(svg);
            doc.body.appendChild(host);
        } else {
            host.style.pointerEvents = tool === TOOLS.NONE || isEditing ? "none" : "auto";
        }
        return { doc, host, svg: doc.getElementById("__pnid_overlay_svg") };
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
        host.onmouseup = null;
        host.onclick = null;

        if (tool === TOOLS.LINE) {
            host.onmousedown = (ev) => {
                drawRef.current.down = true;
                const rect = host.getBoundingClientRect();
                drawRef.current.x1 = ev.clientX - rect.left;
                drawRef.current.y1 = ev.clientY - rect.top;
            };
            host.onmouseup = (ev) => {
                if (!drawRef.current.down) return;
                drawRef.current.down = false;
                const rect = host.getBoundingClientRect();
                const x2 = ev.clientX - rect.left;
                const y2 = ev.clientY - rect.top;
                setAnnByTab((prev) => {
                    const per = prev[activeTab] || { lines: [], texts: [] };
                    return {
                        ...prev,
                        [activeTab]: {
                            ...per,
                            lines: [...(per.lines || []), { x1: drawRef.current.x1, y1: drawRef.current.y1, x2, y2 }],
                        },
                    };
                });
            };
        } else if (tool === TOOLS.TEXT) {
            host.onclick = (ev) => {
                const rect = host.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                const y = ev.clientY - rect.top;
                const text = window.prompt("Comment text:", "");
                if (!text) return;
                setAnnByTab((prev) => {
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
    }, [activeTab, currentHtml, currentReload, tool, isEditing]);

    useEffect(() => {
        renderOverlay();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [annByTab, activeTab]);

    const clearAnnotations = () =>
        setAnnByTab((prev) => ({ ...prev, [activeTab]: { lines: [], texts: [] } }));

    const toggleEdit = () => {
        setEditForTab(!isEditing);
        setTool(TOOLS.NONE);
        bumpReload();
    };

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
            doc.body.contentEditable = isEditing ? "true" : "false";
            if (host) host.style.pointerEvents = tool === TOOLS.NONE || isEditing ? "none" : "auto";
        }, 0);
    };

    /* -------------------- UI -------------------- */
    return (
        <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr" }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 10px", borderBottom: "1px solid #eee", background: "#fafafa", flexWrap: "wrap" }}>
                {TABS.map((t) => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} style={s.tab(activeTab === t.id)} title={t.label}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", borderBottom: "1px solid #eee", background: "#fff", flexWrap: "wrap" }}>
                {/* Pickers */}
                <label style={s.btn}>
                    <input
                        ref={folderInputRef}
                        type="file"
                        style={{ display: "none" }}
                        webkitdirectory="true"
                        directory=""
                        multiple
                        onChange={onPickFolder}
                    />
                    📁 Open report folder
                </label>

                <label style={s.btn}>
                    <input
                        ref={htmlInputRef}
                        type="file"
                        accept=".html,.htm"
                        style={{ display: "none" }}
                        onChange={onPickHtml}
                    />
                    📄 Open HTML
                </label>

                <label style={s.btn}>
                    <input
                        ref={assetsInputRef}
                        type="file"
                        webkitdirectory="true"
                        directory=""
                        multiple
                        style={{ display: "none" }}
                        onChange={onPickAssets}
                    />
                    🖼️ Add assets folder
                </label>

                <button onClick={onInlineAssets} style={s.btn} disabled={!currentHtml || !currentMaps || inlining}>
                    {inlining ? "Inlining…" : "Inline assets"}
                </button>

                <span style={{ width: 12 }} />

                {/* Review tools */}
                <button onClick={toggleEdit} style={s.btnLight} disabled={!currentHtml}>
                    {isEditing ? "Disable page text edit" : "Enable page text edit"}
                </button>
                <button onClick={() => setTool(TOOLS.NONE)} style={s.toolBtn(tool === TOOLS.NONE)} disabled={!currentHtml || isEditing}>Pointer</button>
                <button onClick={() => setTool(TOOLS.LINE)} style={s.toolBtn(tool === TOOLS.LINE)} disabled={!currentHtml || isEditing}>Line</button>
                <button onClick={() => setTool(TOOLS.TEXT)} style={s.toolBtn(tool === TOOLS.TEXT)} disabled={!currentHtml || isEditing}>Text</button>
                <button onClick={clearAnnotations} style={s.btnLight} disabled={!currentHtml || ((currentAnn.lines || []).length + (currentAnn.texts || []).length === 0)}>Clear annotations</button>

                <span style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>{currentName || "No file loaded"}</span>
                <button onClick={saveAsAnnotated} style={s.btnLight} disabled={!currentHtml}>Save As (.annotated.html)</button>
            </div>

            {/* Viewer */}
            {!currentHtml ? (
                <div style={{ padding: 16, color: "#666", lineHeight: 1.5 }}>
                    No report loaded for <b>{TABS.find(t => t.id === activeTab)?.label}</b>.<br />
                    <b>Tip:</b> Click <b>Open report folder</b> and select the folder that contains the HTML and its <code>*_files</code> directory (e.g. <code>03_Line list.html</code> + <code>03_Line list_files/</code>).
                    Then click <b>Inline assets</b> so images/styles are embedded and always visible.
                </div>
            ) : (
                <iframe
                    key={activeTab + ":" + currentReload}
                    ref={iframeRef}
                    title={`PNID Review - ${TABS.find(t => t.id === activeTab)?.label}`}
                    srcDoc={currentHtml}
                    style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                    sandbox="allow-same-origin allow-scripts allow-forms"
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
