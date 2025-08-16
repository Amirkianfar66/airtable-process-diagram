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
                            icon: getItemIcon(updatedItem, { width: 40, height: 40 }),
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

            const fetchedItems = allRecords.map((rec) => ({
                id: rec.id,
                ...rec.fields,
                SubUnit: rec.fields.SubUnit || rec.fields["Sub Unit"] || "Default SubUnit",
            }));
            setItems(fetchedItems);

            // Group items by Unit → SubUnit
            const grouped = {};
            fetchedItems.forEach((item) => {
                const Unit = item.Unit || "Default Unit";
                const SubUnit = item.SubUnit; // now always exists
                if (!grouped[Unit]) grouped[Unit] = {};
                if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];

                grouped[Unit][SubUnit].push(item);
            });


            const newNodes = [];
            const newEdges = [];
            let unitX = 0;
            const unitWidth = 5000;
            const unitHeight = 3000;
            const subUnitHeight = unitHeight / 9;
            const itemWidth = 160;
            const itemGap = 30;

            Object.entries(grouped).forEach(([unit, subUnits]) => {
                // Unit node (container)
                newNodes.push({
                    id: `unit-${unit}`,
                    position: { x: unitX, y: 0 },
                    data: { label: unit },
                    style: {
                        width: unitWidth,
                        height: unitHeight,
                        border: "4px solid #444",
                        background: "transparent",
                        boxShadow: "none",
                    },
                    draggable: false,
                    selectable: false,
                });

                Object.entries(subUnits).forEach(([subUnit, items], index) => {
                    const yOffset = index * subUnitHeight;

                    // SubUnit node (container)
                    newNodes.push({
                        id: `sub-${unit}-${subUnit}`,
                        position: { x: unitX + 10, y: yOffset + 10 },
                        data: { label: subUnit },
                        style: {
                            width: unitWidth - 20,
                            height: subUnitHeight - 20,
                            border: "2px dashed #aaa",
                            background: "transparent",
                            boxShadow: "none",
                        },
                        draggable: false,
                        selectable: false,
                    });

                    // Items inside subUnit
                    let itemX = unitX + 40;
                    items.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                    items.forEach((item) => {
                        newNodes.push({
                            id: item.id,
                            position: { x: itemX, y: yOffset + 20 },
                            data: {
                                label: `${item.Code || ""} - ${item.Name || ""}`,
                                icon: getItemIcon(item, { width: 40, height: 40 }),
                            },
                            type: item.Category === "Equipment" ? "equipment" : "scalableIcon",
                            sourcePosition: "right",
                            targetPosition: "left",
                            style: { background: "transparent", boxShadow: "none" },
                        });
                        itemX += itemWidth + itemGap;
                    });
                });

                unitX += unitWidth + 100;
            });

            setNodes(newNodes);
            setEdges(newEdges);
        };

        fetchData().catch(console.error);
    }, []);

    const createNewItem = () => {
        const newItem = {
            id: `item-${Date.now()}`,
            Code: 'NEW001',
            Name: 'New Item',
            Category: 'Equipment',
            Unit: 'Unit 1',
            SubUnit: 'Sub 1',
            Sequence: 0,
        };

        setItems((prevItems) => [...prevItems, newItem]);

        // Find existing Unit/SubUnit nodes
        const unitNode = nodes.find((n) => n.id === `unit-${newItem.Unit}`);
        const subUnitNode = nodes.find((n) => n.id === `sub-${newItem.Unit}-${newItem.SubUnit}`);

        // Fallback position if containers don’t exist yet
        const baseX = subUnitNode?.position.x + 30 || 100;
        const baseY = subUnitNode?.position.y + 20 || 100;

        // Count existing items in this subunit to offset
        const existingItemsInSubUnit = nodes.filter(
            (n) => n.data?.unit === newItem.Unit && n.data?.subUnit === newItem.SubUnit
        );
        const itemX = baseX + existingItemsInSubUnit.length * 190; // item width + gap
        const itemY = baseY;

        const createNewItem = () => {
            const newItem = {
                id: `item-${Date.now()}`,
                Code: "NEW001",
                Name: "New Item",
                Category: "Equipment",
                Unit: "Unit 1",
                SubUnit: "Sub 1",
                Sequence: 0,
            };

            setItems((prevItems) => [...prevItems, newItem]);

            // Find existing Unit/SubUnit nodes
            const unitNode = nodes.find((n) => n.id === `unit-${newItem.Unit}`);
            const subUnitNode = nodes.find((n) => n.id === `sub-${newItem.Unit}-${newItem.SubUnit}`);

            // Base position: inside subUnit container if it exists
            const baseX = subUnitNode?.position.x + 20 || 200;
            const baseY = subUnitNode?.position.y + 20 || 200;

            // Count existing item nodes in this SubUnit
            const existingItemsInSubUnit = nodes.filter(
                (n) =>
                    n.data?.unit === newItem.Unit &&
                    n.data?.subUnit === newItem.SubUnit &&
                    n.id.startsWith("item-")
            );

            const itemX = baseX + existingItemsInSubUnit.length * 190; // width + gap
            const itemY = baseY;

            const newNode = {
                id: newItem.id,
                position: { x: itemX, y: itemY },
                data: {
                    label: `${newItem.Code} - ${newItem.Name}`,
                    icon: getItemIcon(newItem, { width: 40, height: 40 }),
                    unit: newItem.Unit,
                    subUnit: newItem.SubUnit,
                },
                type: newItem.Category === "Equipment" ? "equipment" : "scalableIcon",
                sourcePosition: "right",
                targetPosition: "left",
                style: { background: "transparent" },
            };

            setNodes((prevNodes) => [...prevNodes, newNode]);
            setSelectedItem(newItem);

            // Optional: scroll/fit view so the new node is visible
            setTimeout(() => {
                if (reactFlowInstance) reactFlowInstance.fitView({ padding: 0.1 });
            }, 50);
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
                    onInit={setReactFlowInstance} // <-- capture instance
                >
                    <Controls />
                </ReactFlow>
            </div>

            <div style={{ width: 350, borderLeft: "1px solid #ccc", overflowY: "auto", background: "transparent" }}>
                {selectedItem ? (
                    <ItemDetailCard item={selectedItem} onChange={handleItemChange} />
                ) : (
                    <div style={{ padding: 20, color: "#888" }}>Select an item to see details</div>
                )}
            </div>
        </div>
    );
}
