import { getItemIcon, categoryTypeMap } from './IconManager';
import { parseItemText } from './aiParser';

// --------------------------
// ChatBox component
// --------------------------
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

// --------------------------
// AI PNID generator
// --------------------------
export default async function AIPNIDGenerator(
    description,
    itemsLibrary = [],
    existingNodes = [],
    existingEdges = [],
    setSelectedItem,
    setChatMessages
) {
    if (!description) return { nodes: existingNodes, edges: existingEdges };

    // Parse AI output
    const aiResult = await parseItemText(description);
    if (!aiResult) return { nodes: existingNodes, edges: existingEdges };

    const { explanation, parsed, connection } = aiResult;

    const Name = (parsed?.Name || description).trim();
    const Code = (parsed?.Code || `U${Math.floor(1000 + Math.random() * 9000)}`).trim();
    const Category = (parsed?.Category && parsed.Category !== '' ? parsed.Category : 'Equipment').trim();
    const Type = (parsed?.Type && parsed.Type !== '' ? parsed.Type : 'Generic').trim();
    const NumberOfItems = parsed?.Number && parsed.Number > 0 ? parsed.Number : 1;

    let newNodes = [];
    let newEdges = [...existingEdges];

    // --------------------------
    // Generate nodes
    // --------------------------
    for (let i = 0; i < NumberOfItems; i++) {
        const id = `ai-${Date.now()}-${Math.random()}`;
        const item = { Name, Code: `${Code}-${i + 1}`, 'Item Code': `${Code}-${i + 1}`, Category, Type, id };
        const label = `${item.Code} - ${item.Name}`;

        const newNode = {
            id: item.id,
            position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
            data: { label, item, icon: getItemIcon(item) },
            type: categoryTypeMap[Category] || 'scalableIcon',
        };

        newNodes.push(newNode);
    }

    if (typeof setSelectedItem === 'function' && newNodes.length > 0) {
        // ✅ Pass a new object to trigger re-render
        setSelectedItem({ ...newNodes[0].data.item });
    }

    // --------------------------
    // Explicit connections (e.g., "Connect U123 to U456")
    // --------------------------
    if (connection) {
        const sourceNode = [...existingNodes, ...newNodes].find(n => n.data.item.Code === connection.sourceCode);
        const targetNode = [...existingNodes, ...newNodes].find(n => n.data.item.Code === connection.targetCode);

        if (sourceNode && targetNode) {
            const exists = newEdges.some(e => e.source === sourceNode.id && e.target === targetNode.id);
            if (!exists) {
                newEdges.push({
                    id: `edge-${sourceNode.id}-${targetNode.id}`,
                    source: sourceNode.id,
                    target: targetNode.id,
                    animated: true,
                });
            }

            if (typeof setChatMessages === 'function') {
                setChatMessages(prev => [
                    ...prev,
                    { sender: 'AI', message: `→ Connected ${connection.sourceCode} → ${connection.targetCode}` }
                ]);
            }
        }
    }

    // --------------------------
    // Implicit connections for multi-item generation ("connect them")
    // --------------------------
    const implicitConnect = /connect\s+them/i.test(description);
    if (implicitConnect && newNodes.length > 1) {
        for (let i = 0; i < newNodes.length - 1; i++) {
            const exists = newEdges.some(e => e.source === newNodes[i].id && e.target === newNodes[i + 1].id);
            if (!exists) {
                newEdges.push({
                    id: `edge-${newNodes[i].id}-${newNodes[i + 1].id}`,
                    source: newNodes[i].id,
                    target: newNodes[i + 1].id,
                    animated: true,
                });
            }
        }

        if (typeof setChatMessages === 'function') {
            setChatMessages(prev => [
                ...prev,
                { sender: 'AI', message: `→ Automatically connected ${newNodes.length} nodes in sequence.` }
            ]);
        }
    }

    // --------------------------
    // Add AI explanation and generated info
    // --------------------------
    if (typeof setChatMessages === 'function') {
        setChatMessages(prev => [
            ...prev,
            { sender: 'AI', message: explanation || 'I parsed your item.' },
            { sender: 'AI', message: `→ Generated ${newNodes.length} item(s): ${Category} - ${Type}` }
        ]);
    }

    return {
        nodes: [...existingNodes, ...newNodes],
        edges: newEdges,
    };
}
