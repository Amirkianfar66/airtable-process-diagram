import { getItemIcon, categoryTypeMap } from './IconManager';

// --------------------------
// ChatBox component
// --------------------------
export function ChatBox({ messages }) {
    const aiMessage = messages
        .filter(msg => msg.sender === 'AI')
        .map(msg => msg.message)
        .join(' ');

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
            {aiMessage && (
                <div style={{ color: 'black', fontSize: '14px', lineHeight: '1.5' }}>
                    <strong>AI:</strong> {aiMessage}
                </div>
            )}
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
    if (!description && action === 'add') return { nodes: existingNodes, edges: existingEdges };

    try {
        const res = await fetch('/api/pnid-actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                description,
                existingNodes,
                existingEdges,
                ...options
            })
        });

        if (!res.ok) throw new Error('PNID actions API error');
        const { nodes, edges, messages } = await res.json();

        // Update ChatBox
        if (typeof setChatMessages === 'function' && messages?.length) {
            setChatMessages(prev => [...prev, ...messages.map(m => ({ sender: 'AI', message: m }))]);
        }

        return { nodes, edges };
    } catch (err) {
        console.error('AIPNIDGenerator error', err);
        return { nodes: existingNodes, edges: existingEdges };
    }
}
