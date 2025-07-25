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
    throw new Error(`Airtable API error: ${errorText}`);
  }

  const data = await res.json();
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

        let x = 0;
        Object.entries(grouped).forEach(([unit, subUnits]) => {
          let y = 0;
          const subBoxes = [];

          Object.entries(subUnits).forEach(([sub, items]) => {
            items.sort((a, b) => a.Sequence - b.Sequence);
            const itemNodes = [];
            let previousNodeId = null;

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
                type: 'default',
                parentNode: `subbox-${unit}-${sub}`,
                extent: 'parent'
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
              itemNodes.push({ x: nodeX, y: nodeY });
            });

            const minX = Math.min(...itemNodes.map(n => n.x)) - 20;
            const minY = Math.min(...itemNodes.map(n => n.y)) - 40;
            const maxX = Math.max(...itemNodes.map(n => n.x)) + 140;
            const maxY = Math.max(...itemNodes.map(n => n.y)) + 80;

            newNodes.push({
              id: `subbox-${unit}-${sub}`,
              position: { x: minX, y: minY },
              data: { label: sub },
              style: {
                width: maxX - minX,
                height: maxY - minY,
                border: '1px dashed gray',
                background: 'transparent',
                borderRadius: 5,
                zIndex: -1
              },
              type: 'group'
            });

            subBoxes.push({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
            y += 220;
          });

          const unitMinX = Math.min(...subBoxes.map(b => b.x)) - 20;
          const unitMinY = Math.min(...subBoxes.map(b => b.y)) - 40;
          const unitMaxX = Math.max(...subBoxes.map(b => b.x + b.width)) + 20;
          const unitMaxY = Math.max(...subBoxes.map(b => b.y + b.height)) + 40;

          newNodes.push({
            id: `unitbox-${unit}`,
            position: { x: unitMinX, y: unitMinY },
            data: { label: unit },
            style: {
              width: unitMaxX - unitMinX,
              height: unitMaxY - unitMinY,
              border: '3px solid black',
              background: 'transparent',
              borderRadius: 5,
              zIndex: -2
            },
            type: 'group'
          });

          x += 500;
        });

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
