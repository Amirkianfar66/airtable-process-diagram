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

const STORAGE_KEY = 'process-diagram-layout';

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

const categoryColors = {
  Equipment: '#a3d977',
  Instrument: '#f4a261',
  'Inline Valve': '#333333',
  Pipe: '#3a86ff',
  Electrical: '#e63946'
};

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

const nodeTypes = {
  itemNode: ItemNode
};

export default function ProcessDiagram() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState(null);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'default' }, eds)),
    [setEdges]
  );

  const loadFromAirtable = () => {
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
        const unitWidth = 800;
        const unitHeight = 1200;
        const subUnitHeight = unitHeight / 9;
        const subUnitWidth = unitWidth - 40;
        const padding = 20;

        Object.entries(grouped).forEach(([unit, subUnits], unitIndex) => {
          const subUnitRects = [];
          const subUnitPositions = {};

          let subIndex = 0;
          Object.entries(subUnits).forEach(([sub, items]) => {
            const subX = unitX + padding;
            const subY = unitY + padding + subIndex * subUnitHeight;

            subUnitRects.push({
              id: `sub-${unit}-${sub}`,
              position: { x: subX, y: subY },
              data: { label: sub },
              style: {
                width: subUnitWidth,
                height: subUnitHeight - 10,
                border: '1px dashed #999',
                backgroundColor: 'transparent',
                pointerEvents: 'none'
              },
              selectable: false,
              type: 'input'
            });

            subUnitPositions[sub] = { x: subX, y: subY };
            subIndex++;
          });

          Object.entries(subUnits).forEach(([sub, items]) => {
            const { x: baseX, y: baseY } = subUnitPositions[sub];
            const itemsPerRow = Math.floor(subUnitWidth / 150);
            let previousNodeId = null;

            items.sort((a, b) => a.Sequence - b.Sequence);

            items.forEach((item, i) => {
              const id = `node-${idCounter++}`;
              const categoryColor = categoryColors[item.Category] || '#cccccc';

              const row = Math.floor(i / itemsPerRow);
              const col = i % itemsPerRow;

              const nodeX = baseX + 20 + col * 140;
              const nodeY = baseY + 20 + row * 80;

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
          });

          newNodes.push(...subUnitRects);

          newNodes.push({
            id: `unit-${unit}`,
            position: { x: unitX, y: unitY },
            data: { label: unit },
            style: {
              width: unitWidth,
              height: unitHeight,
              border: '4px solid #444',
              backgroundColor: 'transparent',
              pointerEvents: 'none'
            },
            selectable: false,
            type: 'input'
          });

          unitX += unitWidth + 100;
        });

        setNodes(newNodes);
        setEdges(newEdges);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      });
  };

  const saveLayout = () => {
    const layout = { nodes, edges };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    alert('Layout saved ✅');
  };

  const resetLayout = () => {
    localStorage.removeItem(STORAGE_KEY);
    loadFromAirtable();
    alert('Reset to original Airtable layout 🔄');
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setNodes(parsed.nodes || []);
      setEdges(parsed.edges || []);
    } else {
      loadFromAirtable();
    }
  }, []);

  if (error) return <div style={{ color: 'red', padding: 20 }}>❌ Error: {error}</div>;

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
        <button
          onClick={saveLayout}
          style={{
            marginRight: 10,
            padding: '6px 12px',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          💾 Save Layout
        </button>
        <button
          onClick={resetLayout}
          style={{
            padding: '6px 12px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          🔄 Reset to Default
        </button>
      </div>

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
