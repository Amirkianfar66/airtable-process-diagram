import { pickType } from "../utils.js";

export default function parseItem(req, res) {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: "Missing description" });

  const parts = description.split(/,|\band\b/i).map(p => p.trim()).filter(Boolean);
  let codeCounter = 1;
  const items = parts.map(part => {
    const Type = pickType(part);
    return {
      id: `U${String(codeCounter++).padStart(3, "0")}`,
      type: Type,
      name: Type
    };
  });

  res.json({ items });
}
