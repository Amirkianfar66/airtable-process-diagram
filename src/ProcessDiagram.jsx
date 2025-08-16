// src/ProcessDiagram.js
import React, { useEffect, useState, useCallback } from "react";
import ReactFlow, {
    Controls,
    useNodesState,
    useEdgesState,
    addEdge,
} from "reactflow";
import "reactflow/dist/style.css";
import "react-resizable/css/styles.css";

import ResizableNode from "./ResizableNode";
import CustomItemNode from "./CustomItemNode";
import PipeItemNode from "./PipeItemNode";
import ScalableIconNode from "./ScalableIconNode";
import GroupLabelNode from "./GroupLabelNode";
import ItemDetailCard from "./ItemDetailCard";

import { getItemIcon } from "./IconManager";

const nodeTypes = {
    resizable: ResizableNode,
    custom: CustomItemNode,
    pipe: PipeItemNode,
    scalableIcon: ScalableIconNode,
    groupLabel: GroupLabelNode,
    equipment: ScalableIconNode, // fallback for Equipment
};

export default function ProcessDiagram() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);

    const onSelectionChange = useCallback(
        ({ nodes }) => {
            setSelectedNodes(nodes);
            if (nodes.length === 1) {
                const nodeData = items.find((item) => item.id === nodes[0].id);
                setSelectedItem(nodeData || null);
            } else {
                setSelectedItem(null);
            }
        },
        [items]
    );

    const onConnect = useCallback(
        (params) => {
            const updatedEdges = addEdge(
                { ...params, type: "step", animated: true, style: { stroke: "blue", strokeWidth: 2 } },
                edges
            );
            setEdges(updatedEdges);
            localStorage.setItem("diagram-layout", JSON.stringify({ nodes, edges: updatedEdges }));
        },
        [edges, nodes]
    );

    const handleItemChange = (updatedItem) => {
        setItems((prev) => prev.map((it) => (it.id === updatedItem.id ? updatedItem : it)));
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === updatedItem.id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            label: `${updatedItem.Code || ""} - ${updatedItem.Name || ""}`,
                            icon: getItemIcon(updatedItem, { width: 20, height: 20 }),
                        },
                        type: updatedItem.Category === "Equipment" ? "equipment" : "scalableIcon",
                    };
                }
                return node;
            })
        );
        setSelectedItem(updatedItem);
    };

    useEffect(() => {
        // Fetch data from Airtable or any API
        const fetchData = async () => {
            const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
            const token = import.meta.env.VITE_AIRTABLE_TOKEN;
            const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

            let allRecords = [];
            let offset = null;
            const initialUrl = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

            do {
                const url = offset ? `${initialUrl}&offset=${offset}` : initialUrl;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) throw new Error("Airtable API error");
                const data = await res.json();
                allRecords = allRecords.concat(data.records);
                offset = data.offset;
            } while (offset);

            const fetchedItems = allRecords.map((rec) => ({ id: rec.id, ...rec.fields }));
            setItems(fetchedItems);

            // Create nodes
            const newNodes = fetchedItems.map((item, index) => ({
                id: item.id,
                position: { x: 100 + index * 180, y: 50 },
                data: {
                    label: `${item.Code || ""} - ${item.Name || ""}`,
                    icon: getItemIcon(item, { width: 20, height: 20 }),
                },
                type: item.Category === "Equipment" ? "equipment" : "scalableIcon",
                sourcePosition: "right",
                targetPosition: "left",
                style: { background: "transparent" },
            }));

            setNodes(newNodes);
        };

        fetchData().catch(console.error);
    }, []);

    const createNewItem = () => {
        const newItem = {
            id: `item-${Date.now()}`,
            Code: "NEW001",
            Name: "New Item",
            Category: "Equipment",
            Unit: "Unit 1",
            SubUnit: "Sub 1",
        };
        setItems((its) => [...its, newItem]);
        setNodes((nds) => [
            ...nds,
            {
                id: newItem.id,
                position: { x: 100, y: 100 },
                data: { label: `${newItem.Code} - ${newItem.Name}`, icon: getItemIcon(newItem, { width: 20, height: 20 }) },
                type: "equipment",
                sourcePosition: "right",
                targetPosition: "left",
                style: { background: "transparent" },
            },
        ]);
        setSelectedItem(newItem);
    };

    return (
        <div style={{ width: "100vw", height: "100vh", display: "flex" }}>
            <div style={{ flex: 1, position: "relative", background: "transparent" }}>
                <div style={{ padding: 10 }}>
                    <button
                        onClick={createNewItem}
                        style={{ padding: "6px 12px", background: "#4CAF50", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                    >
                        Add New Item
                    </button>
                </div>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={onSelectionChange}
                    fitView
                    selectionOnDrag
                    minZoom={0.02}
                    nodeTypes={nodeTypes}
                    style={{ background: "transparent" }}
                >
                    <Controls />
                </ReactFlow>
            </div>

            <div style={{ width: 350, borderLeft: "1px solid #ccc", overflowY: "auto", background: "transparent" }}>
                {selectedItem ? <ItemDetailCard item={selectedItem} onChange={handleItemChange} /> : <div style={{ padding: 20, color: "#888" }}>Select an item to see details</div>}
            </div>
        </div>
    );
}
