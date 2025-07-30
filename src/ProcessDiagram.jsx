import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useReactFlow,
  MiniMap
} from 'reactflow';
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

const categoryColors = {
  Equipment: '#7ED957',
  Instrument: '#FFA500',
  Valve: '#000000',
  Pipe: '#0000FF',
  Electrical: '#FF0000',
  'Inline item': '#333333'
};

export default function ProcessDiagram() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [originalState, setOriginalState] = useState({ nodes: [], edges: [] });
  const [error, setError] = useState(null);
  const { setViewport } = useReactFlow();

  const unitWidth = 800;
  const unitHeight = 1200;
  const subUnitHeight = 120;
  const subUnitWidth = 760;
  const padding = 20;
  const itemsPerRow = 5;
  const nodeSpacing = 130;

  const layoutData = useCallback((items) => {
    const grouped = {};
    items.forEach(item => {
      const { Unit, ['Sub Unit']: SubUnit, Category, Sequence = 0, Name, ['Item Code']: Code } = item;
      if (!Unit || !SubUnit) return;
      if (!grouped[Unit]) grouped[Unit] = {};
      if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
      grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code });
    });

    const newNodes = [];
    const newEdges = [];
    let idCounter = 1;
    let unitIndex = 0;

    Object.entries(grouped).forEach(([unit, subUnits]) => {
      const unitX = unitIndex * (unitWidth + 100);
      const unitY = 0;

      newNodes.push({
        id: `unit-${unit}`,
        type: 'input',
        position: { x: unitX, y: unitY },
        data: { label: `Unit: ${unit}` },
        style: {
          width: unitWidth,
          height: unitHeight,
          border: '4px solid #444',
          backgroundColor: '#f9f9f9',
          pointerEvents: 'none'
        },
        draggable: false,
        selectable: false
      });

      const subUnitNames = Object.keys(subUnits).slice(0, 9);
      const subUnitPositions = {};

      subUnitNames.forEach((sub, idx) => {
        const subX = unitX + padding;
        const subY = unitY + padding + idx * (subUnitHeight + padding);

        newNodes.push({
          id: `sub-${unit}-${sub}`,
          type: 'input',
          position: { x: subX, y: subY },
          data: { label: `Sub Unit: ${sub}` },
          style: {
            width: subUnitWidth,
            height: subUnitHeight,
            border: '1px dashed #aaa',
            backgroundColor: 'transparent',
            pointerEvents: 'none'
          },
          draggable: false,
          selectable: false
        });

        subUnitPositions[sub] = { x: subX, y: subY };
      });

      Object.entries(subUnits).forEach(([sub, items]) => {
        const base = subUnitPositions[sub];
        if (!base) return;

        items.sort((a, b) => a.Sequence - b.Sequence);
        let previousNodeId = null;

        items.forEach((item, i) => {
          const id = `node-${idCounter++}`;
          const col = i % itemsPerRow;
          const row = Math.floor(i / itemsPerRow);
          const x = base.x + 10 + col * nodeSpacing;
          const y = base.y + 10 + row * 90;

          newNodes.push({
            id,
            position: { x, y },
            type: 'default',
            data: {
              label: `${item.Code || ''} - ${item.Name || ''}`,
              color: categoryColors[item.Category] || '#ccc'
            },
            style: {
              backgroundColor: categoryColors[item.Category] || '#ccc',
              color: '#fff',
              padding: 10,
              borderRadius: 5,
              width: 120
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
      });

      unitIndex++;
    });

    return { newNodes, newEdges };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('processLayout');
    if (stored) {
      const { nodes, edges } = JSON.parse(stored);
      setNodes(nodes);
      setEdges(edges);
      setOriginalState({ nodes, edges });
      return;
    }

    fetchData()
      .then(items => {
        const { newNodes, newEdges } = layoutData(items);
        setNodes(newNodes);
        setEdges(newEdges);
        setOriginalState({ nodes: newNodes, edges: newEdges });
        localStorage.setItem('processLayout', JSON.stringify({ nodes: newNodes, edges: newEdges }));
      })
      .catch(err => setError(err.message));
  }, [layoutData]);

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const updated = nds.map(node => {
        const change = changes.find(c => c.id === node.id);
        return change ? { ...node, position: change.position || node.position } : node;
      });
      localStorage.setItem('processLayout', JSON.stringify({ nodes: updated, edges }));
      return updated;
    });
  }, [edges]);

  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => {
      const updated = eds.map(edge => {
        const change = changes.find(c => c.id === edge.id);
        return change ? { ...edge, ...change } : edge;
      });
      localStorage.setItem('processLayout', JSON.stringify({ nodes, edges: updated }));
      return updated;
    });
  }, [nodes]);

  const onConnect = useCallback((params) => {
    const newEdge = { ...params, id: `e${params.source}-${params.target}` };
    const updatedEdges = addEdge(newEdge, edges);
    setEdges(updatedEdges);
    localStorage.setItem('processLayout', JSON.stringify({ nodes, edges: updatedEdges }));
  }, [edges, nodes]);

  const resetLayout = () => {
    localStorage.removeItem('processLayout');
    setNodes(originalState.nodes);
    setEdges(originalState.edges);
    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  if (error) {
    return <div style={{ padding: 20, color: 'red' }}>❌ Error loading: {error}</div>;
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <button
        onClick={resetLayout}
        style={{ position: 'absolute', zIndex: 1000, top: 10, right: 10, padding: 10 }}
      >
        Reset to Default
      </button>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        panOnDrag
        zoomOnScroll
        minZoom={0.1}
        maxZoom={3}
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}
