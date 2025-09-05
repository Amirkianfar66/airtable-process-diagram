// ===================== MainToolbar.jsx
// Place this file at: src/components/MainToolbar.jsx

import React, { useState, useRef, useEffect } from "react";

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
    const [panelOpen, setPanelOpen] = useState(true);
    const clipboardRef = useRef(null);
    const panelRef = useRef(null);

    useEffect(() => {
        const onDocClick = (e) => {
            if (!panelRef.current) return;
            if (!panelRef.current.contains(e.target)) {
                setPanelOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const openTab = (tab) => {
        if (tab === activeTab) {
            setPanelOpen((v) => !v);
        } else {
            setActiveTab(tab);
            setPanelOpen(true);
        }
    };

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

    // --- Group actions ---
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

    const panelStyle = {
        position: 'absolute',
        top: 44,
        left: 8,
        minWidth: 280,
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: 6,
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        padding: 12,
        zIndex: 3000
    };

    const sectionTitle = { fontSize: 12, color: '#666', marginBottom: 6 };
    const actionBtn = { padding: '6px 8px', marginRight: 8, marginBottom: 8 };

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8, padding: 8, background: 'rgba(255,255,255,0.95)', borderBottom: '1px solid #ccc' }}>
                <button onClick={() => openTab('File')} style={{ fontWeight: activeTab === 'File' ? '700' : '400' }}>File</button>
                <button onClick={() => openTab('Edit')} style={{ fontWeight: activeTab === 'Edit' ? '700' : '400' }}>Edit</button>
                <button onClick={() => openTab('Group')} style={{ fontWeight: activeTab === 'Group' ? '700' : '400' }}>Group</button>
            </div>

            {panelOpen && (
                <div ref={panelRef} style={panelStyle} role="dialog" aria-label={`${activeTab} actions`}>
                    {activeTab === 'File' && (
                        <div>
                            <div style={sectionTitle}>File</div>
                            <div>
                                <button style={actionBtn} onClick={handleSave}>Save</button>
                                <button style={actionBtn} onClick={handleLoad}>Load</button>
                                <button style={actionBtn} onClick={handleReset}>Reset Canvas</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Edit' && (
                        <div>
                            <div style={sectionTitle}>Edit</div>
                            <div>
                                <button style={actionBtn} onClick={handleUndo}>Back</button>
                                <button style={actionBtn} onClick={handleRedo}>Forward</button>
                                <button style={actionBtn} onClick={handleCut}>Cut</button>
                                <button style={actionBtn} onClick={handleCopy}>Copy</button>
                                <button style={actionBtn} onClick={handlePaste}>Paste</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Group' && (
                        <div>
                            <div style={sectionTitle}>Group</div>
                            <div>
                                <button style={actionBtn} onClick={handleGroup}>Create Group</button>
                                <button style={actionBtn} onClick={handleUngroup}>Delete Group</button>
                                <button style={actionBtn} onClick={handleRename}>Rename Group</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
