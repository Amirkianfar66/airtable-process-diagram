import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

const fetchData = async () => {
  const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
  const token = import.meta.env.VITE_AIRTABLE_TOKEN;
  const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

  const url = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Airtable API error: ${res.status}`, errorText);
    throw new Error(`Airtable API error`);
  }

  const data = await res.json();
  return data.records.map(rec => rec.fields);
};

const categoryColors = {
  Equipment: '#a3d977',
  Instrument: '#f4a261',
  'Inline Valve': '#333333',
  Pipe: '#4dabf7',
  Electrical: '#e63946',
};

const itemWidth = 140;
const itemHeight = 80;
const itemGap = 20;
const unitWidth = 1600;
const padding = 20;

function ProcessDiagramInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [originalNodes, setOriginalNodes] = useState([]);
  const [originalEdges, setOriginalEdges] = useState([]);
  const [error, setError] = useState(null);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'default' }, eds)),
    []
  );

  const resetLayout = () => {
    setNodes(originalNodes);
    setEdges(originalEdges);
  };

  useEffect(() => {
    fetchData()
      .then(items => {
        const newNodes = [];
        const newEdges = [];
        const grouped = {};

        items.forEach(item => {
          const { Unit, SubUnit = item['Sub Unit'], ['Category Item Type']: Category, Sequence = 0, Name, ['Item Code']: Code } = item;
          if (!Unit || !SubUnit) return;
          if (!grouped[Unit]) grouped[Unit] = {};
          if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
          grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code });
        });

        let unitIndex = 0;
        Object.entries(grouped).forEach(([unit, subUnits]) => {
          let unitX = unitIndex * (unitWidth + 200);
          let unitY = 0;
          let currentY = padding;
          const subUnitRects = [];

          Object.entries(subUnits).forEach(([sub, items], subIndex) => {
            const itemsPerRow = Math.floor((unitWidth - 2 * padding) / itemWidth);
            const rows = Math.ceil(items.length / itemsPerRow);
            const subHeight = rows * (itemHeight + itemGap) + padding;

            // Sub-unit background
            subUnitRects.push({
              id: `sub-${unit}-${sub}`,
              position: { x: unitX + padding, y: currentY },
              data: { label: sub },
              style: {
                width: unitWidth - 2 * padding,
                height: subHeight,
                border: '1px dashed #999',
                backgroundColor: 'transparent',
                pointerEvents: 'none'
              },
              selectable: false,
              type: 'input'
            });

            // Items in grid
            items.sort((a, b) => a.Sequence - b.Sequence);
            let previousNodeId = null;
            items.forEach((item, i) => {
              const col = i % itemsPerRow;
              const row = Math.floor(i / itemsPerRow);

              const nodeX = unitX + padding + col * itemWidth;
              const nodeY = currentY + padding + row * (itemHeight + itemGap);

              const id = `node-${unit}-${sub}-${i}`;
              const categoryColor = categoryColors[item.Category] || '#ccc';

              newNodes.push({
                id,
                position: { x: nodeX, y: nodeY },
                data: {
                  label: `${item.Code || ''} - ${item.Name || ''}`,
                },
                style: {
                  backgroundColor: categoryColor,
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: 10,
                  fontSize: 12,
                  color: '#fff',
                },
                draggable: true,
                type: 'default',
              });

              if (previousNodeId) {
                newEdges.push({
                  id: `e${previousNodeId}-${id}`,
                  source: previousNodeId,
                  target: id,
                  type: 'default'
                });
              }

              previousNodeId = id;
            });

            currentY += subHeight + padding;
          });

          newNodes.push(...subUnitRects);

          newNodes.push({
            id: `unit-${unit}`,
            position: { x: unitX, y: 0 },
            data: { label: unit },
            style: {
              width: unitWidth,
              height: currentY + padding,
              border: '4px solid #444',
              backgroundColor: 'transparent',
              pointerEvents: 'none'
            },
            selectable: false,
            type: 'input'
          });

          unitIndex++;
        });

        setNodes(newNodes);
        setEdges(newEdges);
        setOriginalNodes(newNodes);
        setOriginalEdges(newEdges);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      });
  }, []);

  if (error) {
    return <div style={{ color: 'red', padding: 20 }}>❌ Error loading data: {error}</div>;
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls />
      </ReactFlow>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
        <button onClick={resetLayout} style={{ padding: '6px 12px' }}>🔄 Reset Layout</button>
      </div>
    </div>
  );
}

export default function ProcessDiagram() {
  return (
    <ReactFlowProvider>
      <ProcessDiagramInner />
    </ReactFlowProvider>
  );
}
