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

    // PNG → line-art controls
    const [lineArt, setLineArt] = useState(true);    // keep only black strokes, drop bg
    const [bgTolerance, setBgTolerance] = useState(20); // 0..80 (higher = remove more light pixels)

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

    // --- PNG preprocessing: drop near-white to transparent, keep the rest pure black ---
    async function preprocessToLineArt(blobUrl, tolerance /* 0..80 */) {
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.crossOrigin = 'anonymous';
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = blobUrl;
        });

        const w = img.naturalWidth, h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;

        // Map tolerance (0..80) → luminance threshold (255..55). Higher tol removes more.
        const thr = Math.max(0, Math.min(255, Math.round(255 - tolerance * 2.5)));

        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
            // Perceived luminance (sRGB approx)
            const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            if (a < 8 || Y >= thr) {
                // near-white: make transparent
                d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 0;
            } else {
                // keep as solid black
                d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/png'); // data URL safe for ImageTracer
    }

    // Vectorize + hand off to canvas
    async function handleTracePng(file) {
        // Build source URL: either original object URL or preprocessed data URL
        const objUrl = URL.createObjectURL(file);

        let srcUrl = objUrl;
        try {
            if (lineArt) {
                srcUrl = await preprocessToLineArt(objUrl, bgTolerance);
            }

            // Vectorize with tight settings (we already reduced colors to black/transparent)
            const opts = {
                colorsampling: 0,      // use numberofcolors exactly
                numberofcolors: 2,     // black + (maybe) leftover artifact
                pathomit: 1,           // ignore tiny specks
                ltres: 1, qtres: 1,    // curve fitting
                blurradius: 0, blurdelta: 0,
            };

            ImageTracer.imageToSVG(srcUrl, (svgstr) => {
                try {
                    const doc = new DOMParser().parseFromString(svgstr, 'image/svg+xml');
                    const root = doc.documentElement;

                    // Vector bounds
                    const vbAttr = (root.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
                    let vbW = 0, vbH = 0;
                    if (vbAttr.length === 4) {
                        vbW = vbAttr[2]; vbH = vbAttr[3];
                    } else {
                        vbW = parseFloat(root.getAttribute('width') || '150');
                        vbH = parseFloat(root.getAttribute('height') || '150');
                    }

                    // Extract paths and force line-art styling: no fill, black stroke
                    const paths = Array.from(doc.querySelectorAll('path')).map((p) => ({
                        d: p.getAttribute('d') || '',
                        fill: 'none',                // <- drop fills so background doesn’t reappear
                        stroke: '#000',              // <- unify to black lines
                        strokeWidth: 1.2,            // tweakable
                    })).filter(p => p.d);          // keep only valid paths

                    if (!paths.length) {
                        alert('No vector paths detected. Try lowering BG tolerance or using a crisper PNG.');
                        return;
                    }

                    // Initial drop on canvas
                    const targetW = 320;
                    const scale = Math.max(0.001, targetW / (vbW || 1));
                    const x = 200, y = 150;

                    // Use the numeric addPaths → stored as { type:'svg', x,y,scale, paths }
                    window.annoControls?.addPaths?.(paths, `translate(${x},${y}) scale(${scale})`);

                    // auto-activate annotate + Move tool is handled inside addPaths()
                } catch (err) {
                    console.error('Vectorize parse failed', err);
                }
            }, opts);
        } finally {
        }
    }

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
                onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                        await handleTracePng(file);
                    } catch (err) {
                        console.error('Trace PNG failed', err);
                    } finally {
                        e.target.value = '';
                    }
                }}
            />

            {/* line-art controls */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginLeft: 6 }}>
                <input type="checkbox" checked={lineArt} onChange={(e) => setLineArt(e.target.checked)} />
                Line-art (drop bg)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, opacity: .75 }}>BG tol:</span>
                <input
                    type="range"
                    min={0}
                    max={80}
                    step={1}
                    value={bgTolerance}
                    onChange={(e) => setBgTolerance(Number(e.target.value))}
                    style={{ width: 100 }}
                    title="Higher removes more near-white"
                />
                <span style={{ fontSize: 12, width: 24, textAlign: 'right' }}>{bgTolerance}</span>
            </div>

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

                    {/* scale controls for selected vector/shape */}
                    <button
                        onClick={() => api().scaleSelected?.(1.2)}
                        disabled={!active}
                        style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #cfd3d8', borderRadius: 6, background: '#fff' }}
                        title="Scale up selected"
                    >
                        Scale +
                    </button>
                    <button
                        onClick={() => api().scaleSelected?.(1 / 1.2)}
                        disabled={!active}
                        style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #cfd3d8', borderRadius: 6, background: '#fff' }}
                        title="Scale down selected"
                    >
                        Scale −
                    </button>
                </div>
            )}
        </div>
    );
}
