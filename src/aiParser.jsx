// src/aiParser.js
// Helper for calling /api/parse-item or /api/pnid-actions from React components

export async function parseItemText(description) {
    try {
        const res = await fetch("/api/pnid-actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description }),
        });

        if (!res.ok) throw new Error("API error");

        const data = await res.json();

        // The backend now may return:
        // 1. { mode: "chat", messages: [...] }
        // 2. { mode: "structured", nodes: [...], edges: [...], messages: [...] }

        return data;
    } catch (err) {
        console.error("parseItemText error", err);
        return { messages: [{ sender: "System", message: "⚠️ Failed to talk to AI" }] };
    }
}
