import { getItemIcon, categoryTypeMap } from './IconManager';
import { generateCode } from './codeGenerator';

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
// AI PNID generator (client-side fetch to server)
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

    // Call serverless API
    const res = await fetch('/api/parse-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
    });
    const aiResult = await res.json();
    if (!aiResult) return { nodes: existingNodes, edges: existingEdges };

    const { mode, explanation, parsed, connection } = aiResult;

    // Conversational/human mode
    if (mode === 'chat') {
        if (typeof setChatMessages === 'function') {
            setChatMessages(prev => [
                ...prev,
                { sender: 'User', message: description },
                { sender: 'AI', message: explanation }
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

    // Structured PNID logic
    const Name = (parsed?.Name || description).trim();
    let Category = (parsed?.Category || 'Equipment').trim();
    let Type = (parsed?.Type || 'Generic').trim();
    const NumberOfItems = parsed?.Number > 0 ? parsed.Number : 1;

    let newNodes = [];
    let newEdges = [...existingEdges];

    const Unit = parsed?.Unit || 0;
    const SubUnit = parsed?.SubUnit || 0;

    let updatedCode = generateCode({
        Category, Type, Unit, SubUnit, Sequence: parsed?.Sequence || 1, SensorType: parsed?.SensorType || ""
    });

    let allCodes = [updatedCode, ...(parsed._otherCodes || [])].filter(Boolean);
    if ((!parsed._otherCodes || parsed._otherCodes.length === 0) && NumberOfItems > 1) {
        const baseSeq = parsed?.Sequence || 1;
        for (let i = 1; i < NumberOfItems; i++) {
            const nextCode = generateCode({ Category, Type, Unit, SubUnit, Sequence: baseSeq + i, SensorType: parsed?.SensorType || "" });
            if (nextCode) allCodes.push(nextCode);
        }
    }

    const allMessages = [{ sender: 'User', message: description }];
    const generatedCodesMessages = [];

    allCodes.forEach(code => {
        const id = crypto.randomUUID ? crypto.randomUUID() : `ai-${Date.now()}-${Math.random()}`;
        const item = { Name, Code: code, 'Item Code': code, Category, Type, Unit, SubUnit, id };
        const label = `${item.Code} - ${item.Name}`;
        newNodes.push({ id, position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 }, data: { label, item, icon: getItemIcon(item) }, type: categoryTypeMap[Category] || 'scalableIcon' });
        generatedCodesMessages.push({ sender: 'AI', message: `Generated code: ${code}` });
    });

    allMessages.push({ sender: 'AI', message: explanation });
    allMessages.push(...generatedCodesMessages);

    // Explicit connections
    if (connection) {
        const sourceNode = [...existingNodes, ...newNodes].find(n => n.data.item.Code === connection.sourceCode);
        const targetNode = [...existingNodes, ...newNodes].find(n => n.data.item.Code === connection.targetCode);
        if (sourceNode && targetNode && !newEdges.some(e => e.source === sourceNode.id && e.target === targetNode.id)) {
            newEdges.push({ id: `edge-${sourceNode.id}-${targetNode.id}`, source: sourceNode.id, target: targetNode.id, animated: true });
            allMessages.push({ sender: 'AI', message: `→ Connected ${connection.sourceCode} → ${connection.targetCode}` });
        }
    }

    // Implicit sequential connections
    if (/connect/i.test(description) && newNodes.length > 1) {
        for (let i = 0; i < newNodes.length - 1; i++) {
            if (!newEdges.some(e => e.source === newNodes[i].id && e.target === newNodes[i + 1].id)) {
                newEdges.push({ id: `edge-${newNodes[i].id}-${newNodes[i + 1].id}`, source: newNodes[i].id, target: newNodes[i + 1].id, animated: true });
            }
        }
        allMessages.push({ sender: 'AI', message: `→ Automatically connected ${newNodes.length} nodes in sequence.` });
    }

    if (typeof setChatMessages === 'function' && allMessages.length > 0) {
        setChatMessages(prev => [...prev, ...allMessages]);
    }

    return { nodes: [...existingNodes, ...newNodes], edges: newEdges };
}
