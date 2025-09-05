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

        // 🔹 Build an explanation for the chat based on what was parsed
        const explanation = buildExplanation(data);

        // ✅ Always return unified format from backend, plus explanation
        return {
            ...data,
            messages: [
                ...(data.messages || []),
                { role: "assistant", content: explanation }
            ]
        };

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

// Helper to turn structured parse into readable chat text
function buildExplanation(data) {
    if (!data?.orders) return "I couldn’t understand your request.";

    const parts = [];

    // Items
    const drawOrders = data.orders.filter(o => o.action === "Draw");
    drawOrders.forEach(o => {
        o.items.forEach(it => {
            const count = it.Count || it.Number || 1;
            parts.push(`draw ${count} ${it.Name}(s)`);
        });
    });

    // Connections
    const connectOrders = data.orders.filter(o => o.action === "Connect");
    connectOrders.forEach(o => {
        o.connections.forEach(conn => {
            parts.push(`connect ${conn.from} → ${conn.to}`);
        });
    });

    return "I understood: " + parts.join(", ");
}
