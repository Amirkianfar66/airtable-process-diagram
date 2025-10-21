// src/components/AddItemButton.jsx
import React, { useState, useEffect } from 'react';

export default function AddItemButton({
    addItem,
    defaultUnit = '',
    defaultSubUnit = '',
    onAdded, // optional callback fired after item is added
    label = 'Add Item',
}) {
    const [panelOpen, setPanelOpen] = useState(false);
    const [active, setActive] = useState(false);           // canvas annotate on/off
    const [tool, setTool] = useState('note');              // move | note | line | rect | circle
    const [penWidth, setPenWidth] = useState(2);
    const [color, setColor] = useState('#222');

    // if DiagramCanvas exposes getState, sync UI on mount
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
        console.log('[AddItemButton] clicked. addItem prop:', addItem);

        if (typeof addItem !== 'function') {
            console.error('[AddItemButton] addItem is not a function - cannot add item');
            return;
        }

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

            console.log('[AddItemButton] addItem resolved:', added);

            if (typeof onAdded === 'function') {
                try { onAdded(added || rawItem); } catch (err) { console.warn('onAdded callback threw:', err); }
            }
        } catch (err) {
            console.error('[AddItemButton] addItem threw an error:', err);
        }
    };

    // helpers to call DiagramCanvas global controls safely
    const anno = () => window.annoControls || {};
    const setAnnoActive = (v) => { anno().setActive?.(!!v); setActive(!!v); };
    const setAnnoTool = (t) => { anno().setTool?.(t); setTool(t); };
    const setAnnoWidth = (w) => { anno().setWidth?.(w); setPenWidth(w); };
    const setAnnoColor = (c) => { anno().setColor?.(c); setColor(c); };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px',
                background: 'transparent',
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
        >
            {/* Existing Add Item button */}
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

            {/* Divider */}
            <div style={{ width: 1, height: 28, background: '#e4e4e4' }} />

            {/* Annotate compact toggle */}
            <button
                onClick={() => setPanelOpen((v) => !v)}
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

            {/* Inline toolbar (appears when expanded) */}
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
                    {/* Global annotate toggle */}
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

                    {/* Tool buttons */}
                    <span style={{ fontSize: 12, opacity: 0.7 }}>Tool:</span>
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
                            title={t[0].toUpperCase() + t.slice(1)}
                        >
                            {t[0].toUpperCase() + t.slice(1)}
                        </button>
                    ))}

                    {/* Width */}
                    <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 6 }}>Width:</span>
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

                    {/* Color */}
                    <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 6 }}>Color:</span>
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setAnnoColor(e.target.value)}
                        disabled={!active}
                        title="Stroke color"
                    />

                    {/* Actions */}
                    <button
                        onClick={() => anno().undo?.()}
                        disabled={!active}
                        style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #cfd3d8', borderRadius: 6, background: '#fff' }}
                    >
                        Undo
                    </button>
                    <button
                        onClick={() => {
                            if (!active) return;
                            if (confirm('Clear all annotations?')) anno().clear?.();
                        }}
                        disabled={!active}
                        style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #cfd3d8', borderRadius: 6, background: '#fff', color: '#b00' }}
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => anno().deleteSelected?.()}
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
