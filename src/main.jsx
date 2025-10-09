// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import AppTabs from "./AppTabs.jsx";
import "./index.css";

// Optional: early stub so toolbar calls are safe before AppTabs mounts
if (typeof window !== "undefined" && typeof window.setAppTab !== "function") {
    window.setAppTab = (nameOrIndex) => { window.__pendingSetAppTab = nameOrIndex; };
    window.getAppTab = () => "canvas";
}

const rootEl = document.getElementById("root");
if (!rootEl) {
    throw new Error('Root element "#root" not found. Check index.html.');
}

// Mount WITHOUT StrictMode (avoids dev double-mount)
ReactDOM.createRoot(rootEl).render(<AppTabs />);
