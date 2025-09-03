// diagramBuilder.js
import { getItemIcon, categoryTypeMap } from './IconManager';
import { nanoid } from 'nanoid';

export function buildDiagram(items = [], unitLayoutOrder = [[]]) {
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

        // Stable id
        id: item.id || `${item.Category}-${item.Type}-${item.Name || 'Unnamed'}-${item.Sequence}-${item.Number}`,

        // 🔑 Normalize connections to **Codes**
        Connections: Array.isArray(item.Connections)
            ? item.Connections.map(conn => {
                if (typeof conn === "string") {
                    // could be a Name or already a Code
                    return nameToCode[conn] || conn; // map Name→Code, else keep as-is
                }
                if (conn && typeof conn === "object") {
                    // supports {from,to} or {fromId,toId} forms from AI
                    if (conn.to) return nameToCode[conn.to] || conn.to;      // map Name→Code when possible
                    if (conn.toId) return conn.toId;                         // already a Code/id
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

            // Unit
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

                // SubUnit
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
                let itemX = colIndex * (unitWidth + 100) + 40;
                itemsArr.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                itemsArr.forEach(item => {
                    const safeCategory = (item.Category || 'Equipment').toString();
                    const safeType = (item.Type || 'Generic').toString();

                    newNodes.push({
                        id: item.id,
                        position: { x: itemX, y: subUnitY + 20 },
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
                    itemX += itemWidth + itemGap;
                });
            });
        });
    });

    // 5) Build edges
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
