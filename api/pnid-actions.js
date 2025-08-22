// /api/pnid-actions.js
// Executes AI-suggested PNID actions: add item, connect nodes, delete item
import { generateCode } from "../src/codeGenerator.js";
import { wedgeParse } from "../ai/wedgeParse.js";

export default async function handler(req, res) {
  const { action, description, existingNodes = [], existingEdges = [] } = req.body;

  if (!action) return res.status(400).json({ error: "Missing action" });

  let nodes = [...existingNodes];
  let edges = [...existingEdges];
  let messages = [];

  try {
    switch (action) {
      case "add": {
        const aiResult = await wedgeParse(description);
        const parsed = aiResult?.parsed || {};

        const code = generateCode({
          Category: parsed.Category || "Equipment",
          Type: parsed.Type || "Generic",
          Unit: parsed.Unit || 0,
          SubUnit: parsed.SubUnit || 0,
          Sequence: parsed.Sequence || 1,
          SensorType: parsed.SensorType || ""
        });

        const id = crypto.randomUUID ? crypto.randomUUID() : `ai-${Date.now()}`;
        const item = { ...parsed, Code: code, id };

        nodes.push({
          id,
          position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
          data: { label: `${code} - ${parsed.Name || "Item"}`, item },
          type: parsed.Category || "scalableIcon"
        });

        messages.push(`Added item: ${code}`);
        break;
      }

      case "connect": {
        const { sourceCode, targetCode } = req.body;
        const sourceNode = nodes.find(n => n.data.item.Code === sourceCode);
        const targetNode = nodes.find(n => n.data.item.Code === targetCode);

        if (sourceNode && targetNode) {
          const exists = edges.some(e => e.source === sourceNode.id && e.target === targetNode.id);
          if (!exists) {
            edges.push({
              id: `edge-${sourceNode.id}-${targetNode.id}`,
              source: sourceNode.id,
              target: targetNode.id,
              animated: true
            });
            messages.push(`Connected ${sourceCode} → ${targetCode}`);
          }
        }
        break;
      }

      case "delete": {
        const { code } = req.body;
        nodes = nodes.filter(n => n.data.item.Code !== code);
        edges = edges.filter(e => e.source !== code && e.target !== code);
        messages.push(`Deleted item: ${code}`);
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    res.json({ nodes, edges, messages });
  } catch (err) {
    console.error("pnid-actions error", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
