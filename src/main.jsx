// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import AppTabs from "./AppTabs.jsx";
import "./index.css";

// (optional) super-early stub so toolbar calls are safe pre-mount
if (typeof window !== "undefined" && typeof window.setAppTab !== "function") {
    window.setAppTab = (nameOrIndex) => { window.__pendingSetAppTab = nameOrIndex; };
    window.getAppTab = () => "canvas";
}

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <AppTabs />
    </React.StrictMode>
);
