// src/ai/aiParser.js
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
        return data; // { mode, nodes, edges, messages }
    } catch (err) {
        console.error("parseItemText error:", err);
        return null;
    }
}