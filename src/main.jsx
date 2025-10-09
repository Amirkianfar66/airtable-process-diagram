// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import AppTabs from "./AppTabs.jsx";
import "./index.css";

// --- Super-early global stub (so toolbar can call it before AppTabs mounts) ---
if (typeof window !== "undefined" && typeof window.setAppTab !== "function") {
    window.setAppTab = (nameOrIndex) => { window.__pendingSetAppTab = nameOrIndex; };
    window.getAppTab = () => "canvas";
}

// --- Mount the 3-tab shell (Data / 2D / 3D) ---
ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <AppTabs />
    </React.StrictMode>
);

// --- OPTIONAL: AI send button wiring (only if you still have #user-input / #send-btn in HTML) ---
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

let sending = false;
let currentPNID = window.__pnid || { nodes: [], edges: [] };
window.__pnid = currentPNID;

async function sendMessage() {
    if (sending) return;
    const text = input?.value?.trim?.() ?? "";
    if (!text) return;

    sending = true;
    if (sendBtn) sendBtn.disabled = true;

    try {
        const res = await fetch("/api/ai-generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: text, context: window.__pnid || currentPNID }),
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();

        if (data?.updatedPNID) {
            currentPNID = data.updatedPNID;
            window.__pnid = currentPNID;
            // notify React canvas
            window.dispatchEvent(new CustomEvent("pnid:update", { detail: currentPNID }));
            // jump to 2D tab so the user sees the result
            window.setAppTab?.("canvas");
        }
    } catch (err) {
        console.error("AI generate failed:", err);
        alert(err?.message || "AI generate failed");
    } finally {
        sending = false;
        if (sendBtn) sendBtn.disabled = false;
    }
}

const onClickSend = () => sendMessage();
const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
};

sendBtn?.addEventListener("click", onClickSend);
input?.addEventListener("keydown", onKeyDown);

// HMR cleanup
if (import.meta?.hot) {
    import.meta.hot.dispose(() => {
        sendBtn?.removeEventListener("click", onClickSend);
        input?.removeEventListener("keydown", onKeyDown);
    });
}
