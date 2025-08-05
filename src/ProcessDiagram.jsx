import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { data } from "./data"; // import your data
import dagre from "dagre";

const nodeWidth = 180;
const nodeHeight = 60;

const colorMap: Record<string, string> = {
  Equipment: "#FFC857",
  Instrument: "#6A4C93",
  Valve: "#17BEBB",
  Pipe: "#FF7F50",
  "Inline item": "#009B72",
};

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Left;
    node.sourcePosition = Position.Right;
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};

const FlowDiagram = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const getColor = (category: string) => colorMap[category] || "#ccc";

  const generateDiagram = () => {
    const layoutNodes: Node[] = [];
    const layoutEdges: Edge[] = [];

    const groupedByUnit: Record<string, any[]> = {};

    data.forEach((item) => {
      if (!groupedByUnit[item.Unit]) {
        groupedByUnit[item.Unit] = [];
      }
      groupedByUnit[item.Unit].push(item);
    });

    let unitOffsetX = 0;

    Object.entries(groupedByUnit).forEach(([unit, items]) => {
      const groupedBySubUnit: Record<string, any[]> = {};
      items.forEach((item) => {
        if (!groupedBySubUnit[item["Sub Unit"]]) {
          groupedBySubUnit[item["Sub Unit"]] = [];
        }
        groupedBySubUnit[item["Sub Unit"]].push(item);
      });

      let subUnitOffsetY = 0;

      Object.entries(groupedBySubUnit).forEach(([subUnit, subItems]) => {
        subItems.forEach((item, index) => {
          const node: Node = {
            id: item["Item Code"],
            data: { label: `${item.Name} (${item["Item Code"]})` },
            position: {
              x: unitOffsetX,
              y: subUnitOffsetY + index * (nodeHeight + 30),
            },
            style: {
              backgroundColor: getColor(item.Category),
              width: nodeWidth,
              height: nodeHeight,
              borderRadius: 10,
              padding: 10,
              fontSize: 12,
              color: "#fff",
              textAlign: "center",
            },
          };
          layoutNodes.push(node);
        });

        subUnitOffsetY += (subItems.length + 1) * (nodeHeight + 50);
      });

      unitOffsetX += nodeWidth + 250;
    });

    // Connect sequential nodes within each Sub Unit (optional logic)
    data.forEach((item, index) => {
      const nextItem = data[index + 1];
      if (nextItem && item["Sub Unit"] === nextItem["Sub Unit"]) {
        layoutEdges.push({
          id: `${item["Item Code"]}-${nextItem["Item Code"]}`,
          source: item["Item Code"],
          target: nextItem["Item Code"],
          animated: true,
        });
      }
    });

    const layouted = getLayoutedElements(layoutNodes, layoutEdges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  };

  useEffect(() => {
    generateDiagram();
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
};

const FlowWithProvider = () => (
  <ReactFlowProvider>
    <FlowDiagram />
  </ReactFlowProvider>
);

export default FlowWithProvider;
