// api/airtable.js
import Airtable from "airtable";

const API_KEY = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE = process.env.AIRTABLE_TABLE_NAME;

if (!API_KEY || !BASE_ID || !TABLE) {
  console.warn("Missing one of AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME env vars");
}

export default async function handler(req, res) {
  try {
    if (!API_KEY || !BASE_ID || !TABLE) {
      return res.status(500).json({ error: "Server env vars not configured" });
    }

    const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

    // Parse body if needed
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) {}
    }

    if (req.method === "GET") {
      const records = await base(TABLE).select({ pageSize: 100 }).all();
      const items = records.map(r => ({ id: r.id, ...r.fields }));
      return res.status(200).json({ items });
    }

    if (req.method === "POST") {
      const { fields } = body;
      if (!fields) return res.status(400).json({ error: "Missing fields" });
      const created = await base(TABLE).create([{ fields }]);
      return res.status(201).json({ id: created[0].id, fields: created[0].fields });
    }

    if (req.method === "PATCH") {
      const { id, fields } = body;
      if (!id || !fields) return res.status(400).json({ error: "Missing id or fields" });
      const updated = await base(TABLE).update([{ id, fields }]);
      return res.status(200).json({ id: updated[0].id, fields: updated[0].fields });
    }

    if (req.method === "DELETE") {
      const id = req.query.id || (body && body.id);
      if (!id) return res.status(400).json({ error: "Missing id" });
      await base(TABLE).destroy([id]);
      return res.status(200).json({ id });
    }

    res.setHeader("Allow", "GET,POST,PATCH,DELETE");
    return res.status(405).end("Method Not Allowed");

  } catch (err) {
    console.error("api/airtable error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
