// src/aiParser.js
// Helper for calling /api/parse-item or /api/pnid-actions from React components

// src/aiParser.js
export async function parseItemText(description) {
    console.log("👉 parseItemText called with:", description);  // Debug log
    try {
        const res = await fetch("/api/pnid-actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description }),
        });

        if (!res.ok) throw new Error("API error");

        const data = await res.json();
        return data;
    } catch (err) {
        console.error("parseItemText error", err);
        return { messages: [{ sender: "System", message: "⚠️ Failed to talk to AI" }] };
    }
}

