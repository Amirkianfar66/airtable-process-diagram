// src/components/AIChatPanel.jsx
import React, { useState } from 'react';
import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';

export default function AIChatPanel({ nodes, edges, items, setNodes, setEdges, setItems, setSelectedItem }) {
  const [aiDescription, setAiDescription] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

    const handleGeneratePNID = async () => {
        if (!aiDescription.trim()) return;

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

            // ✅ success message in chat
            setChatMessages((prev) => [
                ...prev,
                { sender: "AI", message: "✅ PNID generated successfully!" }
            ]);

        } catch (err) {
            console.error("AI PNID generation failed:", err);

            // ❌ friendly error fallback in chat
            setChatMessages((prev) => [
                ...prev,
                {
                    sender: "AI",
                    message:
                        "❌ Sorry, I couldn’t understand that description.\n👉 Try describing equipment and connections in detail, e.g. 'A pump connected to a heat exchanger with an output pipe leading to a storage tank.'"
                }
            ]);
        }
    };


  return (
    <div style={{ width: 300, borderLeft: '20px solid #ddd', padding: 10 }}>
          <textarea
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder="Describe your process here..."
              style={{
                  width: '100%',
                  height: 120,       // ✅ smaller, resizable
                  resize: 'vertical',
                  padding: 8,
                  border: '1px solid #ccc',
                  borderRadius: 4,
              }}
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
