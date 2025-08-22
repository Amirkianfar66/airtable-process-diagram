// ===================== MainToolbar.jsx
// Place this file at: src/components/MainToolbar.jsx

import React, { useState, useRef } from "react";

export default function MainToolbar({
    selectedNodes = [],
    nodes = [],
    edges = [],
    setNodes,
    setEdges,
    updateNode,
    deleteNode,
    onUndo,
    onRedo,
}) {
    const [activeTab, setActiveTab] = useState('File');
    const clipboardRef = useRef(null);

    // --- File actions ---
    const handleSave = () => {
        if (!setNodes || !setEdges) return alert('Save requires access to setNodes and setEdges.');
        try {
            const payload = { nodes, edges };
            localStorage.setItem('diagram-saved', JSON.stringify(payload));
            alert('Canvas saved to localStorage (diagram-saved)');
        } catch (err) {
            console.error(err);
            alert('Save failed');
        }
    };

    const handleLoad = () => {
        if (!setNodes || !setEdges) return alert('Load requires access to setNodes and setEdges.');
        try {
            const raw = localStorage.getItem('diagram-saved');
            if (!raw) return alert('No saved canvas found (localStorage key: diagram-saved)');
            const parsed = JSON.parse(raw);
            setNodes(parsed.nodes || []);
            setEdges(parsed.edges || []);
            alert('Canvas loaded');
        } catch (err) {
            console.error(err);
            alert('Load failed');
        }
    };

    const handleReset = () => {
        if (!setNodes || !setEdges) return alert('Reset requires access to setNodes and setEdges.');
        if (!confirm('Reset canvas? This will clear nodes and edges.')) return;
        setNodes([]);
        setEdges([]);
    };

    // --- Edit actions ---
    const handleUndo = () => {
        if (typeof onUndo === 'function') return onUndo();
        alert('Undo not available');
    };
    const handleRedo = () => {
        if (typeof onRedo === 'function') return onRedo();
        alert('Redo not available');
    };

    const handleCopy = () => {
        if (!selectedNodes || selectedNodes.length === 0) return alert('Select nodes to copy');
        clipboardRef.current = selectedNodes.map(n => ({ ...n }));
        alert(`Copied ${selectedNodes.length} node(s)`);
    };

    const handleCut = () => {
        if (!selectedNodes || selectedNodes.length === 0) return alert('Select nodes to cut');
        clipboardRef.current = selectedNodes.map(n => ({ ...n }));
        if (!setNodes) return alert('Cut requires setNodes');
        setNodes(nds => nds.filter(n => !selectedNodes.some(s => s.id === n.id)));
    };

    const handlePaste = () => {
        if (!clipboardRef.current || clipboardRef.current.length === 0) return alert('Clipboard empty');
        if (!setNodes) return alert('Paste requires setNodes');
        const copied = clipboardRef.current.map(orig => {
            const newId = `${orig.id}-copy-${Date.now()}`;
            return {
                ...orig,
                id: newId,
                position: { x: (orig.position?.x || 0) + 20, y: (orig.position?.y || 0) + 20 }
            };
        });
        setNodes(nds => [...nds, ...copied]);
        alert(`Pasted ${copied.length} node(s)`);
    };

    // --- Group actions (defaults to behavior if updateNode/deleteNode/setNodes available) ---
    const handleGroup = () => {
        if (!selectedNodes || selectedNodes.length < 2) {
            alert('Select at least 2 nodes to group.');
            return;
        }

        const minX = Math.min(...selectedNodes.map(n => n.position.x));
        const minY = Math.min(...selectedNodes.map(n => n.position.y));
        const maxX = Math.max(...selectedNodes.map(n => n.position.x + (n.style?.width || 100)));
        const maxY = Math.max(...selectedNodes.map(n => n.position.y + (n.style?.height || 40)));

        const groupId = `group-${Date.now()}`;

        if (!setNodes) return alert('Grouping requires setNodes');

        setNodes(nds => [
            ...nds,
            {
                id: groupId,
                type: 'groupLabel',
                position: { x: minX - 20, y: minY - 40 },
                data: {
                    label: 'New Group',
                    groupName: 'New Group',
                    rect: { width: maxX - minX + 40, height: maxY - minY + 60 },
                    children: selectedNodes.map(n => n.id)
                },
                style: { background: 'transparent', border: '1px dashed red' }
            }
        ]);
    };

    const handleUngroup = () => {
        if (!selectedNodes || selectedNodes.length === 0) return alert('Select a group to ungroup.');
        selectedNodes.forEach(node => {
            if (node.type === 'groupLabel') {
                if (typeof deleteNode === 'function') deleteNode(node.id);
                else if (setNodes) setNodes(nds => nds.filter(n => n.id !== node.id));
            }
        });
    };

    const handleRename = () => {
        if (!selectedNodes || selectedNodes.length !== 1) return alert('Select exactly one group to rename.');
        const node = selectedNodes[0];
        if (node.type !== 'groupLabel') return alert('Only group nodes can be renamed.');
        const newName = prompt('Enter new group name:', node.data?.groupName || node.data?.label);
        if (!newName) return;
        if (typeof updateNode === 'function') updateNode(node.id, { groupName: newName, data: { ...node.data, groupName: newName, label: newName } });
        else if (setNodes) setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, groupName: newName, label: newName } } : n));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.95)', borderBottom: '1px solid #ccc', position: 'sticky', top: 0, zIndex: 2000 }}>
            <div style={{ display: 'flex', gap: 8, padding: 8 }}>
                <button onClick={() => setActiveTab('File')} style={{ fontWeight: activeTab === 'File' ? '700' : '400' }}>File</button>
                <button onClick={() => setActiveTab('Edit')} style={{ fontWeight: activeTab === 'Edit' ? '700' : '400' }}>Edit</button>
                <button onClick={() => setActiveTab('Group')} style={{ fontWeight: activeTab === 'Group' ? '700' : '400' }}>Group</button>
            </div>

            <div style={{ display: 'flex', gap: 8, padding: 8 }}>
                {activeTab === 'File' && (
                    <>
                        <button onClick={handleSave}>Save</button>
                        <button onClick={handleLoad}>Load</button>
                        <button onClick={handleReset}>Reset Canvas</button>
                    </>
                )}

                {activeTab === 'Edit' && (
                    <>
                        <button onClick={handleUndo}>Back</button>
                        <button onClick={handleRedo}>Forward</button>
                        <button onClick={handleCut}>Cut</button>
                        <button onClick={handleCopy}>Copy</button>
                        <button onClick={handlePaste}>Paste</button>
                    </>
                )}

                {activeTab === 'Group' && (
                    <>
                        <button onClick={handleGroup}>Create Group</button>
                        <button onClick={handleUngroup}>Delete Group</button>
                        <button onClick={handleRename}>Rename Group</button>
                    </>
                )}
            </div>
        </div>
    );
}