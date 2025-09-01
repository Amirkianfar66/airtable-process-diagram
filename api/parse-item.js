// =============================
explanation: '⚠️ AI processing failed: ' + (err.message || 'Unknown error'),
    mode: 'chat',
        connection: null,
            connectionResolved: [],
                connections: [],
};
}
}


// Default API handler
export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');


        const { description } = req.body;
        if (!description) return res.status(400).json({ error: 'Missing description' });


        const aiResult = await parseItemLogic(description);
        res.status(200).json(aiResult);
    } catch (err) {
        console.error('/api/parse-item error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
}