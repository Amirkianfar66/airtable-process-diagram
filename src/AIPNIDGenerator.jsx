//AIPNIDGenerator
import { getItemIcon, categoryTypeMap } from './IconManager';
import { parseItemText } from './aiParser';
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
                <div
                    style={{
                        color: 'black',
                        fontSize: '14px',
                        lineHeight: '1.5'
                    }}
                >
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
    itemsLibrary = [],
    existingNodes = [],
    existingEdges = [],
    setSelectedItem,
    setChatMessages
) {
    if (!description) return { nodes: existingNodes, edges: existingEdges };

    const greetingRegex = /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i;
    if (greetingRegex.test(description.trim())) {
        // Respond to greeting in plain language
        if (typeof setChatMessages === 'function') {
            setChatMessages(prev => [
                ...prev,
                { sender: 'User', message: description },
                { sender: 'AI', message: `Hello! How can I help you with your PNID items today?` }
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

    // Parse AI output for structured item generation
    const aiResult = await parseItemText(description);
    if (!aiResult) return { nodes: existingNodes, edges: existingEdges };

    const { explanation, connection } = aiResult;
    let parsed = aiResult.parsed;

    const Name = (parsed?.Name || description).trim();
    let Category = (parsed?.Category && parsed.Category !== '' ? parsed.Category : 'Equipment').trim();
    let Type = (parsed?.Type && parsed.Type !== '' ? parsed.Type : 'Generic').trim();
    const NumberOfItems = parsed?.Number && parsed.Number > 0 ? parsed.Number : 1;

    let newNodes = [];
    let newEdges = [...existingEdges];

    // Extract Unit/SubUnit
    let Unit = 0;
    let SubUnit = 0;
    const unitMatch = description.match(/unit\s*[:\-]?\s*([0-9]+)/i);
    if (unitMatch) Unit = parseInt(unitMatch[1], 10);

    const subUnitMatch = description.match(/sub\s*[- ]?unit\s*[:\-]?\s*([0-9]+)/i);
    if (subUnitMatch) SubUnit = parseInt(subUnitMatch[1], 10);

    if (parsed?.Sequence == null) {
        const seqMatch = description.match(/sequence\s*[:\-]?\s*([0-9]+)/i);
        if (seqMatch) parsed = { ...parsed, Sequence: parseInt(seqMatch[1], 10) };
    }

    parsed = { ...parsed, Unit, SubUnit };
    Category = (parsed?.Category && parsed.Category !== '' ? parsed.Category : 'Equipment').trim();
    Type = (parsed?.Type && parsed.Type !== '' ? parsed.Type : 'Generic').trim();

    // Generate code
    let updatedCode = generateCode({
        Category,
        Type,
        Unit,
        SubUnit,
        Sequence: parsed.Sequence,
        SensorType: parsed.SensorType || ""
    });

    if (!updatedCode || updatedCode === 0) {
        const fallbackSeq = Number.isFinite(parsed?.Sequence) ? parsed.Sequence : 1;
        updatedCode = generateCode({
            Category,
            Type,
            Unit,
            SubUnit,
            Sequence: fallbackSeq,
            SensorType: parsed.SensorType || ""
        });
    }

    // --------------------
    // Generate nodes
    // --------------------
    let allCodes = [updatedCode, ...(parsed._otherCodes || [])].filter(Boolean);

    if ((!parsed._otherCodes || parsed._otherCodes.length === 0) && NumberOfItems > 1) {
        const baseSeq = Number.isFinite(parsed?.Sequence) ? parsed.Sequence : 1;
        for (let i = 1; i < NumberOfItems; i++) {
            const nextCode = generateCode({
                Category,
                Type,
                Unit,
                SubUnit,
                Sequence: baseSeq + i,
                SensorType: parsed.SensorType || ""
            });
            if (nextCode && nextCode !== 0) allCodes.push(nextCode);
        }
    }

    const generatedCodesMessages = [];
    const allMessages = [];

    allCodes.forEach(code => {
        const nodeName = Name;
        const nodeType = Type;

        const id = crypto.randomUUID ? crypto.randomUUID() : `ai-${Date.now()}-${Math.random()}`;
        const item = {
            Name: nodeName,
            Code: code,
            'Item Code': code,
            Category,
            Type: nodeType,
            Unit: parsed.Unit,
            SubUnit: parsed.SubUnit,
            id
        };

        const label = `${item.Code} - ${item.Name}`;

        newNodes.push({
            id: item.id,
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
    // Explicit connections
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
            allMessages.push({ sender: 'AI', message: `→ Connected ${connection.sourceCode} → ${connection.targetCode}` });
        }
    }

    // Implicit connections
    const implicitConnect = /connect/i.test(description);
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
        allMessages.push({ sender: 'AI', message: `→ Automatically connected ${newNodes.length} nodes in sequence.` });
    }

    allMessages.push(
        { sender: 'AI', message: explanation || 'I parsed your item.' },
        { sender: 'AI', message: `→ Generated ${newNodes.length} item(s): ${Category} - ${Type}` }
    );

    if (typeof setChatMessages === 'function' && allMessages.length > 0) {
        setChatMessages(prev => [...prev, ...allMessages]);
    }

    return {
        nodes: [...existingNodes, ...newNodes],
        edges: newEdges,
    };
}
