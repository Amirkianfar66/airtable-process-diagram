// diagramBuilder.js
import { fetchData } from './ProcessDiagram';
import { getItemIcon, categoryTypeMap } from './IconManager';

/**
 * Build diagram nodes and edges from items and optional unitLayoutOrder.
 * @param {Array} items - Array of normalized items from Airtable
 * @param {Array} unitLayoutOrder - 2D array defining user layout of units
 * @returns {Object} { nodes, edges }
 */
export function buildDiagram(items, unitLayoutOrder = []) {
    const grouped = {};

    // Group items by Unit -> SubUnit
    items.forEach(item => {
        const { Unit, SubUnit, Category, Sequence, Name, Code, id } = item;
        if (!Unit || !SubUnit) return;
        if (!grouped[Unit]) grouped[Unit] = {};
        if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
        grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code, id });
    });

    const allUnits = Object.keys(grouped);
    const layoutUnits = new Set(unitLayoutOrder.flat());
    const remainingUnits = allUnits.filter(u => !layoutUnits.has(u));

    // Final layout: manual rows + extra units appended as new row
    const finalLayout = unitLayoutOrder ? [...unitLayoutOrder] : [];
    if (remainingUnits.length) finalLayout.push(remainingUnits);

    const newNodes = [];
    const newEdges = [];

    // Constants for layout
    const unitWidth = 5000;
    const unitHeight = 6000;
    const subUnitHeight = unitHeight / 9;
    const itemWidth = 160;
    const itemGap = 30;
    const unitGapX = 100;
    const unitGapY = 50;

    finalLayout.forEach((row, rowIndex) => {
        row.forEach((unitName, colIndex) => {
            const unitX = colIndex * (unitWidth + unitGapX);
            const unitY = rowIndex * (unitHeight + unitGapY);

            const subUnits = grouped[unitName] || {};

            // --- Unit Node ---
            newNodes.push({
                id: `unit-${unitName}`,
                type: 'custom',
                position: { x: unitX, y: unitY },
                data: {
                    label: unitName,
                    fontSize: 200,
                    fontWeight: 'bold',
                    color: '#222',
                    fontFamily: 'Arial, sans-serif',
                    offsetX: 200,
                    offsetY: -300
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

            // --- SubUnits & Items inside this unit ---
            Object.entries(subUnits).forEach(([subUnit, itemsArr], subIndex) => {
                const subUnitY = unitY + subIndex * subUnitHeight;

                // SubUnit Node
                newNodes.push({
                    id: `sub-${unitName}-${subUnit}`,
                    position: { x: unitX + 10, y: subUnitY + 10 },
                    data: { label: subUnit },
                    style: {
                        width: unitWidth - 20,
                        height: subUnitHeight - 20,
                        border: '2px dashed #aaa',
                        background: 'transparent'
                    },
                    labelStyle: { fontSize: 100, fontWeight: 600, color: '#555', fontFamily: 'Arial, sans-serif' },
                    draggable: false,
                    selectable: false,
                });

                // Items inside SubUnit
                let itemX = unitX + 40;
                itemsArr.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                itemsArr.forEach((item) => {
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

    return { nodes: newNodes, edges: newEdges };
}
