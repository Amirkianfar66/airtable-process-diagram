// src/ai/aiParser.js

// Calls the backend API (/api/pnid-actions) and returns a unified response
export async function parseItemText(description, nodes = [], edges = []) {
    if (!description) return null;

    try {
        const res = await fetch("/api/pnid-actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description, nodes, edges }),
        });

        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        // ✅ Always return unified format from backend:
        // { mode, nodes, edges, messages: [{ role, content }] }
        return data;

    } catch (err) {
        console.error("parseItemText error:", err);
        return {
            mode: "chat",
            messages: [
                { role: "assistant", content: "⚠️ Something went wrong while parsing your request." }
            ],
            nodes,
            edges
        };
    }
}
