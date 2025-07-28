import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

const fetchData = async () => {
  const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
  const token = import.meta.env.VITE_AIRTABLE_TOKEN;
  const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;
  const url = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Airtable API error: ${res.statusText}`);
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
        const itemNodes = [];
        const itemEdges = [];
        let idCounter = 1;

        // Group items by unit and subunit
        const grouped = {};
        items.forEach(item => {
          const unit = item.Unit;
          const sub = item['Sub Unit'];
          if (!unit || !sub) return;
          grouped[unit] = grouped[unit] || {};
          grouped[unit][sub] = grouped[unit][sub] || [];
          grouped[unit][sub].push(item);
        });

        // Build item nodes and edges, track positions
        const subBounds = {};
        let xOffset = 0;

        Object.entries(grouped).forEach(([unit, subs]) => {
          let yOffset = 0;
          Object.entries(subs).forEach(([sub, items]) => {
            items.sort((a, b) => a.Sequence - b.Sequence);
            let prevId = null;
            items.forEach((item, idx) => {
              const id = `node-${idCounter++}`;
              const x = xOffset + idx * 180;
              const y = yOffset;
              itemNodes.push({
                id,
                type: 'default',
                data: { label: `${item['Item Code']} - ${item.Name}`, icon: categoryIcons[item.Category] },
                position: { x, y },
                parentNode: `sub-${unit}-${sub}`,
                extent: 'parent'
              });
              if (prevId) itemEdges.push({ id: `edge-${prevId}-${id}`, source: prevId, target: id, type: 'default' });
              prevId = id;
            });
            // Compute subunit bounds
            const minX = xOffset - 20;
            const minY = yOffset - 20;
            const width = (items.length - 1) * 180 + 120;
            const height = 120;
            subBounds[`${unit}-${sub}`] = { x: minX, y: minY, width, height };
            yOffset += 200;
          });
          xOffset += 400;
        });

        // Create subunit group nodes
        const groupNodes = [];
        Object.entries(subBounds).forEach(([key, bounds]) => {
          const [unit, sub] = key.split('-');
          groupNodes.push({
            id: `sub-${unit}-${sub}`,
            type: 'group',
            data: { label: sub },
            position: { x: bounds.x, y: bounds.y },
            style: { border: '1px dashed gray', width: bounds.width, height: bounds.height },
          });
        });

        // Create unit group nodes encompassing their subunits
        const unitNodes = [];
        Object.entries(grouped).forEach(([unit, subs], uIndex) => {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          Object.entries(subBounds).forEach(([key, b]) => {
            if (key.startsWith(unit + '-')) {
              minX = Math.min(minX, b.x);
              minY = Math.min(minY, b.y);
              maxX = Math.max(maxX, b.x + b.width);
              maxY = Math.max(maxY, b.y + b.height);
            }
          });
          unitNodes.push({
            id: `unit-${unit}`,
            type: 'group',
            data: { label: unit },
            position: { x: minX - 20, y: minY - 20 },
            style: { border: '3px solid black', width: maxX - minX + 40, height: maxY - minY + 40 },
          });
        });

        setNodes([...unitNodes, ...groupNodes, ...itemNodes]);
        setEdges(itemEdges);
      })
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>;

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
