// src/aiParser.js
export async function aiParser(description) {
    const res = await fetch("/api/parse-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
    });

    if (!res.ok) {
        throw new Error("Failed to call AI parser API");
    }

    return res.json();
}
