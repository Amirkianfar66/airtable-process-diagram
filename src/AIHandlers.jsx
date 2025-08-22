import React, { useState, useCallback } from 'react';
import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';

export function useAIState() {
    const [aiDescription, setAiDescription] = useState('');
    const [chatMessages, setChatMessages] = useState([]);

    return { aiDescription, setAiDescription, chatMessages, setChatMessages };
}

export function useAIGenerator({ aiDescription, items, nodes, edges, setItems, setNodes, setEdges, setSelectedItem, setChatMessages }) {
    const generatePNID = useCallback(async () => {
        if (!aiDescription) return;

        try {
            const { nodes: aiNodes, edges: aiEdges } = await AIPNIDGenerator(
                aiDescription,
                items,
                nodes,
                edges,
                setSelectedItem,
                setChatMessages
            );

            const newItems = aiNodes.map((n) => n.data?.item).filter(Boolean);

            setItems((prev) => {
                const existingIds = new Set(prev.map((i) => i.id));
                const filteredNew = newItems.filter((i) => !existingIds.has(i.id));
                const updatedItems = [...prev, ...filteredNew];
                if (filteredNew.length > 0) setSelectedItem(filteredNew[0]);
                return updatedItems;
            });

            setNodes(aiNodes);
            setEdges(aiEdges);
        } catch (err) {
            console.error('AI PNID generation failed:', err);
        }
    }, [aiDescription, items, nodes, edges, setItems, setNodes, setEdges, setSelectedItem, setChatMessages]);

    return generatePNID;
}

// ✅ AIChatPanel now integrated into DiagramCanvas
export function AIChatPanel({ chatMessages }) {
    return (
        <div style={{ padding: 10 }}>
            <ChatBox messages={chatMessages} />
        </div>
    );
}