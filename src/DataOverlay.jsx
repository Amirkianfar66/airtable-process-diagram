// src/components/DataOverlay.jsx
import React from "react";
import ReactDOM from "react-dom";
import AirtableItemsTable from "../AirtableItemsTable.jsx";

export default function DataOverlay({ open, onClose }) {
    React.useEffect(() => {
        const onEsc = (e) => e.key === "Escape" && onClose?.();
        if (open) document.addEventListener("keydown", onEsc);
        return () => document.removeEventListener("keydown", onEsc);
    }, [open, onClose]);

    if (!open) return null;

    const body = document.body;
    return ReactDOM.createPortal(
        <div
            role="dialog"
            aria-label="Items (Airtable)"
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                zIndex: 9999,
                display: "grid",
                placeItems: "center",
            }}
            onMouseDown={onClose}
        >
            <div
                onMouseDown={(e) => e.stopPropagation()}
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
                        <button onClick={onClose} style={{ padding: "6px 10px" }}>Close</button>
                    </div>
                </div>

                <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
                    <AirtableItemsTable />
                </div>
            </div>
        </div>,
        body
    );
}
