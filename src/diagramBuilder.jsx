// src/components/diagramBuilder.js
import { getItemIcon, categoryTypeMap } from './IconManager';
import { nanoid } from 'nanoid';

/**
 * buildDiagram(items, unitLayoutOrder, { prevNodes, unitChangedIds })
 * - Keeps every node's position from prevNodes
 * - Ignores ALL changes (Type/Category/Name/SubUnit/…)
 * - EXCEPT: if the item's Unit changed (id is in unitChangedIds), it is re-placed into its new Unit area.
 */
export function buildDiagram(items = [], unitLayoutOrder = [[]], opts = {}) {
    const prevNodes = Array.isArray(opts.prevNodes) ? opts.prevNodes : [];
    const unitChangedIds =
        opts.unitChangedIds instanceof Set ? opts.unitChangedIds : new Set();

    // cache previous positions by node id
    const posCache = new Map(prevNodes.map(n => [String(n.id), n?.position || {}]));

    // Name -> Code lookup for connections
    const nameToCode = {};
    items.forEach(i => {
        const name = i?.Name;
        const code = i?.Code || i?.['Item Code'];
        if (name && code) nameToCode[name] = code;
    });

    // Normalize items (keep stable id!)
    const normalized = items.map(item => {
        const Code = item.Code || item['Item Code'] || '';
        const Type = Array.isArray(item.Type) ? (item.Type[0] ?? '') : (item.Type ?? '');
        const Category = item.Category ?? item['Category Item Type'] ?? 'Equipment';

        // 🔒 STABLE ID: prefer Airtable record id; else Code; else keep existing custom id
        const stableId = String(item.id || Code || item._genId || `gen-${nanoid(8)}`);

        return {
            ...item,
            id: stableId,
            Code,
            Type,
            Category,
            Unit: item.Unit != null ? String(item.Unit) : 'No Unit',
            SubUnit: item.SubUnit != null ? String(item.SubUnit) : 'No SubUnit',
            Sequence: Number.isFinite(Number(item.Sequence)) ? Number(item.Sequence) : 1,
            Number: Number.isFinite(Number(item.Number)) ? Number(item.Number) : 1,

            // map Connections by Code (support both Name and Code inputs)
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

    // make sure layout includes all Units
    let safeLayout = Array.isArray(unitLayoutOrder)
        ? unitLayoutOrder.map(row => (Array.isArray(row) ? row.map(u => String(u)) : []))
        : [[]];

    const allUnits = [...new Set(normalized.map(i => i.Unit))];
    if (!safeLayout.length) safeLayout = [[]];
    allUnits.forEach(u => {
        if (!safeLayout.some(row => row.includes(u))) safeLayout[0].push(u);
    });

    // group by Unit/SubUnit
    const grouped = {};
    normalized.forEach(item => {
        const { Unit, SubUnit } = item;
        if (!grouped[Unit]) grouped[Unit] = {};
        if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
        grouped[Unit][SubUnit].push(item);
    });

    const nodes = [];
    const edges = [];

    // --- canvas & item geometry ---
    const unitWidth = 4200;
    const unitHeight = 3000;

    const itemWidth = 160;
    const itemHeight = 120;

    // separate gaps
    const itemGapX = 30;   // horizontal gap between items
    const itemGapY = 30;   // vertical gap between items

    // --- 3×3 grid inside each Unit ---
    const GRID_COLS = 3;
    const GRID_ROWS = 3;
    const GRID_GAP = 30;  // gap between sub-cells
    const UNIT_PAD = 10;

    // keep rectangles so we can place first-time items / Unit-changed items
    const subRects = new Map(); // key: `${unit}|||${sub}` -> { baseX, baseY, cellW, cellH }

    // Unit/SubUnit frames as 3×3 grid
    safeLayout.forEach((row, rowIndex) => {
        row.forEach((unitName, colIndex) => {
            const unit = String(unitName || 'No Unit');
            const unitX = colIndex * (unitWidth + 100);
            const unitY = rowIndex * (unitHeight + 100);
            if (!grouped[unit]) return;

            // Unit frame
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

            // 3×3 geometry inside unit
            const innerW = unitWidth - 2 * UNIT_PAD;
            const innerH = unitHeight - 2 * UNIT_PAD;
            const cellW = (innerW - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS;
            const cellH = (innerH - (GRID_ROWS - 1) * GRID_GAP) / GRID_ROWS;

            // stable sub-unit order
            const subUnits = grouped[unit];
            const subKeys = Object.keys(subUnits).sort((a, b) => a.localeCompare(b));

            subKeys.forEach((sub, idx) => {
                const idx9 = idx % (GRID_COLS * GRID_ROWS);
                const rIdx = Math.floor(idx9 / GRID_COLS);
                const cIdx = idx9 % GRID_COLS;

                const subX = unitX + UNIT_PAD + cIdx * (cellW + GRID_GAP);
                const subY = unitY + UNIT_PAD + rIdx * (cellH + GRID_GAP);

                nodes.push({
                    id: `sub-${unit}-${sub}`,
                    position: { x: subX, y: subY },
                    data: { label: sub },
                    style: {
                        width: cellW,
                        height: cellH,
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

                subRects.set(`${unit}|||${sub}`, {
                    baseX: subX + itemGapX,   // (optional) align inner margin with your gap
                    baseY: subY + itemGapY,   // (optional) align inner margin with your gap
                    cellW,
                    cellH,
                });
            });
        });
    });

    // first-time placement counters (per sub-cell) with wrap
    const firstTimeCounters = new Map(); // key -> { col, row, maxCols }
    function nextFirstTimePos(unit, sub) {
        const key = `${unit}|||${sub}`;
        const rect = subRects.get(key);
        const baseX = (rect?.baseX ?? 100);
        const baseY = (rect?.baseY ?? 100);

        // how many items per row can we fit (based on width only)?
        const usableW = (rect?.cellW ?? 600) - 20;
        const maxCols = Math.max(1, Math.floor((usableW + itemGapX) / (itemWidth + itemGapX)));

        const state = firstTimeCounters.get(key) || { col: 0, row: 0, maxCols };
        if (state.maxCols !== maxCols) { state.col = 0; state.row = 0; state.maxCols = maxCols; }

        const x = baseX + state.col * (itemWidth + itemGapX);
        const y = baseY + state.row * (itemHeight + itemGapY);

        // advance cursor
        state.col += 1;
        if (state.col >= state.maxCols) {
            state.col = 0;
            state.row += 1;
        }

        firstTimeCounters.set(key, state);
        return { x, y };
    }

    // Items: preserve position unless Unit changed OR no previous position exists
    safeLayout.forEach(row => {
        row.forEach(unit => {
            if (!grouped[unit]) return;
            const subUnits = grouped[unit];

            Object.entries(subUnits).forEach(([sub, list]) => {
                const sorted = [...list].sort((a, b) => {
                    const s = (a.Sequence || 0) - (b.Sequence || 0);
                    return s !== 0 ? s : String(a.Name || '').localeCompare(String(b.Name || ''));
                });

                sorted.forEach(item => {
                    const id = String(item.id);
                    const hadPrevPos =
                        posCache.has(id) &&
                        Number.isFinite(posCache.get(id)?.x) &&
                        Number.isFinite(posCache.get(id)?.y);

                    let position;
                    if (unitChangedIds.has(id)) {
                        // ✅ Unit changed: re-place into the new Unit/SubUnit cell
                        position = nextFirstTimePos(item.Unit, item.SubUnit);
                    } else if (hadPrevPos) {
                        // ✅ keep previous position no matter what else changed
                        const p = posCache.get(id);
                        position = { x: p.x, y: p.y };
                    } else if (Number.isFinite(item.x) && Number.isFinite(item.y)) {
                        // first build but item already has stored x/y
                        position = { x: Number(item.x), y: Number(item.y) };
                    } else {
                        // first build with no position yet: place inside correct Unit/SubUnit
                        position = nextFirstTimePos(item.Unit, item.SubUnit);
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

    // Edges (Code -> Code)
    const codeToNodeId = new Map();
    nodes.forEach(n => {
        const it = n.data?.item;
        if (it?.Code) codeToNodeId.set(String(it.Code), n.id);
    });

    normalized.forEach(item => {
        const fromId = String(item.id);
        (item.Connections || []).forEach(connCode => {
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
