import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    Controls,
    Background
} from 'reactflow';
import 'reactflow/dist/style.css';

import GroupDetailCard from './GroupDetailCard';
import ItemDetailCard from './ItemDetailCard';

export default function ProcessDiagram() {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [items, setItems] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedNodeChildren, setSelectedNodeChildren] = useState([]);

    // ✅ Build lookup map: Airtable id -> normalized item
    const allItems = React.useMemo(() => {
        const map = {};
        items.forEach(it => {
            map[it.id] = {
                Code: it['Item Code'] || it.Code || '',
                Name: it['Name'] || '',
                Category: it['Category Item Type'] || it['Category'] || '',
            };
        });
        return map;
    }, [items]);

    const onNodeClick = useCallback((event, node) => {
        setSelectedNode(node);
        // Suppose children come from edges or node.data.children
        const children = nodes.filter(n => node.data?.children?.includes(n.id));
        setSelectedNodeChildren(children);
    }, [nodes]);

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            <div style={{ flex: 1 }}>
                <ReactFlowProvider>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodeClick={onNodeClick}
                        fitView
                    >
                        <Controls />
                        <Background />
                    </ReactFlow>
                </ReactFlowProvider>
            </div>

            <div style={{ width: 400, overflowY: 'auto', background: '#fafafa', padding: 12 }}>
                {selectedNode && selectedNode.type === 'item' && (
                    <ItemDetailCard node={selectedNode} />
                )}

                {selectedNode && selectedNode.type === 'group' && (
                    <GroupDetailCard
                        node={selectedNode}
                        childrenNodes={selectedNodeChildren}
                        allItems={allItems}   // ✅ pass normalized items
                        startAddItemToGroup={() => { }}
                        onAddItem={() => { }}
                        onRemoveItem={() => { }}
                        onDelete={() => { }}
                    />
                )}
            </div>
        </div>
    );
}