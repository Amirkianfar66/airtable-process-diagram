// api/airtable/update.js
module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.statusCode = 405;
        return res.end("Method Not Allowed");
    }

    try {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const bodyStr = Buffer.concat(chunks).toString() || "{}";
        const { id, fields } = JSON.parse(bodyStr);

        if (!id || !fields) {
            res.statusCode = 400;
            return res.end("Missing id or fields");
        }

        const baseId = process.env.AIRTABLE_BASE_ID;
        const token = process.env.AIRTABLE_TOKEN;
        const table = process.env.AIRTABLE_TABLE_NAME;

        const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${id}`;
        const r = await fetch(url, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ fields }),
        });

        const data = await r.json();
        if (!r.ok) {
            res.statusCode = r.status;
            return res.end(JSON.stringify(data));
        }

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, record: data }));
    } catch (e) {
        res.statusCode = 500;
        res.end(String(e?.message || e));
    }
};
