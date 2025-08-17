// pages/api/parse-item.js

export default function handler(req, res) {
    if (req.method === "POST") {
        // Example: read JSON body
        const { description } = req.body;

        res.status(200).json({
            ok: true,
            received: description || "No description provided",
        });
    } else {
        res.status(405).json({ ok: false, error: "Only POST allowed" });
    }
}
