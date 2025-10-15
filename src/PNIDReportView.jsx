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

const FIELD_BY_TAB = {
    "line": "In Report: Line List",
    "equipment": "In Report: Equipment List",
    "valve": "In Report: Valve List",
    "ctrl-valve": "In Report: Control Valve List",
    "relief": "In Report: Relief Valve List",
    "inline": "In Report: Inline List",
    "manifold": "In Report: Manifold List",
};

const TOOLS = { NONE: "none", TEXT: "text", LINE: "line" };

/* -------------------- Aggressive Asset Inliner (v2) -------------------- */
function norm(p = "") { return decodeURI(p).replace(/\\/g, "/").replace(/^\.\/+/, ""); }
function baseName(p = "") { const n = norm(p); return n.substring(n.lastIndexOf("/") + 1); }
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
    const segs = noQ.split("/").filter(Boolean);
    for (let i = 0; i < segs.length; i++) out.add(segs.slice(i).join("/"));
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

    for (const img of doc.querySelectorAll("img[src]")) await setUrlAttr(img, "src");
    for (const s of doc.querySelectorAll("source[src]")) await setUrlAttr(s, "src");
    for (const o of doc.querySelectorAll("object[data]")) await setUrlAttr(o, "data");
    for (const em of doc.querySelectorAll("embed[src]")) await setUrlAttr(em, "src");

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

    for (const st of Array.from(doc.querySelectorAll("style"))) {
        st.textContent = await inlineCssUrls(st.textContent || "", maps, "");
    }

    for (const el of Array.from(doc.querySelectorAll("[style]"))) {
        const raw = el.getAttribute("style") || "";
        const inlined = await inlineCssUrls(raw, maps, "");
        if (inlined !== raw) el.setAttribute("style", inlined);
    }

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

/* -------------------- Airtable helpers -------------------- */
async function fetchAllTableRecords() {
    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
    const tableId = import.meta.env.VITE_AIRTABLE_TABLE_NAME;
    if (!baseId || !token || !tableId) throw new Error("Missing Airtable env vars.");

    let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}?pageSize=100`;
    const headers = { Authorization: `Bearer ${token}` };
    const all = [];
    for (; ;) {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Airtable fetch failed: ${res.status}`);
        const data = await res.json();
        (data.records || []).forEach(r => all.push(r));
        if (!data.offset) break;
        url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}?pageSize=100&offset=${data.offset}`;
    }
    return all;
}

async function patchCheckboxBatch(records) {
    // records: [{ id, fields: { [checkboxField]: true/false } }]
    if (!records || !records.length) return;
    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
    const tableId = import.meta.env.VITE_AIRTABLE_TABLE_NAME;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // Airtable: max 10 per request
    for (let i = 0; i < records.length; i += 10) {
        const chunk = records.slice(i, i + 10);
        const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ records: chunk }),
        });
        if (!res.ok) {
            const t = await res.text().catch(() => "");
            throw new Error(`Airtable PATCH failed: ${res.status} ${t}`);
        }
    }
}

/* -------------------- PNIDReportView -------------------- */
export default function PNIDReportView() {
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem("pnidReport:activeTab") || "line");

    // per-tab content
    const [htmlByTab, setHtmlByTab] = useState({});
    const [nameByTab, setNameByTab] = useState({});
    const [reloadByTab, setReloadByTab] = useState({});
    const [editByTab, setEditByTab] = useState({});
    const [annByTab, setAnnByTab] = useState({});
    const [mapsByTab, setMapsByTab] = useState({});

    // review tools
    const [tool, setTool] = useState(TOOLS.NONE);
    const [inlining, setInlining] = useState(false);

    // Airtable data + scan results
    const [airtable, setAirtable] = useState({ loaded: false, records: [], byCode: new Map() });
    const [scanResultByTab, setScanResultByTab] = useState({}); // { [tab]: { matched: {id,code}[], totalCodes, sample: [] } }
    const [clearNonMatches, setClearNonMatches] = useState(false);
    const [syncBusy, setSyncBusy] = useState(false);

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

    /* ---------- styles ---------- */
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

        let htmlFile =
            files.find((f) => /\.html?$/i.test(f.name) && f.name.toLowerCase().includes(TABS.find(t => t.id === activeTab)?.label.toLowerCase().split(" ")[0])) ||
            files.find((f) => /\.html?$/i.test(f.name)) ||
            null;

        if (!htmlFile) {
            setHtmlForTab("");
            setNameForTab("");
            alert("No HTML file found in that folder.");
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
        alert("Assets folder attached. Click ‘Inline assets’ to embed images/CSS/JS.");
    };

    const onInlineAssets = async () => {
        if (!currentHtml) return;
        if (!currentMaps) { alert("Pick the report folder or assets folder first."); return; }
        setInlining(true);
        try {
            const inlined = await inlineAssetsIntoHtmlStrong(currentHtml, currentMaps);
            setHtmlForTab(inlined);
            bumpReload();
        } catch (e) {
            console.error(e);
            alert("Inlining failed for some assets.");
        } finally {
            setInlining(false);
        }
    };

    /* ---------- Review overlay + edits ---------- */
    const iframeDoc = () => {
        const ifr = iframeRef.current;
        return ifr ? (ifr.contentDocument || ifr.contentWindow?.document) : null;
    };

    const ensureOverlay = () => {
        const doc = iframeDoc();
        if (!doc) return null;
        doc.body.contentEditable = isEditing ? "true" : "false";
        doc.body.style.caretColor = isEditing ? "auto" : "";

        let host = doc.getElementById("__pnid_overlay_host");
        if (!host) {
            host = doc.createElement("div");
            host.id = "__pnid_overlay_host";
            Object.assign(host.style, { position: "fixed", inset: "0", zIndex: "2147483647", pointerEvents: tool === TOOLS.NONE || isEditing ? "none" : "auto" });
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

        const ann = currentAnn;
        (ann.lines || []).forEach((ln) => {
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

        (ann.texts || []).forEach((tx) => {
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
                    return { ...prev, [activeTab]: { ...per, lines: [...(per.lines || []), { x1: drawRef.current.x1, y1: drawRef.current.y1, x2, y2 }] } };
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

    useEffect(() => { renderOverlay(); /* eslint-disable-next-line */ }, [annByTab, activeTab]);

    const clearAnnotations = () =>
        setAnnByTab((prev) => ({ ...prev, [activeTab]: { lines: [], texts: [] } }));

    const toggleEdit = () => {
        setEditForTab(!isEditing);
        setTool(TOOLS.NONE);
        bumpReload();
    };

    const saveAsAnnotated = () => {
        const doc = iframeDoc();
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

    /* ---------- Airtable loading ---------- */
    const loadAirtableIfNeeded = async () => {
        if (airtable.loaded) return airtable;
        const records = await fetchAllTableRecords();
        const byCode = new Map();
        for (const r of records) {
            const code = (r?.fields?.["Item Code"] || r?.fields?.Code || "").toString().trim();
            if (!code) continue;
            byCode.set(code.toLowerCase(), r);
        }
        const at = { loaded: true, records, byCode };
        setAirtable(at);
        return at;
    };

    /* ---------- Scan HTML vs Airtable ---------- */
    const highlightCodesInIframe = (codes) => {
        const doc = iframeDoc();
        if (!doc || !codes || !codes.length) return;

        // inject CSS for highlight
        const styleId = "__pnid_hit_style";
        if (!doc.getElementById(styleId)) {
            const st = doc.createElement("style");
            st.id = styleId;
            st.textContent = `.pnid-hit{ background: #ffff00; color: #000; outline: 1px solid #f6a623; }`;
            doc.head.appendChild(st);
        }

        // big regex (chunked to keep safe)
        const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const chunks = [];
        const sorted = [...codes].sort((a, b) => b.length - a.length).map(escape);
        for (let i = 0; i < sorted.length; i += 50) chunks.push(new RegExp(`(${sorted.slice(i, i + 50).join("|")})`, "gi"));

        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
        const toProcess = [];
        while (true) {
            const n = walker.nextNode();
            if (!n) break;
            const text = n.nodeValue || "";
            if (!text.trim()) continue;
            if (chunks.some(rx => rx.test(text))) toProcess.push(n);
        }

        for (const textNode of toProcess) {
            const parent = textNode.parentNode;
            if (!parent) continue;
            const frag = doc.createDocumentFragment();
            let s = textNode.nodeValue || "";
            let cursor = 0;
            let segments = [{ start: 0, end: s.length, hit: false }];

            for (const rx of chunks) {
                const nextSegs = [];
                for (const seg of segments) {
                    if (seg.hit) { nextSegs.push(seg); continue; }
                    const slice = s.slice(seg.start, seg.end);
                    let lastIdx = 0;
                    for (let m; (m = rx.exec(slice));) {
                        const st = seg.start + m.index;
                        const en = st + m[0].length;
                        if (st > seg.start + lastIdx) nextSegs.push({ start: seg.start + lastIdx, end: st, hit: false });
                        nextSegs.push({ start: st, end: en, hit: true });
                        lastIdx = m.index + m[0].length;
                    }
                    if (seg.start + lastIdx < seg.end) nextSegs.push({ start: seg.start + lastIdx, end: seg.end, hit: false });
                }
                segments = nextSegs;
            }

            for (const seg of segments) {
                const chunk = s.slice(seg.start, seg.end);
                if (!seg.hit) { frag.appendChild(doc.createTextNode(chunk)); }
                else {
                    const mark = doc.createElement("mark");
                    mark.className = "pnid-hit";
                    mark.textContent = chunk;
                    frag.appendChild(mark);
                }
            }
            parent.replaceChild(frag, textNode);
        }
    };

    const onScan = async () => {
        if (!currentHtml) { alert("Load a report first."); return; }
        const at = await loadAirtableIfNeeded();

        const htmlTextLower = currentHtml.toLowerCase();
        const matched = [];
        const matchedCodes = new Set();

        // We simply check presence of each code inside HTML text (case-insensitive).
        // For large bases, we could speed up, but this is usually fine.
        for (const [codeLower, rec] of at.byCode.entries()) {
            if (!codeLower) continue;
            if (htmlTextLower.includes(codeLower)) {
                matched.push({ id: rec.id, code: rec.fields["Item Code"] || rec.fields.Code || "" });
                matchedCodes.add(rec.fields["Item Code"] || rec.fields.Code || "");
            }
        }

        // Save result for this tab
        setScanResultByTab((prev) => ({
            ...prev,
            [activeTab]: {
                matched,
                totalCodes: at.byCode.size,
                sample: matched.slice(0, 20).map(m => m.code),
            },
        }));

        // Visual highlight in the iframe
        highlightCodesInIframe([...matchedCodes].filter(Boolean));
    };

    /* ---------- Apply checkbox updates to Airtable ---------- */
    const onApplyCheckboxUpdates = async () => {
        const res = scanResultByTab[activeTab];
        if (!res || !res.matched) { alert("Run ‘Scan & highlight’ first."); return; }

        const fieldName = FIELD_BY_TAB[activeTab] || "In Report";
        const yesIds = new Set(res.matched.map(m => m.id));
        const updates = [];

        // Set TRUE for matches
        for (const id of yesIds) updates.push({ id, fields: { [fieldName]: true } });

        // Optionally clear non-matches to FALSE
        if (clearNonMatches) {
            const at = await loadAirtableIfNeeded();
            for (const r of at.records) {
                if (!yesIds.has(r.id)) updates.push({ id: r.id, fields: { [fieldName]: false } });
            }
        }

        if (!updates.length) { alert("Nothing to update."); return; }

        setSyncBusy(true);
        try {
            await patchCheckboxBatch(updates);
            alert(`Updated ${updates.length} records in Airtable (${fieldName}).`);
        } catch (e) {
            console.error(e);
            alert(`Airtable update failed. Ensure the checkbox field “${fieldName}” exists and your token has write access.`);
        } finally {
            setSyncBusy(false);
        }
    };

    /* -------------------- UI -------------------- */
    const folderInputRef = useRef(null);
    const htmlInputRef = useRef(null);
    const assetsInputRef = useRef(null);

    return (
        <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateRows: "auto auto auto 1fr" }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 10px", borderBottom: "1px solid #eee", background: "#fafafa", flexWrap: "wrap" }}>
                {TABS.map((t) => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} style={s.tab(activeTab === t.id)} title={t.label}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Load/Inline toolbar */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", borderBottom: "1px solid #eee", background: "#fff", flexWrap: "wrap" }}>
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

                <span style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>{currentName || "No file loaded"}</span>
            </div>

            {/* Review + Airtable toolbar */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", borderBottom: "1px solid #eee", background: "#fff", flexWrap: "wrap" }}>
                <button onClick={toggleEdit} style={s.btnLight} disabled={!currentHtml}>
                    {isEditing ? "Disable page text edit" : "Enable page text edit"}
                </button>
                <button onClick={() => setTool(TOOLS.NONE)} style={s.toolBtn(tool === TOOLS.NONE)} disabled={!currentHtml || isEditing}>Pointer</button>
                <button onClick={() => setTool(TOOLS.LINE)} style={s.toolBtn(tool === TOOLS.LINE)} disabled={!currentHtml || isEditing}>Line</button>
                <button onClick={() => setTool(TOOLS.TEXT)} style={s.toolBtn(tool === TOOLS.TEXT)} disabled={!currentHtml || isEditing}>Text</button>
                <button onClick={clearAnnotations} style={s.btnLight} disabled={!currentHtml || ((currentAnn.lines || []).length + (currentAnn.texts || []).length === 0)}>Clear annotations</button>

                <span style={{ width: 16 }} />

                <button onClick={onScan} style={s.btnLight} disabled={!currentHtml}>
                    Scan & highlight vs Airtable
                </button>

                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={clearNonMatches} onChange={(e) => setClearNonMatches(e.target.checked)} />
                    Also clear non-matches to FALSE
                </label>
                <button onClick={onApplyCheckboxUpdates} style={s.btn} disabled={!scanResultByTab[activeTab] || syncBusy}>
                    {syncBusy ? "Updating…" : `Apply checkbox updates (${FIELD_BY_TAB[activeTab] || "In Report"})`}
                </button>

                <span style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                    {(() => {
                        const r = scanResultByTab[activeTab];
                        if (!r) return "";
                        return `Matched ${r.matched.length} / ${r.totalCodes} codes`;
                    })()}
                </span>
            </div>

            {/* Viewer */}
            {!currentHtml ? (
                <div style={{ padding: 16, color: "#666", lineHeight: 1.5 }}>
                    No report loaded for <b>{TABS.find(t => t.id === activeTab)?.label}</b>.<br />
                    Tip: Click <b>Open report folder</b> and select the folder that contains the HTML and its <code>*_files</code> directory. Then click <b>Inline assets</b>.
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
                        // Ensure overlay ready and re-highlight after reload
                        ensureOverlay();
                        attachOverlayEvents();
                        renderOverlay();

                        // Re-apply highlight if we already scanned
                        const r = scanResultByTab[activeTab];
                        if (r?.matched?.length) {
                            const codes = r.matched.map(m => m.code).filter(Boolean);
                            highlightCodesInIframe(codes);
                        }
                    }}
                />
            )}
        </div>
    );
}
