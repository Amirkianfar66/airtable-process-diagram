// src/utils/AIPNIDGenerator.js
import { getItemIcon, categoryTypeMap } from './IconManager';
import { generateCode } from './codeGenerator';
import { parseItemLogic } from '../api/parse-item'; // Gemini wrapper

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
// AI PNID generator (with human AI layer)
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

    // 1️⃣ Send input to Gemini for classification
    // 1️⃣ Send input to Gemini for classification
    let aiResult;
    try {
        aiResult = await parseItemLogic(description);
    } catch (err) {
        console.error('❌ Chat AI failed:', err);
        if (typeof setChatMessages === 'function') {
            setChatMessages(prev => [
                ...prev,
                { sender: 'User', message: description },
                { sender: 'AI', message: '⚠️ AI processing failed.' }
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

    // ✅ Extract mode, explanation, and parsed object
    const { mode, explanation, parsed = {}, connection } = aiResult;

    // 2️⃣ Branch based on AI classification
    if (mode === "chat") {
        // AI says this is general conversation → just show chat
        if (typeof setChatMessages === "function") {
            setChatMessages(prev => [
                ...prev,
                { sender: "User", message: description },
                { sender: "AI", message: parsed.message || explanation }
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    } else if (mode === "structured" || mode === "pnid") {
        // PNID logic → generate nodes and edges
        // ... your existing PNID generation code here ...
    }


    // 2️⃣ Chat/human mode → reply directly
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

    // 3️⃣ Structured PNID logic
    const Name = (parsed.Name || description).trim();
    const Category = parsed.Category && parsed.Category !== '' ? parsed.Category : 'Equipment';
    const Type = parsed.Type && parsed.Type !== '' ? parsed.Type : 'Generic';
    const NumberOfItems = parsed.Number && parsed.Number > 0 ? parsed.Number : 1;

    const newNodes = [];
    const newEdges = [...existingEdges];

    const Unit = parsed.Unit ?? 0;
    const SubUnit = parsed.SubUnit ?? 0;
    const Sequence = parsed.Sequence ?? 1;

    let updatedCode = generateCode({ Category, Type, Unit, SubUnit, Sequence, SensorType: parsed.SensorType || '' });

    // Fallback in case generateCode returns falsy
    if (!updatedCode || updatedCode === 0) {
        updatedCode = generateCode({ Category, Type, Unit, SubUnit, Sequence, SensorType: parsed.SensorType || '' });
    }

    let allCodes = [updatedCode, ...(parsed._otherCodes || [])].filter(Boolean);

    // Generate multiple sequential codes if needed
    if ((!parsed._otherCodes || parsed._otherCodes.length === 0) && NumberOfItems > 1) {
        for (let i = 1; i < NumberOfItems; i++) {
            const nextCode = generateCode({ Category, Type, Unit, SubUnit, Sequence: Sequence + i, SensorType: parsed.SensorType || '' });
            if (nextCode) allCodes.push(nextCode);
        }
    }

    const generatedCodesMessages = [];
    const allMessages = [];

    // Create nodes
    allCodes.forEach(code => {
        const id = crypto.randomUUID ? crypto.randomUUID() : `ai-${Date.now()}-${Math.random()}`;
        const item = { Name, Code: code, 'Item Code': code, Category, Type, Unit, SubUnit, id };
        const label = `${item.Code} - ${item.Name}`;

        newNodes.push({
            id,
            position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
            data: { label, item, icon: getItemIcon(item) },
            type: categoryTypeMap[Category] || 'scalableIcon',
        });

        generatedCodesMessages.push({ sender: 'AI', message: `Generated code: ${code}` });
    });

    allMessages.push({ sender: 'User', message: description });
    if (explanation) allMessages.push({ sender: 'AI', message: explanation });
    allMessages.push(...generatedCodesMessages);

    // --------------------------
    // Explicit connections (safely)
    // --------------------------
    if (connection && connection.sourceCode && connection.targetCode) {
        const sourceNode = [...existingNodes, ...newNodes].find(n => n.data?.item?.Code === connection.sourceCode);
        const targetNode = [...existingNodes, ...newNodes].find(n => n.data?.item?.Code === connection.targetCode);

        if (sourceNode && targetNode) {
            const exists = newEdges.some(e => e.source === sourceNode.id && e.target === targetNode.id);
            if (!exists) {
                newEdges.push({ id: `edge-${sourceNode.id}-${targetNode.id}`, source: sourceNode.id, target: targetNode.id, animated: true });
            }
            allMessages.push({ sender: 'AI', message: `→ Connected ${connection.sourceCode} → ${connection.targetCode}` });
        }
    }

    // --------------------------
    // Implicit connections
    // --------------------------
    if (/Connect/i.test(description) && newNodes.length > 1) {
        for (let i = 0; i < newNodes.length - 1; i++) {
            const exists = newEdges.some(e => e.source === newNodes[i].id && e.target === newNodes[i + 1].id);
            if (!exists) {
                newEdges.push({ id: `edge-${newNodes[i].id}-${newNodes[i + 1].id}`, source: newNodes[i].id, target: newNodes[i + 1].id, animated: true });
            }
        }
        allMessages.push({ sender: 'AI', message: `→ Automatically connected ${newNodes.length} nodes in sequence.` });
    }

    // Final explanation
    allMessages.push(
        { sender: 'AI', message: explanation || 'I parsed your item.' },
        { sender: 'AI', message: `→ Generated ${newNodes.length} item(s): ${Category} - ${Type}` }
    );

    if (typeof setChatMessages === 'function' && allMessages.length > 0) {
        setChatMessages(prev => [...prev, ...allMessages]);
    }

    return { nodes: [...existingNodes, ...newNodes], edges: newEdges };
}
