// diagramBuilder.js
import { fetchData } from './ProcessDiagram';
import { getItemIcon, categoryTypeMap } from './IconManager';

/**
 * Build diagram nodes and edges from Airtable items
 * @param {Object} options
 * @param {Array<Array<string>>} options.unitLayoutOrder - 2D array of unit names for layout (rows × columns)
 * @param {number} options.unitWidth
 * @param {number} options.unitHeight
 * @param {number} options.subUnitHeight
 * @param {number} options.itemWidth
 * @param {number} options.itemGap
 * @param {number} options.unitGapX
 * @param {number} options.unitGapY
 */
export async function buildDiagram({
    unitLayoutOrder = null,
    unitWidth = 5000,
    unitHeight = 6000,
    subUnitHeight = 600,
    itemWidth = 160,
    itemGap = 30,
    unitGapX = 100,
    unitGapY = 50
} = {}) {
    try {
        const itemsRaw = await fetchData();

        const normalizedItems = itemsRaw.map((item) => ({
            ...item,
            Unit: item.Unit || 'Default Unit',
            SubUnit: item.SubUnit || item['Sub Unit'] || 'Default SubUnit',
            Category: Array.isArray(item['Category Item Type']) ? item['Category Item Type'][0] : item['Category Item Type'] || '',
            Type: Array.isArray(item.Type) ? item.Type[0] : item.Type || '',
            Code: item['Item Code'] || item.Code || '',
            Name: item.Name || '',
            Sequence: item.Sequence || 0,
        }));

        // Group items by Unit → SubUnit
        const grouped = {};
        normalizedItems.forEach((item) => {
            const { Unit, SubUnit, Category, Sequence, Name, Code, id } = item;
            if (!Unit || !SubUnit) return;
            if (!grouped[Unit]) grouped[Unit] = {};
            if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
            grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code, id });
        });

        const newNodes = [];
        const newEdges = [];

        // If unitLayoutOrder not provided, default to single row of units
        const layout = unitLayoutOrder || [Object.keys(grouped)];

        layout.forEach((row, rowIndex) => {
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

        return { nodes: newNodes, edges: newEdges, normalizedItems };
    } catch (err) {
        console.error('Failed to build diagram:', err);
        return { nodes: [], edges: [], normalizedItems: [] };
    }
}
