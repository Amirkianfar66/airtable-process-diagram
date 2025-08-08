import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import 'react-resizable/css/styles.css';

// Custom components
import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableNode from './ScalableNode';
import ScalableIconNode from './ScalableIconNode';


// Icons
import EquipmentIcon from './Icons/EquipmentIcon';
import InstrumentIcon from './Icons/InstrumentIcon';
import InlineValveIcon from './Icons/InlineValveIcon';
import PipeIcon from './Icons/PipeIcon';
import ElectricalIcon from './Icons/ElectricalIcon';

// ✅ Register your custom node types
const nodeTypes = {
    resizable: ResizableNode,
    custom: CustomItemNode,
    pipe: PipeItemNode,
    scalable: ScalableNode,
    scalableIcon: ScalableIconNode,
};


const fetchData = async () => {
  const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
  const token = import.meta.env.VITE_AIRTABLE_TOKEN;
  const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;
  const url = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Airtable API error: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const data = await res.json();
  return data.records.map((rec) => rec.fields);
};

const categoryIcons = {
  Equipment: EquipmentIcon,
  Instrument: InstrumentIcon,
  'Inline Valve': InlineValveIcon,
  Pipe: PipeIcon,
  Electrical: ElectricalIcon,
};

export default function ProcessDiagram() {
  const [defaultLayout, setDefaultLayout] = useState({ nodes: [], edges: [] });
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const onSelectionChange = useCallback(({ nodes }) => {
        setSelectedNodes(nodes);
    }, []);
  const itemWidth = 160;
  const itemHeight = 60;
  const itemGap = 30;
  const padding = 30;
  const unitWidth = 3200;
  const unitHeight = 1800;
  const subUnitHeight = unitHeight / 9;

  useEffect(() => {
    fetchData()
      .then((items) => {
        const grouped = {};
        items.forEach((item) => {
          const { Unit, SubUnit = item['Sub Unit'], ['Category Item Type']: Category, Sequence = 0, Name, ['Item Code']: Code } = item;
          if (!Unit || !SubUnit) return;
          if (!grouped[Unit]) grouped[Unit] = {};
          if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
          grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code });
        });

        const newNodes = [];
        const newEdges = [];
        let idCounter = 1;
        let unitX = 0;

        Object.entries(grouped).forEach(([unit, subUnits]) => {
          const unitId = `unit-${unit}`;
          newNodes.push({
            id: unitId,
            position: { x: unitX, y: 0 },
            data: { label: unit },
            style: {
              width: unitWidth,
              height: unitHeight,
              backgroundColor: 'transparent',
              border: '4px solid #444',
              zIndex: 0,
            },
            draggable: false,
            selectable: false,
          });

          const subUnitNames = Object.keys(subUnits);
          subUnitNames.forEach((subUnit, index) => {
            const subId = `sub-${unit}-${subUnit}`;
            const yOffset = index * subUnitHeight;
            newNodes.push({
              id: subId,
              position: { x: unitX + 10, y: yOffset + 10 },
              data: { label: subUnit },
              style: {
                width: unitWidth - 20,
                height: subUnitHeight - 20,
                backgroundColor: 'transparent',
                border: '2px dashed #aaa',
                zIndex: 1,
              },
              draggable: false,
              selectable: false,
            });

            const items = subUnits[subUnit];
            items.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
            let itemX = unitX + 40;
            const itemY = yOffset + 20;
            items.forEach((item) => {
              const id = `item-${idCounter++}`;
              const IconComponent = categoryIcons[item.Category];
                newNodes.push({
                    id,
                    position: { x: itemX, y: itemY },
                    data: {
                        label: `${item.Code || ''} - ${item.Name || ''}`,
                        icon: IconComponent
                            ? <IconComponent style={{ width: 20, height: 20 }} />
                            : null,
                        scale: 1,                // ← initialize the scale factor
                    },
                    type: item.Category === 'Pipe' ? 'pipe' : 'scalableIcon',
                    sourcePosition: 'right',
                    targetPosition: 'left',
                });

              itemX += itemWidth + itemGap;
            });
          });

          unitX += unitWidth + 100;
        });

        setNodes(newNodes);
        setEdges(newEdges);
        setDefaultLayout({ nodes: newNodes, edges: newEdges });
        localStorage.setItem('diagram-layout', JSON.stringify({ nodes: newNodes, edges: newEdges }));
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  const onConnect = useCallback(
    (params) => {
      const updated = addEdge(
        {
          ...params,
          animated: true,
          style: { stroke: 'blue' },
        },
        edges
      );

      setEdges(updated);
      localStorage.setItem('diagram-layout', JSON.stringify({ nodes, edges: updated }));
    },
    [edges, nodes]
  );

  const onNodeDragStop = useCallback(
    (_, updatedNode) => {
      const updatedNodes = nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n));
      setNodes(updatedNodes);
      localStorage.setItem('diagram-layout', JSON.stringify({ nodes: updatedNodes, edges }));
    },
    [nodes, edges]
  );

  const handleReset = () => {
    setNodes(defaultLayout.nodes);
    setEdges(defaultLayout.edges);
  };

  const handleSave = () => {
    localStorage.setItem('diagram-layout', JSON.stringify({ nodes, edges }));
    alert('Layout saved!');
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div style={{ position: 'absolute', zIndex: 10, top: 10, left: 10, display: 'flex', gap: 10 }}>
        <button
          onClick={handleReset}
          style={{
            padding: '6px 12px',
            background: '#444',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          🔁 Reset Layout
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '6px 12px',
            background: '#1d8841',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          📂 Save Layout
              </button>
              <button
               onClick={() => {
            const groupId = `group-${Date.now()}`;
            setNodes((nds) =>
              nds.map((node) =>
                selectedNodes.find((sel) => sel.id === node.id)
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        groupId,
                      },
                      style: {
                        ...node.style,
                        border: '2px dashed #00bcd4',
                        backgroundColor: '#e0f7fa',
                      },
                    }
                  : node
              )
            );
          }}
          style={{
            padding: '6px 12px',
            background: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          🌀 Group Selected
        </button>

        <button
          onClick={() => {
            setNodes((nds) =>
              nds.map((node) =>
                selectedNodes.find((sel) => sel.id === node.id)
                  ? {
                      ...node,
                      data: { ...node.data, groupId: undefined },
                      style: {
                        ...node.style,
                        border: 'none',
                        backgroundColor: 'white',
                      },
                    }
                  : node
              )
            );
          }}
          style={{
            padding: '6px 12px',
            background: '#a82727',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          ❌ Ungroup
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        fitView
        minZoom={0.02}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        nodeTypes={nodeTypes} // ✅ use custom node here
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
