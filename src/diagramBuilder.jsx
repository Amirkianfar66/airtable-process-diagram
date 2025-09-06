// src/components/diagramBuilder.js
import { getItemIcon, categoryTypeMap } from './IconManager';
import { nanoid } from 'nanoid';

export function buildDiagram(items = [], unitLayoutOrder = [[]], opts = {}) {
    const prevNodes = Array.isArray(opts.prevNodes) ? opts.prevNodes : [];
    const posCache = new Map(prevNodes.map(n => [String(n.id), n?.position || {}]));

    // Name → Code lookup so Connections can reference Names or Codes
    const nameToCode = {};
    items.forEach(i => {
        const name = i?.Name;
        const code = i?.Code || i?.['Item Code'];
        if (name && code) nameToCode[name] = code;
    });

    // Normalize items (do NOT touch x/y here)
    const normalized = items.map(item => {
        const Code = item.Code || item['Item Code'] || '';
        // allow Type as string or [recId]; keep whatever the item has (builder only renders)
        const Type = Array.isArray(item.Type) ? (item.Type[0] ?? '') : (item.Type ?? '');
        const Category = item.Category ?? item['Category Item Type'] ?? 'Equipment';

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

            // Normalize Connections to Codes when possible (leaves existing Codes as-is)
            Connections: Array.isArray(item.Connections)
                ? item.Connections
                    .map(conn => {
                        if (typeof conn === 'string') return nameToCode[conn] || conn;
                        if (conn && typeof conn === 'object') {
                            if (conn.to) return nameToCode[conn.to] || conn.to;
                            if (conn.toId) return conn.toId;
                        }
                        return null;
                    })
                    .filter(Boolean)
                : [],
        };
    });

    // Ensure unit layout includes all units present
    let safeLayout = Array.isArray(unitLayoutOrder)
        ? unitLayoutOrder.map(row => (Array.isArray(row) ? row.map(u => String(u)) : []))
        : [[]];

    const allUnits = [...new Set(normalized.map(i => i.Unit))];
    if (!safeLayout.length) safeLayout = [[]];
    allUnits.forEach(u => {
        const exists = safeLayout.some(row => row.includes(u));
        if (!exists) safeLayout[0].push(u);
    });

    // Group items by Unit/SubUnit for drawing frames and FIRST-TIME placement only
    const grouped = {};
    normalized.forEach(item => {
        const { Unit, SubUnit } = item;
        if (!grouped[Unit]) grouped[Unit] = {};
        if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
        grouped[Unit][SubUnit].push(item);
    });

    const nodes = [];
    const edges = [];

    // Canvas / frames
    const unitWidth = 5000;
    const unitHeight = 6000;
    const subUnitHeight = unitHeight / 9;
    const itemWidth = 160;
    const itemGap = 30;

    // Track subunit rectangles to compute FIRST-TIME initial positions
    const subRects = new Map(); // key: `${unit}|||${sub}`, value: { baseX, baseY }

    // 1) Frames (units + subunits)
    safeLayout.forEach((row, rowIndex) => {
        row.forEach((unitName, colIndex) => {
            const unit = String(unitName || 'No Unit');
            const unitX = colIndex * (unitWidth + 100);
            const unitY = rowIndex * (unitHeight + 100);

            if (!grouped[unit]) return;

            nodes.push({
                id: `unit-${unit}`,
                type: 'custom',
                position: { x: unitX, y: unitY },
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
                const subX = unitX + 10;
                const subY = unitY + subIndex * subUnitHeight + 10;

                nodes.push({
                    id: `sub-${unit}-${sub}`,
                    position: { x: subX, y: subY },
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

                subRects.set(`${unit}|||${sub}`, { baseX: subX + 30, baseY: subY + 10 });
            });
        });
    });

    // 2) Items — preserve position if known, else FIRST-TIME place inside its subunit row
    //    For first-time placement per subunit, advance X in order of Sequence, then Name.
    const firstTimeCounters = new Map(); // key `${unit}|||${sub}` -> nextX
    function nextFirstTimePos(unit, sub) {
        const key = `${unit}|||${sub}`;
        const rect = subRects.get(key);
        const startX = (rect?.baseX ?? 100) + 10;
        const y = (rect?.baseY ?? 100) + 10;

        const currentX = firstTimeCounters.has(key) ? firstTimeCounters.get(key) : startX;
        firstTimeCounters.set(key, currentX + itemWidth + itemGap);
        return { x: currentX, y };
    }

    // To produce nicer first-time layout, iterate subunits in layout order and sort their items
    safeLayout.forEach((row) => {
        row.forEach(unit => {
            if (!grouped[unit]) return;
            const subUnits = grouped[unit];

            Object.entries(subUnits).forEach(([sub, list]) => {
                const sorted = [...list].sort((a, b) => {
                    const s = (a.Sequence || 0) - (b.Sequence || 0);
                    if (s !== 0) return s;
                    return String(a.Name || '').localeCompare(String(b.Name || ''));
                });

                sorted.forEach(item => {
                    const id = String(item.id);
                    const cached = posCache.get(id);
                    let position;

                    if (cached && Number.isFinite(cached.x) && Number.isFinite(cached.y)) {
                        // Already placed before → keep exact position
                        position = { x: cached.x, y: cached.y };
                    } else if (Number.isFinite(item.x) && Number.isFinite(item.y)) {
                        // Item carries its own persisted position → use it
                        position = { x: Number(item.x), y: Number(item.y) };
                    } else {
                        // FIRST-EVER placement → compute inside its subunit row
                        position = nextFirstTimePos(unit, sub);
                    }

                    const category = String(item.Category ?? item['Category Item Type'] ?? 'Equipment');

                    nodes.push({
                        id,
                        position,
                        data: {
                            label: `${item.Code || ''} - ${item.Name || ''}`,
                            item,
                            icon: getItemIcon(item, { width: 40, height: 40 }),
                        },
                        type: categoryTypeMap[category] || 'scalableIcon',
                        sourcePosition: 'right',
                        targetPosition: 'left',
                        style: { background: 'transparent', boxShadow: 'none' },
                    });
                });
            });
        });
    });

    // Build a Code → nodeId map for edges
    const codeToNodeId = new Map();
    nodes.forEach(n => {
        const it = n.data?.item;
        if (it?.Code) codeToNodeId.set(String(it.Code), n.id);
    });

    // 3) Edges (use Codes)
    normalized.forEach(item => {
        const fromId = String(item.id);
        item.Connections.forEach(connCode => {
            const toId = codeToNodeId.get(String(connCode));
            if (!toId) return;

            edges.push({
                id: `edge-${fromId}-${toId}-${nanoid(6)}`,
                source: fromId,
                target: toId,
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#888', strokeWidth: 2 },
            });
        });
    });

    return { nodes, edges, normalizedItems: normalized };
}
