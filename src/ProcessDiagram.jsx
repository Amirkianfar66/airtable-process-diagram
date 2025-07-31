import React, { useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';

const fetchData = async () => {
  const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
  const token = import.meta.env.VITE_AIRTABLE_TOKEN;
  const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

  const url = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Airtable API error: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const data = await res.json();
  return data.records.map((rec) => rec.fields);
};

const categoryColors = {
  Equipment: 'green',
  Instrument: 'orange',
  'Inline Valve': 'black',
  Pipe: 'blue',
  Electrical: 'red',
};

export default function ProcessDiagram() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState(null);
  const [defaultLayout, setDefaultLayout] = useState({ nodes: [], edges: [] });

  const itemWidth = 160;
  const itemHeight = 60;
  const itemGap = 30;
  const padding = 30;
  const unitWidth = 3200;
  const unitHeight = 1800; // enough to hold 9 sub-units
  const subUnitHeight = unitHeight / 9;

  useEffect(() => {
    fetchData()
      .then((items) => {
        const grouped = {};
        items.forEach((item) => {
          const { Unit, SubUnit = item['Sub Unit'], ['Category Item Type']: Category, Sequence = 0, Name, ['Item Code']: Code } = item;
          if (!Unit || !SubUnit) return;
          if (!grouped[Unit]) grouped[Unit] = {};
          if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
          grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code });
        });

        const newNodes = [];
        const newEdges = [];

        let unitX = 0;

        Object.entries(grouped).forEach(([unit, subUnits]) => {
          // Unit rectangle
          newNodes.push({
            id: `unit-${unit}`,
            position: { x: unitX, y: 0 },
            data: { label: unit },
            style: {
              width: unitWidth,
              height: unitHeight,
              border: '4px solid #444',
              backgroundColor: 'transparent',
              pointerEvents: 'none',
            },
            type: 'input',
            selectable: false,
          });

          let currentY = 0;

          const subUnitNames = Object.keys(subUnits);
          for (let i = 0; i < 9; i++) {
            const subUnitName = subUnitNames[i] || `SubUnit-${i + 1}`;
            const itemsInSubUnit = subUnits[subUnitName] || [];

            const subRectY = currentY;

            // SubUnit rectangle
            newNodes.push({
              id: `subunit-${unit}-${subUnitName}`,
              position: { x: unitX + padding, y: subRectY },
              data: { label: subUnitName },
              style: {
                width: unitWidth - 2 * padding,
                height: subUnitHeight - padding,
                border: '1px dashed #999',
                backgroundColor: 'transparent',
                pointerEvents: 'none',
              },
              type: 'input',
              selectable: false,
            });

            // Layout items inside subunit
            const itemsPerRow = Math.floor((unitWidth - 2 * padding) / (itemWidth + itemGap));
            const rows = Math.ceil(itemsInSubUnit.length / itemsPerRow);

            let previousNodeId = null;
            itemsInSubUnit.sort((a, b) => a.Sequence - b.Sequence);

            itemsInSubUnit.forEach((item, index) => {
              const row = Math.floor(index / itemsPerRow);
              const col = index % itemsPerRow;

              const nodeX = unitX + padding + col * (itemWidth + itemGap);
              const nodeY = subRectY + padding + row * (itemHeight + itemGap);

              const id = `node-${unit}-${subUnitName}-${index}`;
              const categoryColor = categoryColors[item.Category] || '#999';

              newNodes.push({
                id,
                position: { x: nodeX, y: nodeY },
                data: { label: `${item.Code || ''} - ${item.Name || ''}` },
                style: {
                  backgroundColor: categoryColor,
                  width: itemWidth,
                  height: itemHeight,
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
                  type: 'default',
                });
              }

              previousNodeId = id;
            });

            currentY += subUnitHeight;
          }

          unitX += unitWidth + 100;
        });

        setNodes(newNodes);
        setEdges(newEdges);
        setDefaultLayout({ nodes: newNodes, edges: newEdges });
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      });
  }, []);

  const onConnect = (params) => setEdges((eds) => addEdge(params, eds));

  const handleReset = () => {
    setNodes(defaultLayout.nodes);
    setEdges(defaultLayout.edges);
  };

  if (error) {
    return <div style={{ color: 'red', padding: 20 }}>❌ Error loading data: {error}</div>;
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <button onClick={handleReset} style={{ position: 'absolute', zIndex: 10, top: 10, left: 10 }}>🔁 Reset Layout</button>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
