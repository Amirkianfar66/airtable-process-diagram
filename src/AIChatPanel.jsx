import React, { useState, useRef, useEffect } from "react";

export default function AIChatPanel({ onGenerate }) {
    const [aiDescription, setAiDescription] = useState("");
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Hi! I’m your AI assistant. Ask me anything..." }
    ]);
    const chatEndRef = useRef(null);

    // 🔽 Auto-scroll to bottom on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleGenerateClick = async () => {
        if (!aiDescription.trim()) return;

        const input = aiDescription.trim();
        setAiDescription("");

        // Add user message immediately
        setMessages((prev) => [...prev, { role: "user", content: input }]);

        try {
            // Call parent handler → returns { mode, nodes, edges, messages }
            const reply = await onGenerate(input);
            if (reply?.messages?.length) {
                // ✅ Append all assistant messages from API
                setMessages((prev) => [...prev, ...reply.messages.filter(m => m.role === "assistant")]);
            }
        } catch (err) {
            console.error("AIChatPanel error:", err);
            setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Something went wrong." }]);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleGenerateClick();
        }
    };

    return (
        <div style={{
            width: "100%",
            borderTop: "1px solid #ddd",
            padding: 10,
            background: "#f8f9fa",
            display: "flex",
            flexDirection: "column",
            height: 400
        }}>
            {/* Chat window */}
            <div style={{
                flex: 1,
                overflowY: "auto",
                padding: 5,
                marginBottom: 10,
                background: "white",
                border: "1px solid #ccc",
                borderRadius: 4
            }}>
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        style={{
                            textAlign: msg.role === "user" ? "right" : "left",
                            margin: "5px 0"
                        }}
                    >
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
                <div ref={chatEndRef} />
            </div>

            {/* Input box */}
            <textarea
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: 60,
                    resize: "none",
                    padding: 8,
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    marginBottom: 5
                }}
            />
            <button
                onClick={handleGenerateClick}
                style={{
                    width: "100%",
                    padding: "10px",
                    border: "none",
                    borderRadius: 4,
                    background: "#007bff",
                    color: "white",
                    cursor: "pointer"
                }}
            >
                Send
            </button>
        </div>
    );
}
