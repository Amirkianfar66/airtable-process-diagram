import { getItemIcon, categoryTypeMap } from './IconManager';
import { parseItemText } from './aiParser';

// ChatBox component
export function ChatBox({ messages }) {
    return (
        <div style={{ padding: 10 }}>
            {messages.map((msg, idx) => (
                <div
                    key={idx}
                    style={{ marginBottom: 6, color: msg.sender === 'AI' ? 'blue' : 'black' }}
                >
                    <strong>{msg.sender}:</strong> {msg.message}
                </div>
            ))}
        </div>
    );
}

// AI PNID generator
export default async function AIPNIDGenerator(
    description,
    itemsLibrary = [],
    existingNodes = [],
    existingEdges = [],
    setSelectedItem,
    setChatMessages
) {
    if (!description) return { nodes: existingNodes, edges: existingEdges };

    // Parse AI result: explanation + parsed item + connection
    const aiResult = await parseItemText(description);
    if (!aiResult) return { nodes: existingNodes, edges: existingEdges };

    const { explanation, parsed, connection } = aiResult;

    const Name = (parsed?.Name || description).trim();
    const Category = (parsed?.Category && parsed.Category !== '' ? parsed.Category : 'Equipment').trim();
    const Type = (parsed?.Type && parsed.Type !== '' ? parsed.Type : 'Generic').trim();
    const NumberOfItems = parsed?.Number && parsed.Number > 0 ? parsed.Number : 1;

    let newNodes = [];

    // Generate items
    for (let i = 0; i < NumberOfItems; i++) {
        const Code = parsed?.Code ? `${parsed.Code}-${i + 1}` : `U${Math.floor(1000 + Math.random() * 9000)}-${i + 1}`;
        const id = `ai-${Date.now()}-${Math.random()}`;
        const item = { Name, Code, Category, Type, id };

        const newNode = {
            id: item.id,
            position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
            data: { label: `${item.Code} - ${item.Name}`, item, icon: getItemIcon(item) },
            type: categoryTypeMap[Category] || 'scalableIcon',
        };

        newNodes.push(newNode);
    }

    // Set the first generated item as selected for ItemDetailCard
    if (typeof setSelectedItem === 'function' && newNodes.length > 0) {
        setSelectedItem({ ...newNodes[0].data.item }); // deep copy ensures updates
    }

    // Handle connections (edges)
    let newEdges = [...existingEdges];
    if (connection) {
        const allNodes = [...existingNodes, ...newNodes];
        const sourceNode = allNodes.find(n => n.data.item.Code === connection.sourceCode);
        const targetNode = allNodes.find(n => n.data.item.Code === connection.targetCode);

        if (sourceNode && targetNode) {
            newEdges.push({
                id: `edge-${sourceNode.id}-${targetNode.id}`,
                source: sourceNode.id,
                target: targetNode.id,
                animated: true,
            });

            if (typeof setChatMessages === 'function') {
                setChatMessages(prev => [
                    ...prev,
                    { sender: 'AI', message: `→ Connected ${connection.sourceCode} → ${connection.targetCode}` },
                ]);
            }
        }
    }

    // Update chat messages for AI explanation and generated items
    if (typeof setChatMessages === 'function') {
        setChatMessages(prev => [
            ...prev,
            { sender: 'AI', message: explanation || 'I parsed your item.' },
            { sender: 'AI', message: `→ Generated ${newNodes.length} item(s): ${Category} - ${Type}` },
        ]);
    }

    return {
        nodes: [...existingNodes, ...newNodes],
        edges: newEdges,
    };
}
