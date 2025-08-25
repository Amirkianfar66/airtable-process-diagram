// src/components/AIChatPanel.jsx
import React, { useState } from 'react';

// Note: We no longer import AIPNIDGenerator or ChatBox from the old file.
// The chat history will now be managed by the parent ProcessDiagram component.

export default function AIChatPanel({ onGenerate }) { // Accept the onGenerate prop
    const [aiDescription, setAiDescription] = useState('');

    const handleGenerateClick = () => {
        if (!aiDescription.trim()) return;

        // The component's only job is to call the function passed down from the parent.
        // All complex logic (API calls, state updates, chat history) is handled there.
        onGenerate(aiDescription);

        setAiDescription(''); // Clear the input after sending
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent new line on Enter
            handleGenerateClick();
        }
    };

    return (
        <div style={{ width: '100%', borderTop: '1px solid #ddd', padding: 10, background: '#f8f9fa' }}>
            <textarea
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe equipment, ask a question..."
                style={{
                    width: '100%',
                    boxSizing: 'border-box', // Ensure padding is included in width
                    height: 100,
                    resize: 'vertical',
                    padding: 8,
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    marginBottom: 10,
                }}
            />
            <button
                onClick={handleGenerateClick}
                style={{
                    width: '100%',
                    padding: '10px',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#007bff',
                    color: 'white',
                    cursor: 'pointer'
                }}
            >
                Send
            </button>
        </div>
    );
}