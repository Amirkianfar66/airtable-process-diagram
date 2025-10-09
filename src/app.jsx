import React from "react";
import { createRoot } from "react-dom/client";
import AppTabs from "./AppTabs.jsx";     // ← NEW: tabbed shell (you’ll add it in step 2)

// keep these if your HTML has them outside React
const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");

// mount React once (tabs inside)
const root = createRoot(document.getElementById("canvas-root"));
root.render(<AppTabs />);

// global PNID (shared with React)
let currentPNID = window.__pnid || { nodes: [], edges: [] };
window.__pnid = currentPNID;

// --- AI button handler (unchanged API, but no direct root.render) ---
async function sendMessage() {
    const text = input?.value?.trim?.() ?? "";
    if (!text) return;

    const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text, context: window.__pnid || currentPNID })
    });
    const data = await res.json();

    if (data.updatedPNID) {
        currentPNID = data.updatedPNID;
        window.__pnid = currentPNID;
        // 🔁 tell React to update the canvas PNID (without replacing the whole app)
        window.dispatchEvent(new CustomEvent("pnid:update", { detail: currentPNID }));
    }
}

sendBtn?.addEventListener("click", sendMessage);
