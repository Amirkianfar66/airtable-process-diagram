// diagramBuilder.js
import { getItemIcon, categoryTypeMap } from './IconManager';
import { nanoid } from 'nanoid';

/**
 * buildDiagram(items, unitLayoutOrder, options)
 * options.prevNodes: optional array of existing nodes (from ReactFlow) whose positions we should reuse
 *
 * NOTE: This version preserves existing node positions. It will NOT auto-spread siblings.
 * New nodes without a saved position fall back to { x: 100, y: 100 }.
 */
export function buildDiagram(items = [], unitLayoutOrder = [[]], options = {}) {
    // 0) Build Name → Code lookup from *incoming items*
    const nameToCode = {};
    items.forEach(i => {
        if (i?.Name && i?.Code) nameToCode[i.Name] = i.Code;
    });

    // 1) Normalize items
    const normalized = items.map(item => ({
        ...item,
        Unit: item.Unit != null ? String(item.Unit) : "No Unit",
        SubUnit: item.SubUnit != null ? String(item.SubUnit) : "No SubUnit",
        Sequence: Number.isFinite(Number(item.Sequence)) ? Number(item.Sequence) : 1,
        Number: Number.isFinite(Number(item.Number)) ? Number(item.Number) : 1,
        Category: item.Category != null ? String(item.Category) : "Equipment",
        Type: item.Type != null ? String(item.Type) : "Generic",

        // Stable id: prefer provided id; fallback to name-based stable key (avoid Date.now here)
        id: item.id || `${item.Category || 'cat'}-${item.Type || 'type'}-${(item.Name || 'Unnamed').replace(/\s+/g, '_')}-${item.Sequence || 1}-${item.Number || 1}`,

        // Normalize connections to Codes (unchanged)
        Connections: Array.isArray(item.Connections)
            ? item.Connections.map(conn => {
                if (typeof conn === "string") {
                    return nameToCode[conn] || conn;
                }
                if (conn && typeof conn === "object") {
                    if (conn.to) return nameToCode[conn.to] || conn.to;
                    if (conn.toId) return conn.toId;
                }
                return null;
            }).filter(Boolean)
            : [],
    }));

    // 2) Ensure unitLayoutOrder is 2D strings
    let safeLayout = Array.isArray(unitLayoutOrder)
        ? unitLayoutOrder.map(row => (Array.isArray(row) ? row.map(String) : []))
        : [[]];

    // Add missing units dynamically
    const allUnits = [...new Set(normalized.map(i => i.Unit))];
    allUnits.forEach(u => {
        const found = safeLayout.some(row => row.includes(u));
        if (!found) safeLayout[0].push(u);
    });

    // 3) Group items by Unit/SubUnit
    const grouped = {};
    normalized.forEach(item => {
        const { Unit, SubUnit, Category, Sequence, Name, Code, id, Type } = item;
        if (!grouped[Unit]) grouped[Unit] = {};
        if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
        grouped[Unit][SubUnit].push({ Category, Type, Sequence, Name, Code, id });
    });

    // Build a map of previous positions if provided (prevNodes: array)
    const prevNodes = Array.isArray(options.prevNodes) ? options.prevNodes : [];
    const prevPosMap = new Map(prevNodes.map(n => [String(n.id), n.position]));

    const newNodes = [];
    const newEdges = [];
    const unitWidth = 5000;
    const unitHeight = 6000;
    const subUnitHeight = unitHeight / 9;
    const itemWidth = 160;
    const itemGap = 30;

    // 4) Build diagram nodes
    safeLayout.forEach((row, rowIndex) => {
        row.forEach((unitName, colIndex) => {
            const groupedUnitName = String(unitName || "No Unit");
            if (!grouped[groupedUnitName]) return;

            // Unit node (unchanged)
            newNodes.push({
                id: `unit-${groupedUnitName}`,
                type: 'custom',
                position: { x: colIndex * (unitWidth + 100), y: rowIndex * (unitHeight + 100) },
                data: {
                    label: groupedUnitName,
                    fontSize: 200,
                    fontWeight: 'bold',
                    color: '#222',
                    fontFamily: 'Arial, sans-serif',
                    offsetX: 200,
                    offsetY: -300,
                },
                style: {
                    width: unitWidth,
                    height: unitHeight,
                    background: 'transparent',
                    border: '4px dashed #444',
                    borderRadius: '10px',
                },
                draggable: false,
                selectable: false,
            });

            const subUnits = grouped[groupedUnitName];
            Object.entries(subUnits).forEach(([subUnit, itemsArr], subIndex) => {
                const subUnitY = rowIndex * (unitHeight + 100) + subIndex * subUnitHeight;

                // SubUnit node (unchanged)
                newNodes.push({
                    id: `sub-${groupedUnitName}-${subUnit}`,
                    position: { x: colIndex * (unitWidth + 100) + 10, y: subUnitY + 10 },
                    data: { label: subUnit },
                    style: {
                        width: unitWidth - 20,
                        height: subUnitHeight - 20,
                        border: '2px dashed #aaa',
                        background: 'transparent',
                    },
                    labelStyle: {
                        fontSize: 100,
                        fontWeight: 600,
                        color: '#555',
                        fontFamily: 'Arial, sans-serif',
                    },
                    draggable: false,
                    selectable: false,
                });

                // Items
                // NOTE: we no longer auto-increment itemX for siblings.
                // We prefer: prev position (from prevNodes) -> item.x/item.y -> static default.
                itemsArr.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                itemsArr.forEach(item => {
                    const safeCategory = (item.Category || 'Equipment').toString();
                    const safeType = (item.Type || 'Generic').toString();

                    // If a previous node exists for this item id, reuse its position
                    const prevPos = prevPosMap.get(String(item.id));
                    // itemPosFromData: if the incoming item (from your raw data) had explicit x/y coordinates
                    const itemPosFromData = (item && typeof item.x === 'number' && typeof item.y === 'number')
                        ? { x: Number(item.x), y: Number(item.y) }
                        : null;

                    // Static fallback default position (for truly new items without previous position)
                    const defaultPos = { x: 100, y: 100 };

                    // finalPos preference: prevPos (from current ReactFlow) -> itemPosFromData -> defaultPos
                    const finalPos = prevPos
                        ? { x: Number(prevPos.x), y: Number(prevPos.y) }
                        : (itemPosFromData ? itemPosFromData : defaultPos);

                    newNodes.push({
                        id: item.id,
                        position: finalPos,
                        data: {
                            label: `${item.Code || ''} - ${item.Name || ''}`,
                            item,
                            icon: getItemIcon(item),
                        },
                        type: categoryTypeMap[safeCategory] || 'scalableIcon',
                        sourcePosition: 'right',
                        targetPosition: 'left',
                        style: { background: 'transparent', boxShadow: 'none' },
                    });

                    // NOTE: no itemX increment — siblings won't be auto-spread
                });
            });
        });
    });

    // 5) Build edges (unchanged)
    normalized.forEach(item => {
        (item.Connections || []).forEach(conn => {
            const targetCode = nameToCode[conn] || conn;

            const sourceNode = newNodes.find(n => n.data?.item?.Code === item.Code);
            const targetNode = newNodes.find(n => n.data?.item?.Code === targetCode);

            if (!sourceNode || !targetNode) {
                console.warn('Skipping edge, missing node:', item, conn);
                return;
            }

            newEdges.push({
                id: `edge-${sourceNode.id}-${targetNode.id}-${nanoid(6)}`,
                source: sourceNode.id,
                target: targetNode.id,
                type: "smoothstep",
                animated: true,
                style: { stroke: "#888", strokeWidth: 2 },
            });
        });
    });

    return {
        nodes: newNodes,
        edges: newEdges,
        normalizedItems: normalized,
    };
}
