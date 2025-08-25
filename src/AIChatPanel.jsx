import React, { useState } from "react";

export default function AIChatPanel({ onGenerate }) {
    const [aiDescription, setAiDescription] = useState("");
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Hi! I’m your AI assistant. Ask me anything..." }
    ]);

    const handleGenerateClick = async () => {
        if (!aiDescription.trim()) return;

        // Add user message
        setMessages((prev) => [...prev, { role: "user", content: aiDescription }]);

        const input = aiDescription;
        setAiDescription("");

        // Call parent handler → returns {mode, nodes, edges, messages}
        const reply = await onGenerate(input);

        if (!reply) return;

        // If chat mode, just show explanation
        if (reply.mode === "chat" && reply.messages?.length) {
            setMessages((prev) => [...prev, { role: "assistant", content: reply.messages[0].message }]);
        }

        // If structured, show structured AI messages
        if (reply.mode === "structured" && reply.messages?.length) {
            reply.messages.forEach((m) => {
                setMessages((prev) => [...prev, { role: "assistant", content: m.message }]);
            });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleGenerateClick();
        }
    };

    return (
        <div style={{ width: "100%", borderTop: "1px solid #ddd", padding: 10, background: "#f8f9fa", display: "flex", flexDirection: "column", height: 400 }}>
            <div style={{ flex: 1, overflowY: "auto", padding: 5, marginBottom: 10, background: "white", border: "1px solid #ccc", borderRadius: 4 }}>
                {messages.map((msg, idx) => (
                    <div key={idx} style={{ textAlign: msg.role === "user" ? "right" : "left", margin: "5px 0" }}>
                        <span style={{
                            display: "inline-block",
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: msg.role === "user" ? "#007bff" : "#e9ecef",
                            color: msg.role === "user" ? "white" : "black",
                            maxWidth: "80%"
                        }}>
                            {msg.content}
                        </span>
                    </div>
                ))}
            </div>

            <textarea
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                style={{ width: "100%", boxSizing: "border-box", height: 60, resize: "none", padding: 8, border: "1px solid #ccc", borderRadius: 4, marginBottom: 5 }}
            />
            <button
                onClick={handleGenerateClick}
                style={{ width: "100%", padding: "10px", border: "none", borderRadius: 4, background: "#007bff", color: "white", cursor: "pointer" }}
            >
                Send
            </button>
        </div>
    );
}
