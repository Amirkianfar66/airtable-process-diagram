import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Airtable fetch
const fetchData = async () => {
  const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
  const token = import.meta.env.VITE_AIRTABLE_TOKEN;
  const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

  const url = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Airtable API error: ${res.status} ${res.statusText}: ${errorText}`);
  }

  const data = await res.json();
  return data.records.map(rec => rec.fields);
};

// Category colors
const categoryColors = {
  Equipment: '#a3d977',
  Instrument: '#f4a261',
  'Inline Valve': '#333333',
  Pipe: '#3a86ff',
  Electrical: '#e63946'
};

// Custom item node with handles
function ItemNode({ data }) {
  return (
    <div
      style={{
        border: `2px solid ${data.color}`,
        borderRadius: 8,
        backgroundColor: '#fff',
        padding: 10,
        fontSize: 12,
        minWidth: 120,
        textAlign: 'center'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
}

// Node type mapping
const nodeTypes = {
  itemNode: ItemNode
};

export default function ProcessDiagram() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState(null);

  // handle new connections
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'default' }, eds)),
    [setEdges]
  );

  useEffect(() => {
    fetchData()
      .then(items => {
        const newNodes = [];
        const newEdges = [];
        let idCounter = 1;

        const grouped = {};
        items.forEach(item => {
          const {
            Unit,
            SubUnit = item['Sub Unit'],
            ['Category Item Type']: Category,
            Sequence = 0,
            Name,
            ['Item Code']: Code
          } = item;

          if (!Unit || !SubUnit) return;
          if (!grouped[Unit]) grouped[Unit] = {};
          if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
          grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code });
        });

        let unitX = 0;
        let unitY = 0;

        Object.entries(grouped).forEach(([unit, subUnits]) => {
          let maxWidth = 0;
          let totalHeight = 0;
          let subY = 0;
          const subUnitRects = [];

          Object.entries(subUnits).forEach(([sub, items]) => {
            items.sort((a, b) => a.Sequence - b.Sequence);
            let previousNodeId = null;
            const nodeY = unitY + subY + 60;
            const nodeXStart = unitX + 60;
            const nodeSpacing = 160;

            items.forEach((item, i) => {
              const id = `node-${idCounter++}`;
              const categoryColor = categoryColors[item.Category] || '#cccccc';
              const nodeX = nodeXStart + i * nodeSpacing;

              newNodes.push({
                id,
                type: 'itemNode',
                position: { x: nodeX, y: nodeY },
                data: {
                  label: `${item.Code || ''} - ${item.Name || ''}`,
                  color: categoryColor
                },
                draggable: true
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

            const subUnitWidth = items.length * nodeSpacing + 100;
            const subUnitHeight = 140;
            maxWidth = Math.max(maxWidth, subUnitWidth);
            totalHeight += subUnitHeight + 20;

            subUnitRects.push({
              id: `sub-${unit}-${sub}`,
              position: { x: unitX + 40, y: unitY + subY },
              data: { label: sub },
              style: {
                width: subUnitWidth,
                height: subUnitHeight,
                border: '1px dashed #999',
                backgroundColor: 'transparent',
                pointerEvents: 'none'
              },
              selectable: false,
              type: 'input'
            });

            subY += subUnitHeight + 20;
          });

          newNodes.push(...subUnitRects);

          // Unit rectangle
          newNodes.push({
            id: `unit-${unit}`,
            position: { x: unitX, y: unitY },
            data: { label: unit },
            style: {
              width: maxWidth + 80,
              height: totalHeight,
              border: '4px solid #444',
              backgroundColor: 'transparent',
              pointerEvents: 'none'
            },
            selectable: false,
            type: 'input'
          });

          unitX += maxWidth + 150;
        });

        setNodes(newNodes);
        setEdges(newEdges);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      });
  }, []);

  if (error) {
    return <div style={{ color: 'red', padding: 20 }}>❌ Error: {error}</div>;
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
