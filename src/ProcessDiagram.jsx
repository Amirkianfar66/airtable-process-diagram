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

// STEP 2: Optional icon support by category
const categoryIcons = {
  Valve: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Valve.svg',
  // Add more category icons if needed
};

export default function ProcessDiagram() {
  const [elements, setElements] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData()
      .then(items => {
        console.log("🧩 Processing items:", items);
        const nodes = [];
        const edges = [];
        let idCounter = 1;

        const grouped = {};
        items.forEach(item => {
          const { Unit, SubUnit = item['Sub Unit'], Category, Sequence = 0, Name, ['Item Code']: Code } = item;
          if (!Unit || !SubUnit) return; // skip incomplete rows
          if (!grouped[Unit]) grouped[Unit] = {};
          if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
          grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code });
        });

        let x = 0;
        Object.entries(grouped).forEach(([unit, subUnits]) => {
          let y = 0;
          Object.entries(subUnits).forEach(([sub, items]) => {
            items.sort((a, b) => a.Sequence - b.Sequence);
            items.forEach((item, i) => {
              const id = String(idCounter++);
              nodes.push({
                id,
                data: {
                  label: `${item.Code || ''} - ${item.Name || ''}`,
                  icon: categoryIcons[item.Category] || null
                },
                position: { x: x + i * 180, y },
                type: 'default'
              });
              if (i > 0) {
                edges.push({ id: `e${idCounter++}`, source: String(idCounter - 2), target: id });
              }
            });
            y += 200;
          });
          x += 400;
        });

        console.log("✅ Nodes and edges created:", { nodes, edges });
        setElements([...nodes, ...edges]);
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
