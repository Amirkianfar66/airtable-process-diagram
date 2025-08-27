// diagramBuilder.js
import { getItemIcon, categoryTypeMap } from './IconManager';

export function buildDiagram(items = [], unitLayoutOrder = [[]]) {
    // 🔹 Normalize all items safely
    const normalized = items.map((item, index) => ({
        ...item,
        id: item.id || `${item.Name}-${index}`, // unique id fallback
        Unit: item.Unit != null ? String(item.Unit) : "No Unit",
        SubUnit: item.SubUnit != null ? String(item.SubUnit) : "No SubUnit",
        Sequence: Number.isFinite(Number(item.Sequence)) ? Number(item.Sequence) : 1,
        Number: Number.isFinite(Number(item.Number)) ? Number(item.Number) : 1,
        Category: item.Category != null ? String(item.Category) : "Equipment",
        Type: item.Type != null ? String(item.Type) : "Generic",
    }));

    // Map Name → ID for connections
    const nameToId = Object.fromEntries(normalized.map(i => [i.Name, i.id]));

    // --- Build nodes ---
    const newNodes = [];
    const unitWidth = 5000;
    const unitHeight = 6000;
    const subUnitHeight = unitHeight / 9;
    const itemWidth = 160;
    const itemGap = 30;

    unitLayoutOrder.forEach((row, rowIndex) => {
        row.forEach((unitName, colIndex) => {
            const unitId = `unit-${unitName}`;
            const unitItems = normalized.filter(i => i.Unit === unitName);

            if (!unitItems.length) return;

            // --- Unit Node ---
            newNodes.push({
                id: unitId,
                type: 'custom',
                position: { x: colIndex * (unitWidth + 100), y: rowIndex * (unitHeight + 100) },
                data: { label: unitName },
                style: { width: unitWidth, height: unitHeight, background: 'transparent', border: '4px dashed #444', borderRadius: '10px' },
                draggable: false,
                selectable: false,
            });

            // --- SubUnit Nodes and Items ---
            const subUnits = [...new Set(unitItems.map(i => i.SubUnit))];
            subUnits.forEach((subUnit, subIndex) => {
                const subUnitId = `sub-${unitName}-${subUnit}`;
                const subUnitY = rowIndex * (unitHeight + 100) + subIndex * subUnitHeight;

                newNodes.push({
                    id: subUnitId,
                    position: { x: colIndex * (unitWidth + 100) + 10, y: subUnitY + 10 },
                    data: { label: subUnit },
                    style: { width: unitWidth - 20, height: subUnitHeight - 20, border: '2px dashed #aaa', background: 'transparent' },
                    draggable: false,
                    selectable: false,
                });

                const itemsArr = unitItems.filter(i => i.SubUnit === subUnit)
                    .sort((a, b) => a.Sequence - b.Sequence);

                let itemX = colIndex * (unitWidth + 100) + 40;
                itemsArr.forEach(item => {
                    newNodes.push({
                        id: item.id,
                        position: { x: itemX, y: subUnitY + 20 },
                        data: { label: `${item.Code || ''} - ${item.Name || ''}`, item, icon: getItemIcon(item) },
                        type: categoryTypeMap[item.Category] || 'scalableIcon',
                        sourcePosition: 'right',
                        targetPosition: 'left',
                        style: { background: 'transparent', boxShadow: 'none' },
                    });
                    itemX += itemWidth + itemGap;
                });
            });
        });
    });

    // --- Build edges ---
    const newEdges = [];
    normalized.forEach(item => {
        if (Array.isArray(item.Connections)) {
            item.Connections.forEach(conn => {
                const fromId = nameToId[conn.from];
                const toId = nameToId[conn.to];
                if (fromId && toId) {
                    newEdges.push({
                        id: `edge-${fromId}-${toId}`,
                        source: fromId,
                        target: toId,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#00f', strokeWidth: 2 },
                    });
                } else {
                    console.warn('Skipped edge due to missing ID:', conn, 'nameToId:', nameToId);
                }
            });
        }
    });

    return {
        nodes: newNodes,
        edges: newEdges,
        normalizedItems: normalized
    };
}
