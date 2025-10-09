// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { ReactFlowProvider } from "reactflow";
import AppTabs from "./AppTabs.jsx";
import "./index.css";

// Optional: define a stub before AppTabs mounts so toolbar calls are safe
if (typeof window !== "undefined" && typeof window.setAppTab !== "function") {
    window.setAppTab = (nameOrIndex) => { window.__pendingSetAppTab = nameOrIndex; };
    window.getAppTab = () => "canvas";
}

const el = document.getElementById("root"); // <-- matches your index.html
if (!el) throw new Error('Could not find #root. Check index.html');

createRoot(el).render(
    // No StrictMode (avoids dev double-mount)
    <ReactFlowProvider>
        <AppTabs />
    </ReactFlowProvider>
);
