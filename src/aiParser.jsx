// src/aiParser.js
// Helper for calling /api/parse-item from React components

export async function parseItemText(description) {
    console.log("👉 parseItemText called with:", description); // Debug log
    try {
        const res = await fetch("/api/parse-item", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description }),
        });

        if (!res.ok) throw new Error("API error");

        const data = await res.json();
        console.log("✅ AI response:", data); // Debug log

        // ✅ Normalize the shape
        return {
            mode: data.mode ?? "chat",
            messages: data.messages ?? [],
            parsed: data.parsed ?? null,
            explanation: data.explanation ?? null,
        };
    } catch (err) {
        console.error("parseItemText error", err);

        // ✅ Always return safe fallback
        return {
            mode: "chat",
            messages: [{ role: "assistant", content: "⚠️ Failed to talk to AI" }],
            parsed: null,
            explanation: null,
        };
    }
}
