import React, { useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
} from "reactflow";
import "reactflow/dist/style.css";

const categoryColors = {
  Process: "#A1C6EA",
  Mechanical: "#FFB6B9",
  Electrical: "#C3FDB8", // New Electrical category color
};

const HorizontalFlow = ({ elements }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const spacing = 250;

  useEffect(() => {
    const categoryLayout = {};
    const unitSubUnitY = {};

    const newNodes = [];
    const newEdges = [];

    elements.forEach((el) => {
      const { Unit, SubUnit, Category, Name, Code } = el;

      const categoryIndex = Object.keys(categoryColors).indexOf(Category);
      const catColor = categoryColors[Category] || "#ccc";

      if (!categoryLayout[Category]) categoryLayout[Category] = {};
      if (!categoryLayout[Category][Unit]) categoryLayout[Category][Unit] = {};
      if (!categoryLayout[Category][Unit][SubUnit])
        categoryLayout[Category][Unit][SubUnit] = [];

      categoryLayout[Category][Unit][SubUnit].push(el);
    });

    let currentY = 0;

    Object.keys(categoryLayout).forEach((category) => {
      Object.keys(categoryLayout[category]).forEach((unit) => {
        Object.keys(categoryLayout[category][unit]).forEach((subUnit) => {
          const items = categoryLayout[category][unit][subUnit];

          items.forEach((item, index) => {
            const nodeId = item.Code;
            const nodeLabel = `${item.Code} - ${item.Name}`;
            const x = index * spacing;
            const y = currentY;

            newNodes.push({
              id: nodeId,
              data: { label: nodeLabel },
              position: { x, y },
              style: {
                backgroundColor: categoryColors[item.Category] || "#eee",
                borderRadius: 8,
                padding: 10,
                border: "1px solid #333",
                width: 180,
              },
            });

            if (index > 0) {
              const prevNodeId = items[index - 1].Code;
              newEdges.push({
                id: `e${prevNodeId}-${nodeId}`,
                source: prevNodeId,
                target: nodeId,
                animated: true,
              });
            }
          });

          currentY += spacing;
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [elements]);

  const onConnect = (params) => setEdges((eds) => addEdge(params, eds));

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default HorizontalFlow;
