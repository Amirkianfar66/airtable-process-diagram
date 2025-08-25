export async function parseItemText(description) {
    if (!description) return null;

    try {
        const res = await fetch("/api/parse-item", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description }),
        });

        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        return data;
    } catch (err) {
        console.error("parseItemText error:", err);
        return null;
    }
}
