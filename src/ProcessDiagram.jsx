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

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.records.map(rec => rec.fields);
};

const categoryIcons = {
  Valve: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Valve.svg',
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

        let globalX = 0;

        Object.entries(grouped).forEach(([unit, subUnits]) => {
          const unitId = `unit-${unit}`;
          let localY = 0;
          let maxUnitWidth = 0;
          const subUnitNodeIds = [];

          Object.entries(subUnits).forEach(([sub, items]) => {
            items.sort((a, b) => a.Sequence - b.Sequence);
            const subUnitId = `sub-${unit}-${sub}`;
            let previousNodeId = null;
            const subX = 40;
            const subY = localY + 40;
            const nodeY = subY + 40;

            items.forEach((item, i) => {
              const id = `node-${idCounter++}`;
              const x = subX + i * 180;
              const y = nodeY;

              newNodes.push({
                id,
                position: { x, y },
                data: {
                  label: `${item.Code || ''} - ${item.Name || ''}`,
                  icon: categoryIcons[item.Category] || null
                },
                type: 'default',
                parentNode: subUnitId,
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
            });

            const width = items.length * 180 + 60;
            const height = 140;
            maxUnitWidth = Math.max(maxUnitWidth, width);

            newNodes.push({
              id: subUnitId,
              position: { x: 0, y: localY },
              data: { label: sub },
              style: {
                width,
                height,
                border: '2px dashed gray',
                background: 'transparent',
                borderRadius: 5,
              },
              type: 'group',
              parentNode: unitId,
              extent: 'parent'
            });

            localY += height + 60;
            subUnitNodeIds.push(subUnitId);
          });

          const unitHeight = localY;
          const unitWidth = maxUnitWidth + 80;

          newNodes.push({
            id: unitId,
            position: { x: globalX, y: 0 },
            data: { label: unit },
            style: {
              width: unitWidth,
              height: unitHeight,
              border: '3px solid black',
              background: 'transparent',
              borderRadius: 10,
              padding: 10
            },
            type: 'group'
          });

          globalX += unitWidth + 100;
        });

        setNodes(newNodes);
        setEdges(newEdges);
      })
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div style={{ color: 'red', padding: 20 }}>❌ Error loading data: {error}</div>;

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
