// /api/pnid-actions.js
// Fully debug-ready version with guaranteed AI chat responses and logs

import { wedgeParse } from "../ai/wedgeParse.js";

export default async function handler(req, res) {
    try {
        if (req.method !== 'POST')
            return res.status(405).json({ error: 'Method not allowed' });

        const { description, nodes = [], edges = [] } = req.body;
        let newNodes = [...nodes];
        let newEdges = [...edges];
        let messages = [];
        let mode = 'idle';

        console.log('Received description:', description);

        if (description && description.trim()) {
            const aiResult = await wedgeParse(description);
            console.log('wedgeParse result:', aiResult);

            mode = aiResult.mode; // 'chat' or 'structured'

            if (mode === 'chat') {
                // Always send at least one AI chat message
                messages.push({ sender: 'AI', message: aiResult.explanation || 'Hello!' });
            } else if (mode === 'structured') {
                // Handle PNID structured command
                const parsed = aiResult.parsed;
                const id = `node-${Date.now()}-${Math.random()}`;

                newNodes.push({
                    id,
                    data: { label: parsed.Code || parsed.Name, item: parsed },
                    type: parsed.Type || 'scalableIcon',
                    position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                });

                messages.push({ sender: 'AI', message: aiResult.explanation || 'Added item' });
            }
        } else {
            messages.push({ sender: 'AI', message: 'Please type something so I can assist you.' });
        }

        console.log('Returning from /api/pnid-actions:', {
            mode,
            messages,
            nodes: newNodes.length,
            edges: newEdges.length
        });

        return res.status(200).json({ mode, nodes: newNodes, edges: newEdges, messages });

    } catch (err) {
        console.error('/api/pnid-actions error:', err);
        return res.status(500).json({ error: 'PNID actions API failed', details: err.message });
    }
}
