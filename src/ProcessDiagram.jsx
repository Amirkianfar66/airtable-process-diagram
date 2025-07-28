import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

// Fetch Airtable data
const fetchData = async () => {
  const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
  const token = import.meta.env.VITE_AIRTABLE_TOKEN;
  const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

  const url = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ Airtable API error: ${res.status} ${res.statusText}`, errorText);
    throw new Error(`Airtable API error`);
  }

  const data = await res.json();
  return data.records.map(rec => rec.fields);
};

const categoryIcons = {
  Valve: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Valve.svg',
  // Add more category icons if needed
};

export default function ProcessDiagram() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData()
      .then(items => {
        const newNodes = [];
        const newEdges = [];
        let idCounter = 1;

        const grouped = {};
        items.forEach(item => {
          const { Unit, SubUnit = item['Sub Unit'], Category, Sequence = 0, Name, ['Item Code']: Code } = item;
          if (!Unit || !SubUnit) return;
          if (!grouped[Unit]) grouped[Unit] = {};
          if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
          grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code });
        });

        let xOffset = 0;
        const unitSpacing = 150;
        const subunitSpacing = 100;
        const nodeWidth = 160;
        const nodeHeight = 60;
        const padding = 40;

        Object.entries(grouped).forEach(([unit, subUnits]) => {
          let unitTop = Infinity;
          let unitBottom = -Infinity;
          let unitLeft = xOffset;
          let unitRight = xOffset;

          let yOffset = 0;

          Object.entries(subUnits).forEach(([sub, items]) => {
            items.sort((a, b) => a.Sequence - b.Sequence);

            let previousNodeId = null;
            const nodesInSubunit = [];

            items.forEach((item, i) => {
              const id = `n${idCounter++}`;
              const x = xOffset + i * (nodeWidth + 20);
              const y = yOffset;

              newNodes.push({
                id,
                position: { x, y },
                data: {
                  label: `${item.Code || ''} - ${item.Name || ''}`,
                  icon: categoryIcons[item.Category] || null
                },
                type: 'default'
              });

              nodesInSubunit.push({ x, y });

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

            // SubUnit rectangle
            const maxX = Math.max(...nodesInSubunit.map(n => n.x)) + nodeWidth + padding / 2;
            const maxY = yOffset + nodeHeight + padding;
            const minX = Math.min(...nodesInSubunit.map(n => n.x)) - padding / 2;
            const minY = yOffset - padding / 2;

            newNodes.push({
              id: `sub-${unit}-${sub}`,
              position: { x: minX, y: minY },
              data: { label: `SubUnit: ${sub}` },
              style: {
                width: maxX - minX,
                height: maxY - minY,
                border: '1px dashed gray',
                background: '#f9f9f9',
                zIndex: -1
              },
              type: 'default',
              draggable: false
            });

            // Update unit bounds
            unitTop = Math.min(unitTop, minY);
            unitBottom = Math.max(unitBottom, maxY);
            unitRight = Math.max(unitRight, maxX);

            yOffset = maxY + subunitSpacing;
          });

          // Unit rectangle
          newNodes.push({
            id: `unit-${unit}`,
            position: { x: unitLeft - padding, y: unitTop - padding },
            data: { label: `Unit: ${unit}` },
            style: {
              width: unitRight - unitLeft + 2 * padding,
              height: unitBottom - unitTop + 2 * padding,
              border: '2px solid black',
              background: 'transparent',
              zIndex: -2
            },
            type: 'default',
            draggable: false
          });

          xOffset = unitRight + unitSpacing;
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
    return <div style={{ color: 'red', padding: 20 }}>❌ Error loading data: {error}</div>;
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1} 
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
