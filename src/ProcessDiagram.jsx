import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

const fetchData = async () => {
  console.log('🔄 Starting fetchData...');

  const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
  const token = import.meta.env.VITE_AIRTABLE_TOKEN;
  const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

  console.log('📦 ENV values:', {
    baseId,
    token: token?.slice(0, 10) + '...',
    table
  });

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
  console.log("✅ Fetched data from Airtable:", data);
  return data.records.map(rec => rec.fields);
};

const categoryIcons = {
  Valve: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Valve.svg'
};

export default function ProcessDiagram() {
  const [elements, setElements] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData()
      .then(items => {
        console.log("🧩 Processing items:", items);
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

        const computeBounds = (items) => {
          const xs = items.map((_, i) => i * 180);
          const ys = items.map(() => 0);
          return {
            x: Math.min(...xs) - 40,
            y: Math.min(...ys) - 40,
            width: (items.length - 1) * 180 + 160,
            height: 120
          };
        };

        let x = 0;
        Object.entries(grouped).forEach(([unit, subUnits]) => {
          let y = 0;
          const allSubNodes = [];

          Object.entries(subUnits).forEach(([sub, items]) => {
            items.sort((a, b) => a.Sequence - b.Sequence);
            let previousNodeId = null;

            const subNodeIds = [];

            items.forEach((item, i) => {
              const id = String(idCounter++);
              const nodeX = x + i * 180;
              const nodeY = y;

              newNodes.push({
                id,
                position: { x: nodeX, y: nodeY },
                data: {
                  label: `${item.Code || ''} - ${item.Name || ''}`,
                  icon: categoryIcons[item.Category] || null
                },
                type: 'default'
              });

              subNodeIds.push({ x: nodeX, y: nodeY });

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

            const bounds = computeBounds(items);
            newNodes.push({
              id: `subbox-${unit}-${sub}`,
              position: { x: x - 60, y: y - 60 },
              data: { label: sub },
              style: {
                width: bounds.width,
                height: bounds.height,
                border: '1px dashed gray',
                background: 'transparent',
                borderRadius: 5,
                zIndex: -1
              },
              draggable: false,
              selectable: false,
              type: 'default'
            });

            allSubNodes.push({ x, y, w: bounds.width, h: bounds.height });
            y += 200;
          });

          const minX = Math.min(...allSubNodes.map(n => n.x));
          const maxX = Math.max(...allSubNodes.map(n => n.x + n.w));
          const minY = Math.min(...allSubNodes.map(n => n.y));
          const maxY = Math.max(...allSubNodes.map(n => n.y + n.h));

          newNodes.push({
            id: `unitbox-${unit}`,
            position: { x: minX - 40, y: minY - 60 },
            data: { label: unit },
            style: {
              width: maxX - minX + 80,
              height: maxY - minY + 100,
              border: '3px solid black',
              background: 'transparent',
              borderRadius: 5,
              zIndex: -2
            },
            draggable: false,
            selectable: false,
            type: 'default'
          });

          x += 400;
        });

        console.log("✅ Nodes and edges created:", { newNodes, newEdges });
        setElements([...newNodes, ...newEdges]);
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
        elements={elements}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
