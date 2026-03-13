import React, { useState, useRef, useCallback } from 'react';
import { X, RotateCcw, Maximize2 } from 'lucide-react';

interface Pit3DModalProps {
    open: boolean;
    onClose: () => void;
    pitLengthFt: number;
    pitWidthFt: number;
    pitDepthFt: number;
}

const Face = ({ w, h, t, bg, label }: { w: number, h: number, t: string, bg: string, label?: React.ReactNode }) => (
    <div style={{
        position: 'absolute',
        width: w, height: h,
        marginLeft: -w / 2, marginTop: -h / 2,
        transform: t,
        background: bg,
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backfaceVisibility: 'hidden',
    }}>
        {label && <span className="font-bold text-white text-sm drop-shadow-md text-center">{label}</span>}
    </div>
);

const Box3D = ({ w, h, d, x = 0, y = 0, z = 0, color, topLabel = '', showTop = true, showBottom = true }: any) => (
    <div style={{
        position: 'absolute', transformStyle: 'preserve-3d',
        transform: `translate3d(${x}px, ${y}px, ${z}px)`
    }}>
        <Face w={w} h={h} t={`translateZ(${d / 2}px)`} bg={color} />
        <Face w={w} h={h} t={`translateZ(${-d / 2}px) rotateY(180deg)`} bg={color} />
        <Face w={d} h={h} t={`translateX(${-w / 2}px) rotateY(-90deg)`} bg={color} />
        <Face w={d} h={h} t={`translateX(${w / 2}px) rotateY(90deg)`} bg={color} />
        {showTop && <Face w={w} h={d} t={`translateY(${-h / 2}px) rotateX(90deg)`} bg={color} label={topLabel} />}
        {showBottom && <Face w={w} h={d} t={`translateY(${h / 2}px) rotateX(-90deg)`} bg={color} />}
    </div>
);

export function Pit3DModal({ open, onClose, pitLengthFt, pitWidthFt, pitDepthFt }: Pit3DModalProps) {
    const [rotation, setRotation] = useState({ x: -25, y: -35 });
    const dragging = useRef(false);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging.current) return;
        setRotation(prev => ({
            x: Math.max(-85, Math.min(85, prev.x - e.movementY * 0.6)),
            y: prev.y + e.movementX * 0.6,
        }));
    }, []);

    const handlePointerUp = useCallback(() => { dragging.current = false; }, []);

    if (!open) return null;

    const s = 18;
    const pl = pitLengthFt * s, pw = pitWidthFt * s, pd = pitDepthFt * s;

    // The layers from bottom to top
    const layers = [
        { frac: 0.15, color: '#a8a29e', label: 'Crushed\nStone' },
        { frac: 0.30, color: '#78716c', label: 'Gravel\n(20mm)' },
        { frac: 0.30, color: '#f59e0b', label: 'River\nSand' },
        { frac: 0.25, color: '#94a3b8', label: 'Cement Mix' },
    ];

    let currentY = pd / 2; // starts at bottom of pit

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={onClose}>
            <div className="relative w-[90vw] max-w-[1000px] h-[85vh] bg-[#050505]/95 border border-white/[0.08] rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <Maximize2 size={18} className="text-white/40" />
                        <h2 className="text-lg font-semibold text-white/90">3D Pit Visualisation</h2>
                        <span className="text-xs text-indigo-400 font-medium px-2 py-0.5 bg-indigo-500/10 rounded-full">Fully Interactive GPU 3D Render</span>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 relative overflow-hidden flex items-center justify-center select-none"
                    onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
                    <div style={{ perspective: '1200px', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ transformStyle: 'preserve-3d', transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`, transition: dragging.current ? 'none' : 'transform 0.1s ease-out' }}>

                            {/* Pit Container Walls (Transparent Glassmorphism) */}
                            <Box3D w={pl} h={pd} d={pw} color="rgba(120, 113, 108, 0.15)" showTop={false} />

                            {/* Material Layers (Slightly opaque so we can see the pipe inside!) */}
                            {layers.map((layer, idx) => {
                                const h = pd * layer.frac;
                                const yPos = currentY - h / 2;
                                currentY -= h;

                                return <Box3D key={idx} w={pl - 2} h={h - 1} d={pw - 2} y={yPos} color={`${layer.color}cc`} topLabel={<span className="whitespace-pre-wrap">{layer.label}</span>} />;
                            })}

                            {/* PVC Pipe */}
                            <Box3D w={pl + 20} h={12} d={12} y={pd / 2 - pd * 0.12} color="#3b82f6e6" topLabel="" />

                            {/* Floor Plan Indicator */}
                            <div style={{ position: 'absolute', width: pl, height: pw, marginLeft: -pl / 2, marginTop: -pw / 2, transform: `translateY(${pd / 2 + 2}px) rotateX(-90deg)`, border: '2px dashed rgba(255,255,255,0.2)' }} />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-3 border-t border-white/[0.06] flex items-center justify-between">
                    <div className="flex flex-wrap gap-4">
                        {[{ c: '#94a3b8', l: 'Cement Mix' }, { c: '#f59e0b', l: 'River Sand' }, { c: '#78716c', l: 'Gravel' }, { c: '#a8a29e', l: 'Crushed Stone' }, { c: '#3b82f6', l: 'PVC Pipe' }].map(i => (
                            <div key={i.l} className="flex items-center gap-1.5 text-xs text-white/50">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: i.c }} />{i.l}
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-white/30 text-xs"><RotateCcw size={12} /> Click & drag to freely rotate 360°</div>
                </div>
            </div>
        </div>
    );
}
