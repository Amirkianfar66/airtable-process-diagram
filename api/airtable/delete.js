// api/airtable/delete.js
module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.statusCode = 405;
        return res.end("Method Not Allowed");
    }

    try {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const bodyStr = Buffer.concat(chunks).toString() || "{}";
        const { ids } = JSON.parse(bodyStr);

        if (!Array.isArray(ids) || ids.length === 0) {
            res.statusCode = 400;
            return res.end("Missing ids array");
        }

        const baseId = process.env.AIRTABLE_BASE_ID;
        const token = process.env.AIRTABLE_TOKEN;
        const table = process.env.AIRTABLE_TABLE_NAME;

        const deleted = [];
        // Airtable allows up to 10 records per delete request
        for (let i = 0; i < ids.length; i += 10) {
            const chunk = ids.slice(i, i + 10);
            const qs = chunk.map(id => `records[]=${encodeURIComponent(id)}`).join("&");
            const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?${qs}`;

            const r = await fetch(url, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await r.json();
            if (!r.ok) {
                res.statusCode = r.status;
                return res.end(JSON.stringify(data));
            }
            for (const d of data.records || []) {
                if (d?.deleted && d?.id) deleted.push(d.id);
            }
        }

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, deleted }));
    } catch (e) {
        res.statusCode = 500;
        res.end(String(e?.message || e));
    }
};
