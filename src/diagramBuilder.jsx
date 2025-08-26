// diagramBuilder.js
import { fetchData } from './ProcessDiagram';
import { getItemIcon, categoryTypeMap } from './IconManager';

export function buildDiagram(items = [], unitLayoutOrder = [[]]) {
    // 🔹 Normalize items: Units/SubUnits as strings
    const normalized = items.map(item => ({
        ...item,
        Unit: item.Unit != null ? String(item.Unit) : "No Unit",
        SubUnit: item.SubUnit != null ? String(item.SubUnit) : "No SubUnit",
        Sequence: Number.isFinite(Number(item.Sequence)) ? Number(item.Sequence) : 1,
        Number: Number.isFinite(Number(item.Number)) ? Number(item.Number) : 1,
    }));

    // Ensure unitLayoutOrder is always a 2D array
    let safeLayout = Array.isArray(unitLayoutOrder)
        ? unitLayoutOrder.map(row => (Array.isArray(row) ? row.map(String) : []))
        : [[]];

    // Add missing units from normalized items to layout dynamically
    const allUnits = [...new Set(normalized.map(i => i.Unit))];
    allUnits.forEach(u => {
        const found = safeLayout.some(row => row.includes(u));
        if (!found) safeLayout[0].push(u); // add to first row if missing
    });

    // Group items by Unit and SubUnit
    const grouped = {};
    normalized.forEach(item => {
        const { Unit, SubUnit, Category, Sequence, Name, Code, id } = item;
        if (!grouped[Unit]) grouped[Unit] = {};
        if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
        grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code, id });
    });

    const newNodes = [];
    const newEdges = [];
    const unitWidth = 5000;
    const unitHeight = 6000;
    const subUnitHeight = unitHeight / 9;
    const itemWidth = 160;
    const itemGap = 30;

    // Build diagram nodes
    safeLayout.forEach((row, rowIndex) => {
        row.forEach((unitName, colIndex) => {
            const groupedUnitName = String(unitName || "No Unit");
            if (!grouped[groupedUnitName]) return;

            // --- Unit Node ---
            newNodes.push({
                id: `unit-${groupedUnitName}`,
                type: 'custom',
                position: { x: colIndex * (unitWidth + 100), y: rowIndex * (unitHeight + 100) },
                data: { label: groupedUnitName, fontSize: 200, fontWeight: 'bold', color: '#222', fontFamily: 'Arial, sans-serif', offsetX: 200, offsetY: -300 },
                style: { width: unitWidth, height: unitHeight, background: 'transparent', border: '4px dashed #444', borderRadius: '10px' },
                draggable: false,
                selectable: false,
            });

            const subUnits = grouped[groupedUnitName];
            Object.entries(subUnits).forEach(([subUnit, itemsArr], subIndex) => {
                const subUnitY = rowIndex * (unitHeight + 100) + subIndex * subUnitHeight;

                // --- SubUnit Node ---
                newNodes.push({
                    id: `sub-${groupedUnitName}-${subUnit}`,
                    position: { x: colIndex * (unitWidth + 100) + 10, y: subUnitY + 10 },
                    data: { label: subUnit },
                    style: { width: unitWidth - 20, height: subUnitHeight - 20, border: '2px dashed #aaa', background: 'transparent' },
                    labelStyle: { fontSize: 100, fontWeight: 600, color: '#555', fontFamily: 'Arial, sans-serif' },
                    draggable: false,
                    selectable: false,
                });

                // --- Items inside SubUnit ---
                let itemX = colIndex * (unitWidth + 100) + 40;
                itemsArr.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
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

    return {
        nodes: newNodes,
        edges: newEdges,
        normalizedItems: normalized
    };
}
