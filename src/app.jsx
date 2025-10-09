import React from "react";
import { createRoot } from "react-dom/client";
import AppTabs from "./AppTabs.jsx";

// Mount React once (tabs inside)
const root = createRoot(document.getElementById("canvas-root"));
root.render(<AppTabs />);

// DOM elements (outside React)
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Global PNID (shared with React)
let currentPNID = window.__pnid || { nodes: [], edges: [] };
window.__pnid = currentPNID;

// -------- AI send handler --------
let sending = false;

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
            body: JSON.stringify({
                description: text,
                context: window.__pnid || currentPNID,
            }),
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

        const data = await res.json();

        if (data?.updatedPNID) {
            currentPNID = data.updatedPNID;
            window.__pnid = currentPNID;

            // Notify React (PNIDCanvas listens to this)
            window.dispatchEvent(new CustomEvent("pnid:update", { detail: currentPNID }));

            // Jump to the 2D Canvas tab so the user sees the result
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

// Click + Enter-to-send
const onClickSend = () => sendMessage();
const onKeyDown = (e) => {
    // Press Enter to send (Shift+Enter makes a new line if it's a textarea)
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
};

sendBtn?.addEventListener("click", onClickSend);
input?.addEventListener("keydown", onKeyDown);

// --- HMR cleanup (avoid duplicate listeners during dev) ---
if (import.meta?.hot) {
    import.meta.hot.dispose(() => {
        sendBtn?.removeEventListener("click", onClickSend);
        input?.removeEventListener("keydown", onKeyDown);
    });
}
