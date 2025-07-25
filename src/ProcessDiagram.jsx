import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

// STEP 1: Fetch Airtable data with logging
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

// Optional icons by category
const categoryIcons = {
  Valve: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Valve.svg',
  // Add more category icons as needed
};

export default function ProcessDiagram() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
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

        let x = 0;
        Object.entries(grouped).forEach(([unit, subUnits]) => {
          let y = 0;
          Object.entries(subUnits).forEach(([sub, items]) => {
            items.sort((a, b) => a.Sequence - b.Sequence);
            let previousNodeId = null;
            items.forEach((item, i) => {
              const id = String(idCounter++);
              newNodes.push({
                id,
                position: { x: x + i * 180, y },
                data: {
                  label: `${item.Code || ''} - ${item.Name || ''}`,
                  icon: categoryIcons[item.Category] || null
                },
                type: 'default'
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
            y += 200;
          });
          x += 400;
        });

        console.log("✅ Created nodes and edges:", { newNodes, newEdges });
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
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
