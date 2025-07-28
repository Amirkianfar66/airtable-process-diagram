import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

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
    throw new Error(`Airtable API error: ${res.status} ${res.statusText}: ${errorText}`);
  }

  const data = await res.json();
  return data.records.map(rec => rec.fields);
};

// Color mapping for categories
const categoryColors = {
  Equipment: '#a3d977',      // Green
  Instrument: '#f4a261',     // Orange
  'Inline Valve': '#333333', // Black
  Pipe: '#3a86ff',           // Blue
  Electrical: '#e63946'      // Red
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
            const nodeY = unitY + subY + 40;
            const nodeXStart = unitX + 40;
            const nodeSpacing = 180;

            items.forEach((item, i) => {
              const id = `node-${idCounter++}`;
              const categoryColor = categoryColors[item.Category] || '#cccccc';
              const nodeX = nodeXStart + i * nodeSpacing;

              newNodes.push({
                id,
                position: { x: nodeX, y: nodeY },
                data: {
                  label: `${item.Code || ''} - ${item.Name || ''}`
                },
                style: {
                  border: `2px solid ${categoryColor}`,
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  fontSize: 12
                }
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

            const subUnitWidth = items.length * nodeSpacing + 60;
            const subUnitHeight = 100;
            maxWidth = Math.max(maxWidth, subUnitWidth);
            totalHeight += subUnitHeight + 20;

            subUnitRects.push({
              id: `sub-${unit}-${sub}`,
              type: 'input',
              position: { x: unitX + 20, y: unitY + subY },
              data: { label: sub },
              style: {
                width: subUnitWidth,
                height: subUnitHeight,
                border: '1px dashed #999',
                backgroundColor: 'transparent',
                pointerEvents: 'none'
              },
              selectable: false
            });

            subY += subUnitHeight + 20;
          });

          newNodes.push(...subUnitRects);

          // Unit rectangle
          newNodes.push({
            id: `unit-${unit}`,
            type: 'input',
            position: { x: unitX, y: unitY },
            data: { label: unit },
            style: {
              width: maxWidth + 40,
              height: totalHeight,
              border: '4px solid #444',
              backgroundColor: 'transparent',
              pointerEvents: 'none'
            },
            selectable: false
          });

          unitX += maxWidth + 120;
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
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
