// api/airtable/types.js
import Airtable from "airtable";

const TABLE_EQUIP = process.env.AIRTABLE_TYPES_TABLE_ID;
const TABLE_VALVE = process.env.AIRTABLE_ValveTYPES_TABLE_ID;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_API_KEY;

// Basic handler
export default async function handler(req, res) {
  try {
    // health-check support (optional)
    if (req.method === 'GET' && req.query._health === '1') {
      return res.status(200).json({ ok: true });
    }

    // dev fallback to avoid crashes (remove or keep for local dev)
    if (!API_KEY || !BASE_ID) {
      return res.status(500).json({ error: 'Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID env vars.' });
    }

    const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);
    const out = [];

    if (TABLE_EQUIP) {
      const equipRecs = await base(TABLE_EQUIP).select({ pageSize: 100 }).all();
      equipRecs.forEach(r => {
        out.push({
          id: r.id,
          name: r.fields['Still Pipe'] || r.fields['Name'] || '',
          category: r.fields['Category'] || 'Equipment',
        });
      });
    }

    if (TABLE_VALVE) {
      const valveRecs = await base(TABLE_VALVE).select({ pageSize: 100 }).all();
      valveRecs.forEach(r => {
        out.push({
          id: r.id,
          name: r.fields['Still Pipe'] || r.fields['Name'] || '',
          category: 'Inline Valve',
        });
      });
    }

    return res.status(200).json({ types: out });
  } catch (err) {
    console.error('api/airtable/types error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
