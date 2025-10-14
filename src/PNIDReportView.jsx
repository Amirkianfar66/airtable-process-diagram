// src/PNIDReportView.jsx
import React, { useMemo } from "react";

export default function PNIDReportView() {
    // Vite serves anything in /public at the site root.
    // You can also pass a default CSV via env: VITE_PNID_REPORT_DEFAULT_URL
    const htmlPath = useMemo(() => `/linelist.html`, []);
    const csvUrl = import.meta.env.VITE_PNID_REPORT_DEFAULT_URL || "";

    const src = csvUrl
        ? `${htmlPath}?url=${encodeURIComponent(csvUrl)}`
        : htmlPath;

    return (
        <div style={{ width: "100%", height: "100%", display: "flex" }}>
            <iframe
                title="PNID Linelist Report"
                src={src}
                style={{ border: "none", width: "100%", height: "100%" }}
            />
        </div>
    );
}
