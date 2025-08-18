import { getItemIcon, categoryTypeMap } from './IconManager';
import { parseItemText } from './aiParser';

// Export ChatBox component
export function ChatBox({ messages }) {
    return (
        <div style={{ padding: 10 }}>
            {messages.map((msg, idx) => (
                <div
                    key={idx}
                    style={{
                        marginBottom: 6,
                        color: msg.sender === 'AI' ? 'blue' : 'black',
                    }}
                >
                    <strong>{msg.sender}:</strong> {msg.message}
                </div>
            ))}
        </div>
    );
}

// Default export: AI PNID generator
export default async function AIPNIDGenerator(
    description,
    itemsLibrary = [],
    existingNodes = [],
    existingEdges = [],
    setSelectedItem,
    setChatMessages
) {
    if (!description) return { nodes: existingNodes, edges: existingEdges };

    // ✅ parseItemText now returns { explanation, parsed }
    const aiResult = await parseItemText(description);
    if (!aiResult) return { nodes: existingNodes, edges: existingEdges };

    const { explanation, parsed } = aiResult;

    const Name = (parsed?.Name || description).trim();
    const Category = (parsed?.Category && parsed.Category !== '' ? parsed.Category : 'Equipment').trim();
    const Type = (parsed?.Type && parsed.Type !== '' ? parsed.Type : 'Generic').trim();

    const match = itemsLibrary.find(
        item =>
            item.Name?.toLowerCase() === Name.toLowerCase() &&
            item.Category?.toLowerCase() === Category.toLowerCase() &&
            item.Type?.toLowerCase() === Type.toLowerCase()
    );

    const item = match || { Name, Category, Type, id: `ai-${Date.now()}-${Math.random()}` };
    const label = `${item.Code || ''}${item.Code ? ' - ' : ''}${item.Name}`;

    const newNode = {
        id: item.id,
        position: {
            x: Math.random() * 600 + 100,
            y: Math.random() * 400 + 100,
        },
        data: {
            label,
            item,
            icon: getItemIcon(item),
        },
        type: categoryTypeMap[Category] || 'scalableIcon',
    };

    if (typeof setSelectedItem === 'function') setSelectedItem(item);

    if (typeof setChatMessages === 'function') {
        setChatMessages(prev => [
            ...prev,
            { sender: 'AI', message: explanation || 'I parsed your item.' },
            {
                sender: 'AI',
                message: `→ Parsed JSON: Name=${item.Name}, Category=${item.Category}, Type=${item.Type}`,
            },
        ]);
    }

    return {
        nodes: [...existingNodes, newNode],
        edges: [...existingEdges],
    };
}
