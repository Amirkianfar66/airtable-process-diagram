// src/PNIDReportView.jsx
import React, { useEffect, useMemo, useState } from "react";

export default function PNIDReportView() {
    // 1) Where to load the report from:
    //    - URL param ?reportUrl=...
    //    - localStorage
    //    - env var VITE_PNID_REPORT_EMBED_URL (default for everyone)
    const urlFromQuery = (() => {
        try {
            const u = new URL(window.location.href);
            return u.searchParams.get("reportUrl") || "";
        } catch {
            return "";
        }
    })();

    const [reportUrl, setReportUrl] = useState(
        () =>
            urlFromQuery ||
            localStorage.getItem("pnidReport:embedUrl") ||
            import.meta.env.VITE_PNID_REPORT_EMBED_URL ||
            ""
    );

    // simple way to force iframe reloads
    const [reloadKey, setReloadKey] = useState(0);
    const [status, setStatus] = useState < "idle" | "loading" | "ok" | "error" > ("idle");

    // Persist URL
    useEffect(() => {
        if (reportUrl) localStorage.setItem("pnidReport:embedUrl", reportUrl);
    }, [reportUrl]);

    // Build final src (you can append extra params if your report expects them)
    const iframeSrc = useMemo(() => reportUrl.trim(), [reportUrl]);

    // Kick off loading state when src changes
    useEffect(() => {
        if (!iframeSrc) return;
        setStatus("loading");
    }, [iframeSrc, reloadKey]);

    const saveAndOpen = () => {
        const v = reportUrl.trim();
        if (!v) return;
        localStorage.setItem("pnidReport:embedUrl", v);
        setReloadKey((k) => k + 1);
    };

    const refresh = () => setReloadKey((k) => k + 1);

    const openInNewTab = () => {
        if (!iframeSrc) return;
        window.open(iframeSrc, "_blank", "noopener,noreferrer");
    };

    const hint =
        "If the page stays blank, the remote server may block embedding (X-Frame-Options or Content-Security-Policy). Use Open in new tab.";

    const topBtn = (active) => ({
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #ddd",
        background: active ? "#111" : "#fff",
        color: active ? "#fff" : "#111",
        cursor: "pointer",
    });
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
            {/* Header / Controls */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderBottom: "1px solid #eee",
                    background: "#fafafa",
                }}
            >
                <div style={{ fontWeight: 600 }}>Embedded RC Report (HTML/PDF)</div>
                <input
                    value={reportUrl}
                    onChange={(e) => setReportUrl(e.target.value)}
                    placeholder="https://your-server/path/to/report.html or .pdf"
                    style={{ flex: 1, padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8, marginLeft: 8 }}
                />
                <button onClick={saveAndOpen} style={btnLight}>Save & Open</button>
                <button onClick={refresh} style={btnLight} disabled={!iframeSrc}>Refresh</button>
                <button onClick={openInNewTab} style={btnLight} disabled={!iframeSrc}>Open in new tab</button>

                <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                    {status === "loading" && "Loading…"}
                    {status === "error" && "Can’t display (blocked?)."}
                </div>
            </div>

            {/* Body */}
            {!iframeSrc ? (
                <div style={{ padding: 16, color: "#666" }}>
                    Paste the public <b>HTML/PDF</b> report URL exported by Report Creator and click <b>Save & Open</b>.
                    <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>{hint}</div>
                </div>
            ) : (
                <div style={{ position: "relative" }}>
                    {/* Loading overlay */}
                    {status === "loading" && (
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

                    {/* Iframe showing the remote report */}
                    <iframe
                        key={reloadKey}
                        title="PNID Report"
                        src={iframeSrc}
                        // Avoid sandbox unless you know the report needs it; sandbox can break scripts/styles.
                        style={{ width: "100%", height: "100vh", border: "none" }}
                        onLoad={() => setStatus("ok")}
                    />

                    {/* Fallback hint (overlay link) if embedding is blocked */}
                    {status === "ok" ? null : (
                        <div style={{ position: "absolute", bottom: 8, left: 12, right: 12, fontSize: 12, color: "#666" }}>
                            {hint}{" "}
                            {iframeSrc && (
                                <>
                                    <span> </span>
                                    <a href={iframeSrc} target="_blank" rel="noopener noreferrer">
                                        Open now
                                    </a>
                                    .
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
