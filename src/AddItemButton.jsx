import React, { useState, useEffect } from 'react';
import ImageTracer from 'imagetracerjs';
export default function AddItemButton({
    addItem,
    defaultUnit = '',
    defaultSubUnit = '',
    onAdded,
    label = 'Add Item',
}) {
    const [panelOpen, setPanelOpen] = useState(false);
    const [active, setActive] = useState(false);
    const [tool, setTool] = useState('note');     // move | note | line | rect | circle
    const [penWidth, setPenWidth] = useState(2);
    const [color, setColor] = useState('#222');

    // hydrate from canvas (optional)
    useEffect(() => {
        try {
            const s = window.annoControls?.getState?.();
            if (s) {
                setActive(!!s.active);
                setTool(s.tool || 'note');
                setPenWidth(Number(s.width) || 2);
                setColor(s.color || '#222');
            }
        } catch { }
    }, []);

    const handleAdd = async () => {
        if (typeof addItem !== 'function') return;
        const rawItem = {
            Name: 'New Item',
            'Item Code': `CODE-${Date.now()}`,
            Unit: defaultUnit,
            SubUnit: defaultSubUnit,
            'Category Item Type': 'Equipment',
        };
        try {
            const result = addItem(rawItem);
            const added = result instanceof Promise ? await result : result;
            onAdded?.(added || rawItem);
        } catch (err) {
            console.error('[AddItemButton] addItem error', err);
        }
    };
    const fileInputId = 'trace-png-input';
    // shorthands to talk to DiagramCanvas
    const api = () => window.annoControls || {};
    const setAnnoActive = (v) => { api().setActive?.(!!v); setActive(!!v); };
    const setAnnoTool = (t) => {
        api().setTool?.(t);
        setTool(t);
        if (!active) { api().setActive?.(true); setActive(true); } // auto-arm
    };
    const setAnnoWidth = (w) => { api().setWidth?.(w); setPenWidth(w); };
    const setAnnoColor = (c) => { api().setColor?.(c); setColor(c); };

    return (
        <div
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
        >
            {/* Add Item */}
            <button
                onClick={handleAdd}
                style={{
                    padding: '8px 16px',
                    background: '#4CAF50',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                }}
                aria-label={label}
            >
                {label}
            </button>

            {/* divider */}
            <div style={{ width: 1, height: 28, background: '#e4e4e4' }} />

            {/* toggle toolbar */}
            <button
                onClick={() => {
                    setPanelOpen((v) => !v);
                    if (!active) { api().setActive?.(true); setActive(true); }
                }}
                title="Show annotate toolbar"
                style={{
                    padding: '8px 12px',
                    background: '#f5f5f7',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                }}
            >
                {panelOpen ? 'Hide Tools' : 'Annotate Tools'}
            </button>
            {/* Trace PNG → SVG */}
            <button
                onClick={() => document.getElementById(fileInputId)?.click()}
                style={{
                    padding: '8px 12px',
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12
                }}
                title="Import PNG and vectorize to SVG paths"
            >
                Trace PNG → SVG
            </button>
            <input
                id={fileInputId}
                type="file"
                accept="image/png"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = URL.createObjectURL(file);

                    // Reasonable defaults (tune as you like)
                    const opts = {
                        numberofcolors: 2,  // more colors -> more paths
                        pathomit: 8,        // ignore tiny specks
                        ltres: 1, qtres: 1, // curve fitting
                        blurradius: 0, blurdelta: 0
                    };

                    ImageTracer.imageToSVG(url, (svgstr) => {
                        try {
                            const doc = new DOMParser().parseFromString(svgstr, 'image/svg+xml');
                            const root = doc.documentElement;
                            const vb = (root.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
                            let vbW = 0, vbH = 0;
                            if (vb.length === 4) { vbW = vb[2]; vbH = vb[3]; }
                            else {
                                vbW = parseFloat(root.getAttribute('width') || '150');
                                vbH = parseFloat(root.getAttribute('height') || '150');
                            }

                            // Scale to a friendly width on your 2000×1200 canvas coords
                            const targetW = 300;                     // initial width on canvas
                            const scale = Math.max(0.001, targetW / (vbW || 1));
                            const x = 200, y = 150;                  // initial drop position
                            const transform = `translate(${x},${y}) scale(${scale})`;

                            const paths = Array.from(doc.querySelectorAll('path')).map((p) => ({
                                d: p.getAttribute('d') || '',
                                fill: p.getAttribute('fill') || 'none',
                                stroke: p.getAttribute('stroke') || '#222',
                                strokeWidth: parseFloat(p.getAttribute('stroke-width') || '1'),
                            }));

                            if (paths.length) {
                                // hand off to the canvas
                                window.annoControls?.addPaths?.(paths, transform);
                            } else {
                                alert('No vector paths detected. Try increasing numberofcolors or using a simpler PNG.');
                            }
                        } catch (err) {
                            console.error('Vectorize parse failed', err);
                        } finally {
                            URL.revokeObjectURL(url);
                            e.target.value = '';
                        }
                    }, opts);
                }}
            />

            {panelOpen && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        background: 'rgba(255,255,255,0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                    }}
                >
                    <button
                        onClick={() => setAnnoActive(!active)}
                        style={{
                            padding: '6px 10px',
                            background: active ? '#1f2937' : '#1118270d',
                            color: active ? '#fff' : '#111',
                            border: '1px solid #cfd3d8',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                        title="Enable/Disable canvas annotation"
                    >
                        {active ? 'Done' : 'Annotate'}
                    </button>

                    <span style={{ fontSize: 12, opacity: .75 }}>Tool:</span>
                    {['move', 'note', 'line', 'rect', 'circle'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setAnnoTool(t)}
                            disabled={!active}
                            style={{
                                padding: '6px 8px',
                                fontSize: 12,
                                fontWeight: tool === t ? 700 : 400,
                                border: '1px solid #cfd3d8',
                                background: tool === t ? '#e8eefc' : '#fff',
                                borderRadius: 6,
                                cursor: active ? 'pointer' : 'not-allowed',
                                opacity: active ? 1 : 0.6,
                            }}
                            title={t}
                        >
                            {t[0].toUpperCase() + t.slice(1)}
                        </button>
                    ))}

                    <span style={{ fontSize: 12, opacity: .75, marginLeft: 6 }}>Width:</span>
                    <input
                        type="range"
                        min={1}
                        max={12}
                        step={0.5}
                        value={penWidth}
                        onChange={(e) => setAnnoWidth(Number(e.target.value))}
                        disabled={!active}
                        style={{ width: 80 }}
                        title="Stroke width"
                    />
                    <input
                        type="number"
                        min={0.5}
                        max={20}
                        step={0.5}
                        value={penWidth}
                        onChange={(e) => setAnnoWidth(Number(e.target.value || 1))}
                        disabled={!active}
                        style={{ width: 52, fontSize: 12 }}
                    />

                    <span style={{ fontSize: 12, opacity: .75, marginLeft: 6 }}>Color:</span>
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setAnnoColor(e.target.value)}
                        disabled={!active}
                        title="Stroke color"
                    />

                    <button onClick={() => api().undo?.()} disabled={!active} style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #cfd3d8', borderRadius: 6, background: '#fff' }}>
                        Undo
                    </button>
                    <button
                        onClick={() => { if (active && confirm('Clear all annotations?')) api().clear?.(); }}
                        disabled={!active}
                        style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #cfd3d8', borderRadius: 6, background: '#fff', color: '#b00' }}
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => api().deleteSelected?.()}
                        disabled={!active}
                        style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #cfd3d8', borderRadius: 6, background: '#fff' }}
                        title="Delete selected annotation"
                    >
                        Delete Sel
                    </button>
                </div>
            )}
        </div>
    );
}
