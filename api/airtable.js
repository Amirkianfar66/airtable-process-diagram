// /api/airtable.js
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      // fetch all items
      const records = await base("Items").select({}).all();
      res.status(200).json(records.map(r => ({ id: r.id, ...r.fields })));
    } 
    else if (req.method === "PATCH") {
      // update item
      const { id, fields } = req.body;
      const updated = await base("Items").update([{ id, fields }]);
      res.status(200).json(updated[0]);
    } 
    else if (req.method === "POST") {
      // add new item
      const { fields } = req.body;
      const created = await base("Items").create([{ fields }]);
      res.status(200).json(created[0]);
    }
    else if (req.method === "DELETE") {
      const { id } = req.query;
      await base("Items").destroy([id]);
      res.status(200).json({ id });
    } 
    else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
