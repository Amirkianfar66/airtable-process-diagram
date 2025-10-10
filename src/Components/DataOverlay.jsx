// src/components/DataOverlay.jsx
import React from "react";
import { createPortal } from "react-dom";
import AirtableItemsTable from "../AirtableItemsTable.jsx";

export default function DataOverlay({ open, onClose }) {
    // Close on ESC
    React.useEffect(() => {
        if (!open) return;
        const onEsc = (e) => e.key === "Escape" && onClose?.();
        document.addEventListener("keydown", onEsc);
        return () => document.removeEventListener("keydown", onEsc);
    }, [open, onClose]);

    // Lock background scroll while open
    React.useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    if (!open) return null;

    // SSR / safety guard
    const portalTarget = typeof document !== "undefined" ? document.body : null;
    if (!portalTarget) return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Items (Airtable)"
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                zIndex: 9999,
                display: "grid",
                placeItems: "center",
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "min(1200px, 96vw)",
                    height: "min(750px, 90vh)",
                    background: "#fff",
                    borderRadius: 10,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid #e5e5e5",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <strong style={{ fontSize: 14 }}>Items (Airtable)</strong>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        <button onClick={onClose} style={{ padding: "6px 10px" }}>
                            Close
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
                    <AirtableItemsTable />
                </div>
            </div>
        </div>,
        portalTarget
    );
}
