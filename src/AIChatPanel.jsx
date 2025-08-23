// src/components/AIChatPanel.jsx
import React, { useState } from 'react';
import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';

export default function AIChatPanel({ nodes, edges, items, setNodes, setEdges, setItems, setSelectedItem }) {
  const [aiDescription, setAiDescription] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  const handleGeneratePNID = async () => {
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
  };

  return (
    <div style={{ width: 300, borderLeft: '20px solid #ddd', padding: 10 }}>
      <textarea
        value={aiDescription}
        onChange={(e) => setAiDescription(e.target.value)}
        placeholder="Dsssss..."
        style={{ width: '100%', height: 1000 }}
      />
      <button onClick={handleGeneratePNID} style={{ marginTop: 10 }}>
        Generate PNID
      </button>
      <div style={{ marginTop: 20 }}>
        <ChatBox messages={chatMessages} />
      </div>
    </div>
  );
}
