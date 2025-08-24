// src/aiParser.js
// Helper for calling /api/parse-item from React components

export async function parseItemText(description) {
    console.log("👉 parseItemText called with:", description);  // Debug log
    try {
        const res = await fetch("/api/parse-item", {   // <-- FIXED endpoint
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description }),
        });

        if (!res.ok) throw new Error("API error");

        const data = await res.json();
        console.log("✅ AI response:", data);  // Debug log
        return data;
    } catch (err) {
        console.error("parseItemText error", err);
        return { mode: "chat", messages: [{ sender: "System", message: "⚠️ Failed to talk to AI" }] };
    }
}
