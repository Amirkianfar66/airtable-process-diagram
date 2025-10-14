// src/components/MainToolbar.jsx
import React, { useState, useRef, useEffect } from "react";
import UnitLayoutConfig from "./UnitLayoutConfig";

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
    // for Unit layout config
    availableUnits = [],
    currentView = 'canvas',
    onSwitchView = () => { },
    onUnitLayoutChange = () => { },
}) {
    const [activeTab, setActiveTab] = useState("File");
    const [panelOpen, setPanelOpen] = useState(false);

    // ---- App-level tabs (Data / 2D / 3D) ----
    const [appTab, setAppTab] = useState(() => {
        if (typeof window !== "undefined" && typeof window.getAppTab === "function") {
            return window.getAppTab();
        }
        return "canvas"; // default highlight = 2D
    });

    useEffect(() => {
        const onAppTabChanged = (e) => {
            const name = e?.detail?.tab;
            if (name) setAppTab(name);
        };
        window.addEventListener("appTabChanged", onAppTabChanged);
        return () => window.removeEventListener("appTabChanged", onAppTabChanged);
    }, []);

    const gotoAppTab = (name) => {
        if (name === "data") {
            window.openDataPanel?.();
            setAppTab("data");
            return;
        }
        if (name === "canvas") {
            window.closeDataPanel?.();
            window.setCanvasView?.("2d");     // ⬅ switch to 2D canvas
            setAppTab("canvas");
            return;
        }
        if (name === "3d") {
            window.closeDataPanel?.();
            window.setCanvasView?.("3d");     // ⬅ switch to 3D view
            setAppTab("3d");
            return;
        }

        // fallback if you still keep a global tab setter around
        const fn = (typeof window !== "undefined") ? window.setAppTab : undefined;
        if (typeof fn === "function") fn(name);
    };



    // anchor positioning (panel shows under clicked tab button)
    const wrapperRef = useRef(null);
    const barRef = useRef(null);
    const btnRefs = useRef({
        File: React.createRef(),
        Edit: React.createRef(),
        Group: React.createRef(),
        View: React.createRef(),
    });
    const [panelPos, setPanelPos] = useState({ left: 8, top: 44 });

    // click away to close
    useEffect(() => {
        const onDocClick = (e) => {
            if (!wrapperRef.current) return;
            if (!wrapperRef.current.contains(e.target)) setPanelOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    // recompute position on resize
    useEffect(() => {
        const onResize = () => {
            positionUnder(activeTab);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, panelOpen]);

    const positionUnder = (tab) => {
        const bar = barRef.current;
        const btn = btnRefs.current[tab]?.current;
        const wrap = wrapperRef.current;
        if (!bar || !btn || !wrap) return;

        // panel's left relative to wrapper
        const wrapRect = wrap.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        const barRect = bar.getBoundingClientRect();

        const left = btnRect.left - wrapRect.left;
        const top = barRect.height + 6; // a little gap under the bar
        setPanelPos({ left, top });
    };

    const openTab = (tab) => {
        if (tab === activeTab) {
            const next = !panelOpen;
            if (next) positionUnder(tab);
            setPanelOpen(next);
        } else {
            setActiveTab(tab);
            positionUnder(tab);
            setPanelOpen(true);
        }
    };

    // --- File actions ---
    const handleSave = () => {
        if (!setNodes || !setEdges) return alert("Save requires access to setNodes and setEdges.");
        try {
            const payload = { nodes, edges };
            localStorage.setItem("diagram-saved", JSON.stringify(payload));
            alert("Canvas saved to localStorage (diagram-saved)");
        } catch {
            alert("Save failed");
        }
    };

    const handleLoad = () => {
        if (!setNodes || !setEdges) return alert("Load requires access to setNodes and setEdges.");
        try {
            const raw = localStorage.getItem("diagram-saved");
            if (!raw) return alert("No saved canvas found (localStorage key: diagram-saved)");
            const parsed = JSON.parse(raw);
            setNodes(parsed.nodes || []);
            setEdges(parsed.edges || []);
            alert("Canvas loaded");
        } catch {
            alert("Load failed");
        }
    };

    const handleReset = () => {
        if (!setNodes || !setEdges) return alert("Reset requires access to setNodes and setEdges.");
        if (!confirm("Reset canvas? This will clear nodes and edges.")) return;
        setNodes([]);
        setEdges([]);
    };

    // --- Edit actions ---
    const handleUndo = () => (typeof onUndo === "function" ? onUndo() : alert("Undo not available"));
    const handleRedo = () => (typeof onRedo === "function" ? onRedo() : alert("Redo not available"));

    const handleCopy = () => {
        if (!selectedNodes?.length) return alert("Select nodes to copy");
        navigator.clipboard?.writeText(JSON.stringify(selectedNodes)).catch(() => { });
        alert(`Copied ${selectedNodes.length} node(s) to clipboard JSON`);
    };

    const handleCut = () => {
        if (!selectedNodes?.length) return alert("Select nodes to cut");
        if (!setNodes) return alert("Cut requires setNodes");
        setNodes((nds) => nds.filter((n) => !selectedNodes.some((s) => s.id === n.id)));
    };

    const handlePaste = async () => {
        if (!setNodes) return alert("Paste requires setNodes");
        try {
            const txt = await navigator.clipboard.readText();
            const arr = JSON.parse(txt);
            if (!Array.isArray(arr)) return alert("Clipboard does not contain nodes JSON");
            const copied = arr.map((orig) => ({
                ...orig,
                id: `${orig.id}-copy-${Date.now()}`,
                position: {
                    x: (orig.position?.x || 0) + 20,
                    y: (orig.position?.y || 0) + 20,
                },
            }));
            setNodes((nds) => [...nds, ...copied]);
            alert(`Pasted ${copied.length} node(s)`);
        } catch {
            alert("Failed to paste nodes from clipboard");
        }
    };

    const handleGroup = () => {
        if (!selectedNodes || selectedNodes.length < 2) return alert("Select at least 2 nodes to group.");
        const minX = Math.min(...selectedNodes.map((n) => n.position.x));
        const minY = Math.min(...selectedNodes.map((n) => n.position.y));
        const maxX = Math.max(...selectedNodes.map((n) => n.position.x + (n.style?.width || 100)));
        const maxY = Math.max(...selectedNodes.map((n) => n.position.y + (n.style?.height || 40)));
        const groupId = `group-${Date.now()}`;
        if (!setNodes) return alert("Grouping requires setNodes");
        setNodes((nds) => [
            ...nds,
            {
                id: groupId,
                type: "groupLabel",
                position: { x: minX - 20, y: minY - 40 },
                data: {
                    label: "New Group",
                    groupName: "New Group",
                    rect: { width: maxX - minX + 40, height: maxY - minY + 60 },
                    children: selectedNodes.map((n) => n.id),
                },
                style: { background: "transparent", border: "1px dashed red" },
            },
        ]);
    };

    const handleUngroup = () => {
        if (!selectedNodes?.length) return alert("Select a group to ungroup.");
        selectedNodes.forEach((node) => {
            if (node.type === "groupLabel") {
                if (typeof deleteNode === "function") deleteNode(node.id);
                else if (setNodes) setNodes((nds) => nds.filter((n) => n.id !== node.id));
            }
        });
    };

    const handleRename = () => {
        if (!selectedNodes || selectedNodes.length !== 1) return alert("Select exactly one group to rename.");
        const node = selectedNodes[0];
        if (node.type !== "groupLabel") return alert("Only group nodes can be renamed.");
        const newName = prompt("Enter new group name:", node.data?.groupName || node.data?.label);
        if (!newName) return;
        if (typeof updateNode === "function")
            updateNode(node.id, { groupName: newName, data: { ...node.data, groupName: newName, label: newName } });
        else if (setNodes)
            setNodes((nds) =>
                nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, groupName: newName, label: newName } } : n))
            );
    };

    const panelStyle = {
        position: "absolute",
        top: panelPos.top,
        left: panelPos.left,
        minWidth: 320,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 6,
        boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
        padding: 12,
        zIndex: 3000,
    };

    const sectionTitle = { fontSize: 12, color: "#666", marginBottom: 6 };
    const actionBtn = { padding: "6px 8px", marginRight: 8, marginBottom: 8 };

    // small helper for the App-segment buttons on the right
    const segBtn = (active) => ({
        padding: "6px 10px",
        border: "1px solid #ccc",
        borderRadius: 6,
        background: active ? "#e8f2ff" : "#fff",
        fontWeight: active ? 700 : 400,
    });

    return (
        <div ref={wrapperRef} style={{ position: "relative" }}>
            {/* Top bar */}
            <div
                ref={barRef}
                style={{
                    display: "flex",
                    gap: 8,
                    padding: 8,
                    background: "rgba(255,255,255,0.95)",
                    borderBottom: "1px solid #ccc",
                }}
            >
                <button
                    ref={btnRefs.current.File}
                    onClick={() => openTab("File")}
                    style={{ fontWeight: activeTab === "File" ? "700" : "400" }}
                >
                    File
                </button>
                <button
                    ref={btnRefs.current.Edit}
                    onClick={() => openTab("Edit")}
                    style={{ fontWeight: activeTab === "Edit" ? "700" : "400" }}
                >
                    Edit
                </button>
                <button
                    ref={btnRefs.current.Group}
                    onClick={() => openTab("Group")}
                    style={{ fontWeight: activeTab === "Group" ? "700" : "400" }}
                >
                    Group
                </button>
                <button
                    ref={btnRefs.current.View}
                    onClick={() => openTab("View")}
                    style={{ fontWeight: activeTab === "View" ? "700" : "400" }}
                >
                    View
                </button>

                {/* ---- App-level tabs (right side) ---- */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#666" }}>App</span>
                    <button onClick={() => gotoAppTab("data")} style={segBtn(appTab === "data")}>
                        Data
                    </button>
                    <button onClick={() => gotoAppTab("canvas")} style={segBtn(appTab === "canvas")}>
                        2D
                    </button>
                    <button onClick={() => gotoAppTab("3d")} style={segBtn(appTab === "3d")}>
                        3D
                    </button>

                </div>
            </div>

            {/* Anchored panel under the active tab button */}
            {panelOpen && (
                <div style={panelStyle} role="dialog" aria-label={`${activeTab} actions`}>
                    {activeTab === "File" && (
                        <div>
                            <div style={sectionTitle}>File</div>
                            <div>
                                <button style={actionBtn} onClick={handleSave}>
                                    Save
                                </button>
                                <button style={actionBtn} onClick={handleLoad}>
                                    Load
                                </button>
                                <button style={actionBtn} onClick={handleReset}>
                                    Reset Canvas
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "Edit" && (
                        <div>
                            <div style={sectionTitle}>Edit</div>
                            <div>
                                <button style={actionBtn} onClick={handleUndo}>
                                    Back
                                </button>
                                <button style={actionBtn} onClick={handleRedo}>
                                    Forward
                                </button>
                                <button style={actionBtn} onClick={handleCut}>
                                    Cut
                                </button>
                                <button style={actionBtn} onClick={handleCopy}>
                                    Copy
                                </button>
                                <button style={actionBtn} onClick={handlePaste}>
                                    Paste
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "Group" && (
                        <div>
                            <div style={sectionTitle}>Group</div>
                            <div>
                                <button style={actionBtn} onClick={handleGroup}>
                                    Create Group
                                </button>
                                <button style={actionBtn} onClick={handleUngroup}>
                                    Delete Group
                                </button>
                                <button style={actionBtn} onClick={handleRename}>
                                    Rename Group
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "View" && (
                        <div>
                            <div style={sectionTitle}>View</div>
                            <UnitLayoutConfig availableUnits={availableUnits} onChange={onUnitLayoutChange} />
                            {/* ---- Add view switch for Canvas / PNID List ---- */}
                            <div style={{ marginTop: 12 }}>
                                <div style={sectionTitle}>PNID Report</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        onClick={() => onSwitchView('canvas')}
                                        style={{
                                            padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd",
                                            background: currentView === 'canvas' ? '#111' : '#fff',
                                            color: currentView === 'canvas' ? '#fff' : '#111'
                                        }}
                                    >
                                        Canvas
                                    </button>
                                    <button
                                        onClick={() => onSwitchView('pnid-list')}
                                        style={{
                                            padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd",
                                            background: currentView === 'pnid-list' ? '#111' : '#fff',
                                            color: currentView === 'pnid-list' ? '#fff' : '#111'
                                        }}
                                    >
                                        PNID List
                                    </button>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
