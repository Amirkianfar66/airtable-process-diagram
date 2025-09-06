// src/components/diagramBuilder.js
import { getItemIcon, categoryTypeMap } from './IconManager';
import { nanoid } from 'nanoid';

/**
 * Build diagram without auto-repositioning items.
 *
 * items:           array of item objects (can include x,y)
 * unitLayoutOrder: 2D array of unit names (for drawing unit/subunit frames only)
 * opts.prevNodes:  previous React Flow nodes (to preserve positions)
 */
export function buildDiagram(items = [], unitLayoutOrder = [[]], opts = {}) {
    const prevNodes = Array.isArray(opts.prevNodes) ? opts.prevNodes : [];
    const posCache = new Map(prevNodes.map(n => [String(n.id), n?.position || {}]));

    // 0) Name → Code lookup from incoming items
    const nameToCode = {};
    items.forEach(i => {
        const name = i?.Name;
        const code = i?.Code || i?.['Item Code'];
        if (name && code) nameToCode[name] = code;
    });

    // 1) Normalize items (do NOT touch x/y here)
    const normalized = items.map(item => {
        const Code = item.Code || item['Item Code'] || '';
        const Type =
            Array.isArray(item.Type) ? String(item.Type[0] ?? '') : String(item.Type ?? '');
        const Category = String(item.Category ?? item['Category Item Type'] ?? 'Equipment');

        return {
            ...item,
            Code,
            Type,
            Category,
            Unit: item.Unit != null ? String(item.Unit) : 'No Unit',
            SubUnit: item.SubUnit != null ? String(item.SubUnit) : 'No SubUnit',
            Sequence: Number.isFinite(Number(item.Sequence)) ? Number(item.Sequence) : 1,
            Number: Number.isFinite(Number(item.Number)) ? Number(item.Number) : 1,
            id: String(item.id ?? `${Category}-${Type}-${item.Name || 'Unnamed'}-${Code || ''}`),

            // Normalize Connections to use Codes when possible
            Connections: Array.isArray(item.Connections)
                ? item.Connections.map(conn => {
                    if (typeof conn === 'string') {
                        // could be a Name or already a Code
                        return nameToCode[conn] || conn;
                    }
                    if (conn && typeof conn === 'object') {
                        if (conn.to) return nameToCode[conn.to] || conn.to;
                        if (conn.toId) return conn.toId;
                    }
                    return null;
                }).filter(Boolean)
                : [],
        };
    });

    // 2) Prepare unit layout (frames only; item positions are preserved)
    let safeLayout = Array.isArray(unitLayoutOrder)
        ? unitLayoutOrder.map(row => (Array.isArray(row) ? row.map(u => String(u)) : []))
        : [[]];

    // Include missing units in the layout frame so labels/boxes show up
    const allUnits = [...new Set(normalized.map(i => i.Unit))];
    if (!safeLayout.length) safeLayout = [[]];
    allUnits.forEach(u => {
        const exists = safeLayout.some(row => row.includes(u));
        if (!exists) safeLayout[0].push(u);
    });

    // 3) Group items by Unit/SubUnit (only for drawing frames; NOT used for positioning)
    const grouped = {};
    normalized.forEach(item => {
        const { Unit, SubUnit } = item;
        if (!grouped[Unit]) grouped[Unit] = {};
        if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
        grouped[Unit][SubUnit].push(item);
    });

    const nodes = [];
    const edges = [];

    // Big canvas frames (units & subunits)
    const unitWidth = 5000;
    const unitHeight = 6000;
    const subUnitHeight = unitHeight / 9;

    safeLayout.forEach((row, rowIndex) => {
        row.forEach((unitName, colIndex) => {
            const unit = String(unitName || 'No Unit');
            if (!grouped[unit]) return;

            // Unit frame (non-draggable, non-selectable)
            nodes.push({
                id: `unit-${unit}`,
                type: 'custom',
                position: { x: colIndex * (unitWidth + 100), y: rowIndex * (unitHeight + 100) },
                data: {
                    label: unit,
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

            const subUnits = grouped[unit];
            const subKeys = Object.keys(subUnits);
            subKeys.forEach((sub, subIndex) => {
                const subY = rowIndex * (unitHeight + 100) + subIndex * subUnitHeight;

                // SubUnit frame (non-draggable, non-selectable)
                nodes.push({
                    id: `sub-${unit}-${sub}`,
                    position: { x: colIndex * (unitWidth + 100) + 10, y: subY + 10 },
                    data: { label: sub },
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
            });
        });
    });

    // 4) Add item nodes WITHOUT changing positions
    // For truly new items (no prev position and no x/y), give a one-time initial position,
    // then keep it forever on subsequent builds (via posCache or saved x/y).
    const INITIAL_X = 100;
    const INITIAL_Y = 100;
    let nextOffset = 0; // small offset to avoid perfect overlap on first creation

    normalized.forEach(item => {
        const id = String(item.id);
        const cached = posCache.get(id);
        let position;

        if (cached && Number.isFinite(cached.x) && Number.isFinite(cached.y)) {
            position = { x: cached.x, y: cached.y };
        } else if (Number.isFinite(item.x) && Number.isFinite(item.y)) {
            position = { x: Number(item.x), y: Number(item.y) };
        } else {
            // first-ever placement only
            position = { x: INITIAL_X + (nextOffset * 40), y: INITIAL_Y + (nextOffset * 40) };
            nextOffset += 1;
        }

        const category = String(item.Category || item['Category Item Type'] || 'Equipment');

        nodes.push({
            id,
            position,
            data: {
                label: `${item.Code || ''} - ${item.Name || ''}`,
                item, // keep full item so side panel/icon have all fields
                icon: getItemIcon(item, { width: 40, height: 40 }),
            },
            type: categoryTypeMap[category] || 'scalableIcon',
            sourcePosition: 'right',
            targetPosition: 'left',
            style: { background: 'transparent', boxShadow: 'none' },
        });
    });

    // 5) Build edges (by Code)
    normalized.forEach(item => {
        const fromNode = nodes.find(n => n.id === String(item.id));
        if (!fromNode) return;

        (item.Connections || []).forEach(conn => {
            const toCode = nameToCode[conn] || conn;
            const toNode = nodes.find(n => n.data?.item?.Code === toCode);
            if (!toNode) return;

            edges.push({
                id: `edge-${fromNode.id}-${toNode.id}-${nanoid(6)}`,
                source: fromNode.id,
                target: toNode.id,
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#888', strokeWidth: 2 },
            });
        });
    });

    return {
        nodes,
        edges,
        normalizedItems: normalized,
    };
}
