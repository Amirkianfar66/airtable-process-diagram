// src/AIChatPanel.jsx
import React, { useState } from "react";
import { aiParser } from "./aiParser";

export default function AIChatPanel() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");

    const handleSend = async () => {
        if (!input.trim()) return;

        // Add user message
        setMessages((prev) => [...prev, { role: "user", content: input }]);
        const userInput = input;
        setInput("");

        try {
            const res = await aiParser(userInput);

            if (res.mode === "chat") {
                // Natural conversation
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: res.explanation },
                ]);
            } else if (res.mode === "structured") {
                // PNID structured command
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: res.explanation },
                ]);
                // TODO: hook this into your PNID addItem flow
                console.log("✅ Parsed PNID JSON:", res.parsed);
            }
        } catch (err) {
            console.error(err);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "❌ Error talking to AI." },
            ]);
        }
    };

    return (
        <div
            style={{
                position: "absolute",
                top: 20,
                right: 20,
                width: 300,
                zIndex: 1000,
                background: "#fff",
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: 10,
            }}
        >
            <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
                {messages.map((m, i) => (
                    <div key={i} style={{ textAlign: m.role === "user" ? "right" : "left" }}>
                        <b>{m.role === "user" ? "You" : "AI"}:</b> {m.content}
                    </div>
                ))}
            </div>

            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="Ask me anything or give PNID instructions..."
                style={{
                    width: "100%",
                    resize: "none",
                    padding: 6,
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    marginBottom: 6,
                }}
            />
            <button onClick={handleSend} style={{ width: "100%" }}>
                Send
            </button>
        </div>
    );
}
