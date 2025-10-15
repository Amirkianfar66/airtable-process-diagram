// HtmlReportTab.jsx
import React, { useRef, useState } from "react";

function normalize(p = "") {
    return p.replace(/^\.\/+/, "").replace(/\\/g, "/");
}
function baseName(p = "") {
    const n = normalize(p);
    return n.substring(n.lastIndexOf("/") + 1);
}

export default function HtmlReportTab() {
    const [htmlName, setHtmlName] = useState("");
    const [iframeDoc, setIframeDoc] = useState(""); // srcdoc content
    const assetsRef = useRef({}); // { fullPathLower -> blobUrl }
    const nameRef = useRef({});   // { basenameLower   -> blobUrl }

    const buildMapsFromFiles = (fileList) => {
        for (const file of fileList) {
            const full = normalize(file.webkitRelativePath || file.name).toLowerCase();
            const url = URL.createObjectURL(file);
            assetsRef.current[full] = url;
            nameRef.current[baseName(full).toLowerCase()] = url;
        }
    };

    const resolveUrl = (val) => {
        if (!val) return null;
        const raw = normalize(val).toLowerCase();

        // 1) Try full relative path
        if (assetsRef.current[raw]) return assetsRef.current[raw];

        // 2) Try without any leading "./"
        const noDot = raw.replace(/^\.\//, "");
        if (assetsRef.current[noDot]) return assetsRef.current[noDot];

        // 3) Try by basename only (helps when folder name mismatches)
        const base = baseName(raw);
        if (nameRef.current[base]) return nameRef.current[base];

        return null;
        // (Optional: handle absolute URLs or data: here)
    };

    const rewriteDomUrls = (doc) => {
        const ATTRS = ["src", "href"];
        const ELEMENTS = ["img", "link", "script", "source"];

        // src & href on common elements
        ELEMENTS.forEach((tag) => {
            doc.querySelectorAll(tag).forEach((el) => {
                ATTRS.forEach((attr) => {
                    const val = el.getAttribute(attr);
                    const repl = resolveUrl(val);
                    if (repl) el.setAttribute(attr, repl);
                });
            });
        });

        // srcset on <img>, <source>
        doc.querySelectorAll("img,source").forEach((el) => {
            const srcset = el.getAttribute("srcset");
            if (!srcset) return;
            const rebuilt = srcset
                .split(",")
                .map((part) => {
                    const seg = part.trim();
                    if (!seg) return "";
                    const pieces = seg.split(/\s+/);
                    const url = pieces[0];
                    const desc = pieces.slice(1).join(" ");
                    const repl = resolveUrl(url) || url;
                    return desc ? `${repl} ${desc}` : repl;
                })
                .filter(Boolean)
                .join(", ");
            el.setAttribute("srcset", rebuilt);
        });

        // (Optional) rewrite CSS url() in <link rel="stylesheet"> by inlining – omitted for brevity.
    };

    const loadHtmlFile = async (file) => {
        const text = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        rewriteDomUrls(doc);
        setHtmlName(file.name);
        setIframeDoc("<!doctype html>\n" + doc.documentElement.outerHTML);
    };

    const onPickFolder = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        // Clear previous maps
        assetsRef.current = {};
        nameRef.current = {};
        buildMapsFromFiles(files);

        // Find the first .html in the folder (or one with “index”)
        const html = files.find(f => /\.html?$/i.test(f.name))
            || files.find(f => /\.html?$/i.test(f.name) && /index/i.test(f.name));
        if (!html) {
            setIframeDoc("");
            setHtmlName("");
            alert("No HTML file found in the selected folder.");
            return;
        }
        await loadHtmlFile(html);
        e.target.value = "";
    };

    const onPickHtml = async (e) => {
        const [file] = e.target.files || [];
        if (!file) return;
        await loadHtmlFile(file);
        e.target.value = "";
    };

    const onPickAssets = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        buildMapsFromFiles(files);

        // If an HTML is already loaded, try to re-run URL rewriting on it
        if (iframeDoc) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(iframeDoc, "text/html");
            rewriteDomUrls(doc);
            setIframeDoc("<!doctype html>\n" + doc.documentElement.outerHTML);
        }
        e.target.value = "";
    };

    return (
        <div className="p-3 space-y-3" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label className="button">
                    <input
                        type="file"
                        style={{ display: "none" }}
                        // pick a whole report folder: the .html + its “*_files” folder
                        webkitdirectory="true"
                        directory=""
                        multiple
                        onChange={onPickFolder}
                    />
                    📁 Open report folder (recommended)
                </label>

                <label className="button">
                    <input
                        type="file"
                        accept=".html,.htm"
                        style={{ display: "none" }}
                        onChange={onPickHtml}
                    />
                    📄 Open HTML only
                </label>

                <label className="button">
                    <input
                        type="file"
                        // allow selecting the “*_files” folder or multiple assets
                        webkitdirectory="true"
                        directory=""
                        multiple
                        style={{ display: "none" }}
                        onChange={onPickAssets}
                    />
                    🖼️ Add assets folder (images/css)
                </label>

                <div style={{ marginLeft: "auto", opacity: .8 }}>
                    {htmlName ? `Loaded: ${htmlName}` : "No HTML loaded"}
                </div>
            </div>

            <div style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
                {iframeDoc ? (
                    <iframe
                        title="report"
                        srcDoc={iframeDoc}
                        style={{ width: "100%", height: "100%", border: "0" }}
                        sandbox="allow-same-origin allow-scripts allow-forms"
                    />
                ) : (
                    <div style={{ padding: 16, color: "#666" }}>
                        No report loaded. Pick a **folder** that contains the HTML and its “*_files” directory,
                        or open the HTML and then add the assets folder.
                    </div>
                )}
            </div>
        </div>
    );
}
