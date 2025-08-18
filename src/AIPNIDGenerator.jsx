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
    const Code = (parsed?.Code || `U${Math.floor(1000 + Math.random() * 9000)}`).trim();
    const Category = (parsed?.Category && parsed.Category !== '' ? parsed.Category : 'Equipment').trim();
    const Type = (parsed?.Type && parsed.Type !== '' ? parsed.Type : 'Generic').trim();
    const NumberOfItems = parsed?.Number && parsed.Number > 0 ? parsed.Number : 1;

    let newNodes = [];

    for (let i = 0; i < NumberOfItems; i++) {
        const id = `ai-${Date.now()}-${Math.random()}`;
        const item = { Name, Code: `${Code}-${i + 1}`, Category, Type, id };
        const label = `${item.Code} - ${item.Name}`;

        const newNode = {
            id: item.id,
            position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
            data: { label, item, icon: getItemIcon(item) },
            type: categoryTypeMap[Category] || 'scalableIcon',
        };

        newNodes.push(newNode);
    }

    if (typeof setSelectedItem === 'function') setSelectedItem(newNodes[0].data.item);

    if (typeof setChatMessages === 'function') {
        setChatMessages(prev => [
            ...prev,
            { sender: 'AI', message: explanation || 'I parsed your item.' },
            { sender: 'AI', message: `→ Generated ${newNodes.length} item(s): ${Category} - ${Type}` }
        ]);
    }

    return {
        nodes: [...existingNodes, ...newNodes], // ✅ use newNodes array
        edges: [...existingEdges],
    };

}


