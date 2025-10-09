// src/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
    state = { err: null };
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(err, info) { console.error("Canvas crashed:", err, info); }
    render() {
        if (this.state.err) {
            return (
                <div style={{ padding: 16 }}>
                    <b>Canvas failed to load.</b>
                    <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{String(this.state.err)}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}
