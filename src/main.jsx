// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { ReactFlowProvider } from "reactflow";
import AppTabs from "./AppTabs.jsx";
import "./index.css";

// (optional) stub so toolbar can switch tabs before AppTabs mounts
if (typeof window !== "undefined" && typeof window.setAppTab !== "function") {
    window.setAppTab = (nameOrIndex) => { window.__pendingSetAppTab = nameOrIndex; };
    window.getAppTab = () => "canvas";
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Missing <div id="root"></div> in index.html');

createRoot(rootEl).render(
    <ReactFlowProvider>
        <AppTabs />
    </ReactFlowProvider>
);
