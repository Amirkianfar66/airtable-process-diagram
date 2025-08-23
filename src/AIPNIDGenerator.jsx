// src/components/AIPNIDGenerator.js
import React from 'react';
import { getItemIcon, categoryTypeMap } from './IconManager';

export default async function AIPNIDGenerator(description, items, nodes, edges, setSelectedItem, setChatMessages) {
    // Simple parser: "Draw 1 Equipment Tank"
    const match = description.match(/Draw\s+(\d+)\s+(.+)/i);
    if (!match) {
        throw new Error("❌ Could not understand description: " + description);
    }

    const count = parseInt(match[1], 10);
    const itemType = match[2].trim();

    let newNodes = [...nodes];
    let newEdges = [...edges];

    for (let i = 0; i < count; i++) {
        const newId = `ai-${Date.now()}-${i}`;
        const newItem = {
            id: newId,
            Name: itemType,
            Code: "",
            Unit: "AI",
            SubUnit: "Generated",
            Category: itemType, // you can refine mapping
            Type: itemType,
            Sequence: nodes.length + i,
        };

        const newNode = {
            id: newId,
            position: { x: 200 + i * 200, y: 200 }, // simple auto placement
            data: { label: newItem.Name, item: newItem, icon: getItemIcon(newItem) },
            type: categoryTypeMap[newItem.Category] || 'scalableIcon',
            sourcePosition: 'right',
            targetPosition: 'left',
            style: { background: 'transparent', boxShadow: 'none' },
        };

        newNodes.push(newNode);
        items.push(newItem);
    }

    // Optionally add edges here if description specifies connections

    // update chat
    setChatMessages(prev => [...prev, { role: 'assistant', content: `✅ Added ${count} ${itemType}(s)` }]);

    return { nodes: newNodes, edges: newEdges };
}

// Export ChatBox passthrough if needed
// Updated ChatBox with Generate PNID button
export function ChatBox({ messages, onSendMessage, onGeneratePNID, inputValue, setInputValue }) {
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            borderBottom: '1px solid #ccc',
            padding: 10,
            background: '#f0f4f8',
            zIndex: 1000
        }}>
            <div style={{ display: 'flex', gap: '5px', marginBottom: 10 }}>
                <input
                    type="text"
                    placeholder="Describe PNID..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    style={{ flex: 1, padding: 5 }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onSendMessage(e.target.value);
                            e.target.value = '';
                        }
                    }}
                />
                <button onClick={() => onGeneratePNID(inputValue)}>Generate PNID</button>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {messages.map((m, i) => (
                    <div key={i}><b>{m.role}:</b> {m.content}</div>
                ))}
            </div>
        </div>
    );
}