import { getItemIcon, categoryTypeMap } from './IconManager';

// --------------------------
// ChatBox component
// --------------------------
export function ChatBox({ messages }) {
    return (
        <div
            style={{
                padding: 10,
                border: '2px solid #007bff',
                borderRadius: 8,
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: '#f9f9f9'
            }}
        >
            {messages.length === 0 && (
                <div style={{ color: '#888' }}>No conversation yet...</div>
            )}

            {messages.map((msg, idx) => (
                <div
                    key={idx}
                    style={{
                        textAlign: msg.sender === 'ai' ? 'left' : 'right',
                        marginBottom: 6
                    }}
                >
                    <strong style={{ color: msg.sender === 'ai' ? '#007bff' : '#333' }}>
                        {msg.sender === 'ai' ? 'AI' : 'You'}:
                    </strong>{' '}
                    {msg.message}
                </div>
            ))}
        </div>
    );
}

// --------------------------
// AI PNID generator
// --------------------------
export default async function AIPNIDGenerator(
    description,
    existingNodes = [],
    existingEdges = [],
    setChatMessages,
    action = 'add', // can be 'add', 'connect', 'delete'
    options = {} // extra params like { sourceCode, targetCode, code }
) {
    if (!description && action === 'add') {
        return { nodes: existingNodes, edges: existingEdges };
    }

    try {
        const res = await fetch('/api/pnid-actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                description,          // 👈 make sure description is always sent
                existingNodes,
                existingEdges,
                ...options
            })
        });

        if (!res.ok) throw new Error('PNID actions API error');
        const { nodes, edges, messages } = await res.json();


        // Update ChatBox
        if (typeof setChatMessages === 'function' && messages?.length) {
            setChatMessages(prev => [
                ...prev,
                ...messages.map(m => ({ sender: 'ai', message: m }))
            ]);
        }

        return { nodes, edges };
    } catch (err) {
        console.error('AIPNIDGenerator error', err);
        if (typeof setChatMessages === 'function') {
            setChatMessages(prev => [
                ...prev,
                { sender: 'ai', message: '⚠️ Error generating PNID.' }
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }
}
