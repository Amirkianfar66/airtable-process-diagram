import { getItemIcon, categoryTypeMap } from './IconManager';
import { parseItemText } from './aiParser';

function generateCode({ Category, Type, Unit = 0, SubUnit = 0, Sequence = null, SensorType = "" }) {
    // Calculation2
    const calc2 = {
        "Equipment": "0",
        "Inline Valve": "30",
        "Pipe": "00",
        "Duct": "70",
        "Instrument": "4",
        "Structure": "50",
        "Electrical": "80",
        "General": "9",
        "Plant/System": "00"
    }[Category] || "";

    // Calculation3
    const calc3 = {
        "PRESSURE TRANSMITTER": 41,
        "TEMPERATURE TRANSMITTER": 42,
        "PH PROBE SENSOR": 43,
        "O2 DETECTION SENSOR": 44,
        "TURBIDITY ANALYZER PROBE": 45,
        "ETG GAS ANALYZER": 46,
        "LEVEL TRANSMITTER": 47,
        "WEIGHTING SENSOR": 48,
        "Vibration Sensor": 49,
        "Suspended Solids Sensor": 50,
        "Rotation sensor": 51,
        "Salinity Sensor": 52,
        "Pressure Gauge": 54,
        "Flow Transmitter": 6,
        "Positon switch sensor": 53
    }[SensorType] || 40;

    let finalCode = "";

    if (Category === "Equipment" && Sequence !== null) {
        if (Sequence > 9 && calc2 === "0") {
            finalCode = `${Unit}${SubUnit}${Sequence}`;
        } else {
            const codeToUse = calc2 === "4" ? calc3 : calc2;
            finalCode = `${Unit}${SubUnit}${codeToUse}${Sequence || 0}`;
        }
    } else {
        // Non-Equipment items use Calculation2 only
        finalCode = calc2;
    }

    // Take first 5 characters if needed
    return finalCode.toString().slice(0, 5);
}


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

    const { explanation, connection } = aiResult;
    let parsed = aiResult.parsed;  // can reassign

    const Name = (parsed?.Name || description).trim();

    // Only declare once
    let Category = (parsed?.Category && parsed.Category !== '' ? parsed.Category : 'Equipment').trim();
    let Type = (parsed?.Type && parsed.Type !== '' ? parsed.Type : 'Generic').trim();
    const NumberOfItems = parsed?.Number && parsed.Number > 0 ? parsed.Number : 1;

    // Generate code
    const Code = generateCode({
        Category,
        Type,
        Unit: parsed.Unit ?? 0,
        SubUnit: parsed.SubUnit ?? 0,
        Sequence: parsed.Sequence,       // optional
        SensorType: parsed.SensorType || ""
    });

    let newNodes = [];
    let newEdges = [...existingEdges];
    // Extract Unit/SubUnit first
    let Unit = 0;
    let SubUnit = 0;
    const unitMatch = description.match(/unit\s*[:\-]?\s*([0-9])/i);
    if (unitMatch) Unit = parseInt(unitMatch[1], 10);

    const subUnitMatch = description.match(/sub\s*[- ]?unit\s*[:\-]?\s*([0-9])/i);
    if (subUnitMatch) SubUnit = parseInt(subUnitMatch[1], 10);

    parsed = { ...parsed, Unit, SubUnit };

    // Update Category/Type if needed (without redeclaring)
    Category = (parsed?.Category && parsed.Category !== '' ? parsed.Category : 'Equipment').trim();
    Type = (parsed?.Type && parsed.Type !== '' ? parsed.Type : 'Generic').trim();

    // Update Code
    const Code = generateCode({
        Category,
        Type,
        Unit,
        SubUnit,
        Sequence: parsed.Sequence,
        SensorType: parsed.SensorType || ""
    });

    // Generate nodes
    const allCodes = [Code].concat(parsed._otherCodes || []);

    newNodes = allCodes.map((code, index) => {
        const id = `ai-${Date.now()}-${Math.random()}`;
        const item = {
            Name: Name,
            Code: code,           // internal logic
            'Item Code': code,    // <-- ItemDetailCard reads this
            Category,
            Type,
            Unit,
            SubUnit,
            id
        };

        return {
            id,
            position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
            data: { label: `${item.Code} - ${item.Name}`, item, icon: getItemIcon(item) },
            type: categoryTypeMap[Category] || 'scalableIcon',
        };
    });

    // ✅ Pass the first node's item to the detail card after nodes are created
    if (typeof setSelectedItem === 'function' && newNodes.length > 0) {
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
