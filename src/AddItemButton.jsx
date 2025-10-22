import React, { useState, useEffect, useRef } from 'react';
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
    const [lineArt, setLineArt] = useState(true);      // keep only black strokes, drop bg
    const [bgTolerance, setBgTolerance] = useState(20);// 0..80 (higher = remove more near-white)
    const [cropEnabled, setCropEnabled] = useState(true);

    // Crop modal state
    const [cropOpen, setCropOpen] = useState(false);
    const [cropSrc, setCropSrc] = useState(null);      // object URL
    const [imgEl, setImgEl] = useState(null);          // HTMLImageElement
    const canvasRef = useRef(null);
    const [viewBox, setViewBox] = useState({ w: 720, h: 440 }); // modal canvas size
    const [imgFit, setImgFit] = useState({ scale: 1, offX: 0, offY: 0, iw: 0, ih: 0 });
    const [dragging, setDragging] = useState(false);
    const [startPt, setStartPt] = useState(null);
    const [rect, setRect] = useState(null);            // { x, y, w, h } in canvas coords

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
    async function preprocessToLineArt(srcUrl, tolerance /* 0..80 */) {
        const img = await loadImage(srcUrl);
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

    // Vectorize + hand off to canvas (dataUrl is PNG)
    async function traceDataUrl(dataUrl) {
        const opts = {
            colorsampling: 0,
            numberofcolors: 2,
            pathomit: 1,
            ltres: 1, qtres: 1,
            blurradius: 0, blurdelta: 0,
        };

        return new Promise((resolve, reject) => {
            ImageTracer.imageToSVG(dataUrl, (svgstr) => {
                try {
                    const doc = new DOMParser().parseFromString(svgstr, 'image/svg+xml');
                    const root = doc.documentElement;

                    const vbAttr = (root.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
                    let vbW = 0, vbH = 0;
                    if (vbAttr.length === 4) {
                        vbW = vbAttr[2]; vbH = vbAttr[3];
                    } else {
                        vbW = parseFloat(root.getAttribute('width') || '150');
                        vbH = parseFloat(root.getAttribute('height') || '150');
                    }

                    const paths = Array.from(doc.querySelectorAll('path')).map((p) => ({
                        d: p.getAttribute('d') || '',
                        fill: 'none',
                        stroke: '#000',
                        strokeWidth: 1.2,
                    })).filter(p => p.d);

                    if (!paths.length) {
                        alert('No vector paths detected. Try lowering BG tolerance or using a crisper PNG.');
                        resolve(false);
                        return;
                    }

                    // Initial drop on canvas
                    const targetW = 320;
                    const scale = Math.max(0.001, targetW / (vbW || 1));
                    const x = 200, y = 150;

                    // Prefer numeric API if available (best for move/scale/hit-test).
                    if (window.annoControls?.addVector) {
                        window.annoControls.addVector({
                            type: 'svg',
                            x, y, scale,
                            vbW, vbH,
                            paths,
                        });
                    } else {
                        // Fallback to string transform API
                        window.annoControls?.addPaths?.(paths, `translate(${x},${y}) scale(${scale})`);
                    }

                    resolve(true);
                } catch (err) {
                    console.error('Vectorize parse failed', err);
                    reject(err);
                }
            }, opts);
        });
    }

    // Main handler when file selected
    async function handleTracePng(file) {
        const objUrl = URL.createObjectURL(file);
        try {
            if (cropEnabled) {
                // open crop modal; pipeline continues from "Apply Crop"
                await openCropper(objUrl);
            } else {
                let src = objUrl;
                if (lineArt) src = await preprocessToLineArt(objUrl, bgTolerance);
                await traceDataUrl(src);
            }
        } finally {
            URL.revokeObjectURL(objUrl);
        }
    }

    // ---------- Cropper ----------
    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const i = new Image();
            i.crossOrigin = 'anonymous';
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = url;
        });
    }

    async function openCropper(objUrl) {
        setCropSrc(objUrl);
        const img = await loadImage(objUrl);
        setImgEl(img);

        // Fit image into the modal canvas
        const vw = viewBox.w, vh = viewBox.h;
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const scale = Math.min(vw / iw, vh / ih);
        const offX = (vw - iw * scale) / 2;
        const offY = (vh - ih * scale) / 2;
        setImgFit({ scale, offX, offY, iw, ih });

        // Default rect: center half
        const defW = Math.round((iw * scale) * 0.6);
        const defH = Math.round((ih * scale) * 0.6);
        const rx = Math.round(offX + (vw - defW) / 2);
        const ry = Math.round(offY + (vh - defH) / 2);
        setRect({ x: rx, y: ry, w: defW, h: defH });

        setCropOpen(true);
        // draw after open
        setTimeout(drawCropCanvas, 0);
    }

    function drawCropCanvas() {
        const canvas = canvasRef.current;
        if (!canvas || !imgEl) return;
        const ctx = canvas.getContext('2d');
        const { w: vw, h: vh } = viewBox;
        const { scale, offX, offY } = imgFit;

        ctx.clearRect(0, 0, vw, vh);
        ctx.save();
        // bg
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, vw, vh);

        // image
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(imgEl, offX, offY, imgEl.naturalWidth * scale, imgEl.naturalHeight * scale);

        // mask
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, 0, vw, vh);

        // crop rect
        if (rect) {
            const { x, y, w, h } = normalizeRect(rect);
            ctx.clearRect(x, y, w, h);

            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
            ctx.setLineDash([]);

            // handles (corners)
            ctx.fillStyle = '#3b82f6';
            const size = 6;
            ctx.fillRect(x - size, y - size, size * 2, size * 2);
            ctx.fillRect(x + w - size, y - size, size * 2, size * 2);
            ctx.fillRect(x - size, y + h - size, size * 2, size * 2);
            ctx.fillRect(x + w - size, y + h - size, size * 2, size * 2);
        }
        ctx.restore();
    }

    function normalizeRect(r) {
        let { x, y, w, h } = r;
        if (w < 0) { x = x + w; w = -w; }
        if (h < 0) { y = y + h; h = -h; }
        return { x, y, w, h };
    }

    function onCropMouseDown(e) {
        if (!cropOpen) return;
        const rectCanvas = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rectCanvas.left;
        const y = e.clientY - rectCanvas.top;
        setDragging(true);
        setStartPt({ x, y });
        setRect({ x, y, w: 0, h: 0 });
    }

    function onCropMouseMove(e) {
        if (!cropOpen || !dragging || !startPt) return;
        const rectCanvas = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rectCanvas.left;
        const y = e.clientY - rectCanvas.top;
        setRect({ x: startPt.x, y: startPt.y, w: x - startPt.x, h: y - startPt.y });
        requestAnimationFrame(drawCropCanvas);
    }

    function onCropMouseUp() {
        setDragging(false);
        requestAnimationFrame(drawCropCanvas);
    }

    async function applyCropAndTrace() {
        if (!imgEl) return;
        const { scale, offX, offY, iw, ih } = imgFit;

        const r = normalizeRect(rect || { x: offX, y: offY, w: iw * scale, h: ih * scale });
        // map canvas rect → image pixels
        let sx = Math.round((r.x - offX) / scale);
        let sy = Math.round((r.y - offY) / scale);
        let sw = Math.round(r.w / scale);
        let sh = Math.round(r.h / scale);

        // clamp
        sx = Math.max(0, Math.min(iw - 1, sx));
        sy = Math.max(0, Math.min(ih - 1, sy));
        if (sx + sw > iw) sw = iw - sx;
        if (sy + sh > ih) sh = ih - sy;
        if (sw <= 1 || sh <= 1) { // fallback full
            sx = 0; sy = 0; sw = iw; sh = ih;
        }

        // crop to dataURL
        const c = document.createElement('canvas');
        c.width = sw; c.height = sh;
        const cx = c.getContext('2d');
        cx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, sw, sh);
        let src = c.toDataURL('image/png');

        // line-art preprocess (optional)
        if (lineArt) {
            src = await preprocessToLineArt(src, bgTolerance);
        }

        await traceDataUrl(src);

        // close modal
        setCropOpen(false);
        setRect(null);
        setImgEl(null);
        setCropSrc(null);
    }

    function cancelCrop() {
        setCropOpen(false);
        setRect(null);
        setImgEl(null);
        // proceed without crop if you want; here we just close
    }

    // redraw when state changes
    useEffect(() => { if (cropOpen) drawCropCanvas(); }, [cropOpen, rect, imgEl, imgFit, viewBox]);

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
                title="Import PNG and (optionally crop) → vectorize to SVG paths"
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

            {/* crop toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={cropEnabled} onChange={(e) => setCropEnabled(e.target.checked)} />
                Crop before trace
            </label>

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

            {/* -------- Crop Modal -------- */}
            {cropOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.25)', padding: 16, width: viewBox.w + 32 }}>
                        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong>Crop image</strong>
                            <div style={{ fontSize: 12, color: '#666' }}>Drag to select area · Enter to apply · Esc to cancel</div>
                        </div>

                        <canvas
                            ref={canvasRef}
                            width={viewBox.w}
                            height={viewBox.h}
                            style={{ width: '100%', height: viewBox.h, borderRadius: 8, cursor: dragging ? 'crosshair' : 'crosshair', background: '#f8fafc' }}
                            onMouseDown={onCropMouseDown}
                            onMouseMove={onCropMouseMove}
                            onMouseUp={onCropMouseUp}
                            onMouseLeave={onCropMouseUp}
                            onDoubleClick={applyCropAndTrace}
                        />

                        <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => { setRect(null); drawCropCanvas(); }} style={{ padding: '8px 12px' }}>Reset</button>
                            <button onClick={cancelCrop} style={{ padding: '8px 12px' }}>Cancel</button>
                            <button onClick={applyCropAndTrace} style={{ padding: '8px 12px', background: '#111', color: '#fff', borderRadius: 6 }}>Apply Crop</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
