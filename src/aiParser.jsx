// aiParser.js
/**
 * Frontend helper: calls the backend /api/parse-item endpoint.
 * Returns { Name, Category, Type } or null on failure.
 */

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
        // Expect object with Name, Category, Type
        if (data && typeof data === 'object') {
            return {
                Name: (data.Name ?? data.name ?? '').toString(),
                Category: (data.Category ?? data.category ?? '').toString(),
                Type: (data.Type ?? data.type ?? '').toString(),
            };
        }
        return null;
    } catch (err) {
        console.error('parseItemText error', err);
        return null;
    }
}
