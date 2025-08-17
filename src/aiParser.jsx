// src/aiParser.js  (or wherever you keep helpers)
export async function parseItemText(description, categories = undefined) {
    if (!description) return null;
    try {
        const body = { description };
        if (Array.isArray(categories)) body.categories = categories;
        const res = await fetch('/api/parse-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            console.error('parseItemText: server returned', res.status);
            return null;
        }
        const data = await res.json();
        return {
            Name: (data.Name ?? data.name ?? '').toString(),
            Category: (data.Category ?? data.category ?? '').toString(),
            Type: (data.Type ?? data.type ?? '').toString(),
        };
    } catch (err) {
        console.error('parseItemText error', err);
        return null;
    }
}
