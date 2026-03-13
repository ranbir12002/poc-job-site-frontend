import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle, Package, Ruler, Cylinder, BarChart3, FileText, MapPin, Eye, Calendar, User, Hash, IndianRupee, Maximize2 } from 'lucide-react';
import { Pit3DModal } from './Pit3DModal';

// ─── Constants ───────────────────────────────────────────────────────

const PIT_LENGTH_FT = 20, PIT_WIDTH_FT = 5, PIT_DEPTH_FT = 10;
const FT_TO_M = 0.3048;
const PIT_L = PIT_LENGTH_FT * FT_TO_M, PIT_W = PIT_WIDTH_FT * FT_TO_M, PIT_D = PIT_DEPTH_FT * FT_TO_M;
const PIPE_DIA_IN = 6, PIPE_LEN_FT = PIT_LENGTH_FT;
const PIPE_R = (PIPE_DIA_IN / 2) * 0.0254, PIPE_L = PIPE_LEN_FT * FT_TO_M;
const PIPE_VOL = Math.PI * PIPE_R ** 2 * PIPE_L;
const PIT_VOL = PIT_L * PIT_W * PIT_D;
const NET_VOL = PIT_VOL - PIPE_VOL;
const CF = 1.54; // compaction factor
const DRY_VOL = NET_VOL * CF;
const C_PART = 1, S_PART = 1.5, G_PART = 3, SUM = 5.5;
const STONE_FRAC = 0.15;
const STONE_DRY = NET_VOL * STONE_FRAC * CF;
const CONC_DRY = DRY_VOL * (1 - STONE_FRAC);
const D_CEM = 1440, D_SAND = 1600, D_GRAV = 1750, D_STONE = 1500;
const stdCem = (C_PART / SUM) * CONC_DRY * D_CEM;
const stdSand = (S_PART / SUM) * CONC_DRY * D_SAND;
const stdGrav = (G_PART / SUM) * CONC_DRY * D_GRAV;
const stdStone = STONE_DRY * D_STONE;
const THRESHOLD = 0.08;

interface MatRow { name: string; icon: string; stdQty: number; vendorQty: number; unit: string; rate: number; color: string; mixPart: string; }

const MATERIALS: MatRow[] = [
    { name: 'Cement (OPC 43)', icon: '🧱', stdQty: stdCem, vendorQty: Math.round(stdCem * 1.05), unit: 'kg', rate: 8, color: '#94a3b8', mixPart: `${C_PART}` },
    { name: 'River Sand', icon: '🏖️', stdQty: stdSand, vendorQty: Math.round(stdSand * 1.12), unit: 'kg', rate: 2.5, color: '#f59e0b', mixPart: `${S_PART}` },
    { name: 'Gravel (20mm)', icon: '🪨', stdQty: stdGrav, vendorQty: Math.round(stdGrav * 1.07), unit: 'kg', rate: 3, color: '#78716c', mixPart: `${G_PART}` },
    { name: 'Crushed Stone', icon: '⛰️', stdQty: stdStone, vendorQty: Math.round(stdStone * 1.15), unit: 'kg', rate: 2, color: '#a8a29e', mixPart: 'base' },
    { name: 'PVC Pipe (6″)', icon: '🔧', stdQty: 1, vendorQty: 1, unit: 'pc', rate: 450, color: '#3b82f6', mixPart: '—' },
];

// Mock invoice & site data
const INVOICE = {
    number: 'INV-2026-03-0847',
    date: '2026-03-05',
    vendorName: 'Sharma Construction Pvt. Ltd.',
    vendorGST: '07AABCS1234F1Z5',
    siteId: 'SITE-BLR-042',
    siteName: 'JP Nagar Water Pipeline Trench – Sector 7',
    siteAddress: 'JP Nagar 7th Phase, Bangalore, Karnataka 560078',
    siteCoords: { lat: 12.8912, lng: 77.5853 },
    projectName: 'BWSSB Pipeline Replacement – Phase II',
    workOrder: 'WO-2026-0193',
    totalAmount: 0,
    status: 'Under Review' as const,
};

function r2(n: number) { return Math.round(n * 100) / 100; }
function pct(v: number, s: number) { return s === 0 ? 0 : ((v - s) / s) * 100; }
function flagged(v: number, s: number) { return pct(v, s) > THRESHOLD * 100; }

// ─── Map component (lightweight Leaflet embed) ──────────────────────

function SiteMap({ lat, lng }: { lat: number; lng: number }) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);

    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;
        const L = (window as any).L;
        if (!L) return;

        mapInstance.current = L.map(mapRef.current, {
            center: [lat, lng], zoom: 16, zoomControl: false,
            attributionControl: false,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(mapInstance.current);
        L.marker([lat, lng]).addTo(mapInstance.current)
            .bindPopup(`<b>${INVOICE.siteName}</b><br/>${INVOICE.siteAddress}`).openPopup();

        return () => { mapInstance.current?.remove(); mapInstance.current = null; };
    }, [lat, lng]);

    return <div ref={mapRef} className="w-full h-full rounded-xl" style={{ minHeight: 220 }} />;
}

// ─── Tabs ────────────────────────────────────────────────────────────

type Tab = 'overview' | 'invoice' | 'formulas';

// ─── Main Component ─────────────────────────────────────────────────

interface Props { onBack: () => void; }

export function MaterialReconciliation({ onBack }: Props) {
    const [tab, setTab] = useState<Tab>('overview');
    const [show3D, setShow3D] = useState(false);

    const overallFlag = MATERIALS.some(m => m.unit === 'kg' && flagged(m.vendorQty, m.stdQty));
    const totalStd = MATERIALS.filter(m => m.unit === 'kg').reduce((s, m) => s + m.stdQty, 0);
    const totalVen = MATERIALS.filter(m => m.unit === 'kg').reduce((s, m) => s + m.vendorQty, 0);

    // Compute invoice total
    const invoiceTotal = MATERIALS.reduce((s, m) => s + m.vendorQty * m.rate, 0);

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'overview', label: 'Overview', icon: <BarChart3 size={15} /> },
        { id: 'invoice', label: 'Vendor Invoice', icon: <FileText size={15} /> },
        { id: 'formulas', label: 'Formulas', icon: <Hash size={15} /> },
    ];

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            <Pit3DModal open={show3D} onClose={() => setShow3D(false)} pitLengthFt={PIT_LENGTH_FT} pitWidthFt={PIT_WIDTH_FT} pitDepthFt={PIT_DEPTH_FT} />

            {/* Header */}
            <div className="flex items-center gap-4 px-8 py-4 border-b border-white/[0.06]">
                <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"><ArrowLeft size={20} /></button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-semibold text-white/90 tracking-tight">Material Reconciliation</h1>
                    <p className="text-xs text-white/40 mt-0.5 truncate">{INVOICE.siteName} • {INVOICE.projectName}</p>
                </div>
                <button onClick={() => setShow3D(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 rounded-full border border-indigo-500/25 transition-all text-sm font-medium">
                    <Maximize2 size={15} /> 3D View
                </button>
                {overallFlag ? (
                    <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium"><AlertTriangle size={14} /> Excess Usage</span>
                ) : (
                    <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium"><CheckCircle size={14} /> Within Threshold</span>
                )}
            </div>

            {/* Tabs */}
            <div className="px-8 pt-3 flex gap-1 border-b border-white/[0.04]">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-white/[0.05] text-white/90 border-b-2 border-indigo-400' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

                {/* ──────── OVERVIEW TAB ──────── */}
                {tab === 'overview' && (<>
                    {/* Site Info + Map row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Site details */}
                        <div className="lg:col-span-1 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider flex items-center gap-2"><MapPin size={14} /> Site Details</h3>
                            <div className="space-y-2 text-sm">
                                <p className="text-white/80 font-medium">{INVOICE.siteName}</p>
                                <p className="text-white/40">{INVOICE.siteAddress}</p>
                                <div className="flex items-center gap-4 text-xs text-white/40 pt-1">
                                    <span className="flex items-center gap-1"><Hash size={11} />{INVOICE.siteId}</span>
                                    <span className="flex items-center gap-1"><User size={11} />{INVOICE.vendorName}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-white/40">
                                    <span className="flex items-center gap-1"><Calendar size={11} />{INVOICE.date}</span>
                                    <span className="flex items-center gap-1"><FileText size={11} />{INVOICE.workOrder}</span>
                                </div>
                            </div>
                        </div>
                        {/* Map */}
                        <div className="lg:col-span-2 rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden p-1">
                            <SiteMap lat={INVOICE.siteCoords.lat} lng={INVOICE.siteCoords.lng} />
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { l: 'Pit Volume', v: `${r2(PIT_VOL)} m³`, s: `${PIT_LENGTH_FT}×${PIT_WIDTH_FT}×${PIT_DEPTH_FT} ft`, ic: <Ruler size={18} />, g: 'from-blue-500/20 to-blue-600/10' },
                            { l: 'Pipe Volume', v: `${r2(PIPE_VOL)} m³`, s: `${PIPE_DIA_IN}″ × ${PIPE_LEN_FT} ft`, ic: <Cylinder size={18} />, g: 'from-indigo-500/20 to-indigo-600/10' },
                            { l: 'Dry Fill Vol', v: `${r2(DRY_VOL)} m³`, s: `×${CF} compaction`, ic: <Package size={18} />, g: 'from-amber-500/20 to-amber-600/10' },
                            { l: 'Wastage Limit', v: `${THRESHOLD * 100}%`, s: overallFlag ? 'EXCEEDED' : 'All OK', ic: <BarChart3 size={18} />, g: overallFlag ? 'from-red-500/20 to-red-600/10' : 'from-emerald-500/20 to-emerald-600/10' },
                        ].map(c => (
                            <div key={c.l} className={`p-4 rounded-2xl bg-gradient-to-br ${c.g} border border-white/[0.06]`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">{c.l}</p>
                                        <p className="text-xl font-semibold text-white/90 mt-1 font-mono">{c.v}</p>
                                        <p className="text-[10px] text-white/30 mt-0.5">{c.s}</p>
                                    </div>
                                    <div className="p-1.5 bg-white/5 rounded-lg text-white/40">{c.ic}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Mix ratio bar */}
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-wrap gap-5 items-center text-xs text-white/50">
                        <span><b className="text-white/70">Mix:</b> M20</span>
                        <span><b className="text-white/70">Ratio:</b> {C_PART}:{S_PART}:{G_PART}</span>
                        <span><b className="text-white/70">CF:</b> {CF}</span>
                        <span><b className="text-white/70">Stone base:</b> {STONE_FRAC * 100}%</span>
                    </div>

                    {/* Comparison Table */}
                    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-medium text-white/80">Material Usage Comparison</h2>
                                <p className="text-[10px] text-white/30">Standard vs Vendor-reported • {THRESHOLD * 100}% threshold</p>
                            </div>
                            <button onClick={() => setShow3D(true)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"><Eye size={13} /> View 3D</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/[0.06] text-white/40 text-[10px] uppercase tracking-wider">
                                        <th className="text-left px-5 py-2.5 font-medium">Material</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Mix</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Standard</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Vendor</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Diff</th>
                                        <th className="text-right px-3 py-2.5 font-medium">%</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Rate (₹)</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Amount (₹)</th>
                                        <th className="text-center px-3 py-2.5 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MATERIALS.map(m => {
                                        const d = m.vendorQty - m.stdQty;
                                        const dp = pct(m.vendorQty, m.stdQty);
                                        const fl = m.unit === 'kg' && flagged(m.vendorQty, m.stdQty);
                                        const isPipe = m.unit === 'pc';
                                        return (
                                            <tr key={m.name} className={`border-b border-white/[0.04] ${fl ? 'bg-red-500/[0.06]' : 'hover:bg-white/[0.02]'} transition-colors`}>
                                                <td className="px-5 py-3 flex items-center gap-2"><span className="text-base">{m.icon}</span><span className="text-white/80 font-medium">{m.name}</span></td>
                                                <td className="text-right px-3 py-3 text-white/40 font-mono text-xs">{m.mixPart}</td>
                                                <td className="text-right px-3 py-3 text-white/50 font-mono">{isPipe ? `${m.stdQty} pc` : r2(m.stdQty).toLocaleString()}</td>
                                                <td className="text-right px-3 py-3 text-white/80 font-mono font-medium">{isPipe ? `${m.vendorQty} pc` : m.vendorQty.toLocaleString()}</td>
                                                <td className={`text-right px-3 py-3 font-mono ${d > 0 && !isPipe ? 'text-amber-400' : 'text-white/30'}`}>{isPipe ? '—' : (d > 0 ? '+' : '') + r2(d).toLocaleString()}</td>
                                                <td className={`text-right px-3 py-3 font-mono font-medium ${fl ? 'text-red-400' : d > 0 && !isPipe ? 'text-amber-400' : 'text-white/30'}`}>{isPipe ? '—' : (dp > 0 ? '+' : '') + r2(dp) + '%'}</td>
                                                <td className="text-right px-3 py-3 text-white/50 font-mono">₹{m.rate}</td>
                                                <td className="text-right px-3 py-3 text-white/70 font-mono">₹{(m.vendorQty * m.rate).toLocaleString()}</td>
                                                <td className="text-center px-3 py-3">
                                                    {isPipe ? <span className="text-white/20">—</span> : fl ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-medium"><AlertTriangle size={10} /> Over</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium"><CheckCircle size={10} /> OK</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-white/[0.03] font-medium text-sm">
                                        <td className="px-5 py-3 text-white/60" colSpan={2}>Total</td>
                                        <td className="text-right px-3 py-3 text-white/50 font-mono">{r2(totalStd).toLocaleString()}</td>
                                        <td className="text-right px-3 py-3 text-white/80 font-mono">{r2(totalVen).toLocaleString()}</td>
                                        <td className="text-right px-3 py-3 font-mono text-amber-400">+{r2(totalVen - totalStd).toLocaleString()}</td>
                                        <td className={`text-right px-3 py-3 font-mono font-medium ${pct(totalVen, totalStd) > THRESHOLD * 100 ? 'text-red-400' : 'text-amber-400'}`}>+{r2(pct(totalVen, totalStd))}%</td>
                                        <td />
                                        <td className="text-right px-3 py-3 text-white/80 font-mono font-semibold">₹{invoiceTotal.toLocaleString()}</td>
                                        <td />
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Wastage Policy */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/[0.05] to-red-500/[0.05] border border-white/[0.06]">
                        <h3 className="text-sm font-medium text-white/70 flex items-center gap-2 mb-1"><AlertTriangle size={15} className="text-amber-400" /> Wastage Threshold Policy</h3>
                        <p className="text-xs text-white/40 leading-relaxed">
                            <b className="text-white/60">{THRESHOLD * 100}%</b> tolerance allowed per material. <b className="text-white/60">{MATERIALS.filter(m => m.unit === 'kg' && flagged(m.vendorQty, m.stdQty)).length}</b> material(s) flagged.
                        </p>
                    </div>
                </>)}

                {/* ──────── INVOICE TAB ──────── */}
                {tab === 'invoice' && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        {/* Invoice header */}
                        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs text-white/40 uppercase tracking-wider">Vendor Invoice</p>
                                    <h2 className="text-2xl font-semibold text-white/90 mt-1 font-mono">{INVOICE.number}</h2>
                                </div>
                                <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-medium">{INVOICE.status}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-white/40 text-xs">Vendor</p>
                                    <p className="text-white/80 font-medium">{INVOICE.vendorName}</p>
                                    <p className="text-white/40 text-xs mt-0.5">GST: {INVOICE.vendorGST}</p>
                                </div>
                                <div>
                                    <p className="text-white/40 text-xs">Site</p>
                                    <p className="text-white/80 font-medium">{INVOICE.siteName}</p>
                                    <p className="text-white/40 text-xs mt-0.5">WO: {INVOICE.workOrder}</p>
                                </div>
                                <div>
                                    <p className="text-white/40 text-xs">Date</p>
                                    <p className="text-white/80">{INVOICE.date}</p>
                                </div>
                                <div>
                                    <p className="text-white/40 text-xs">Project</p>
                                    <p className="text-white/80">{INVOICE.projectName}</p>
                                </div>
                            </div>
                        </div>

                        {/* Invoice line items */}
                        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                            <div className="px-5 py-3 border-b border-white/[0.06]">
                                <h3 className="text-sm font-medium text-white/70">Line Items</h3>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/[0.06] text-white/40 text-[10px] uppercase tracking-wider">
                                        <th className="text-left px-5 py-2.5 font-medium">#</th>
                                        <th className="text-left px-3 py-2.5 font-medium">Description</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Qty</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Unit</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Rate (₹)</th>
                                        <th className="text-right px-5 py-2.5 font-medium">Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MATERIALS.map((m, i) => (
                                        <tr key={m.name} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                            <td className="px-5 py-3 text-white/30 font-mono text-xs">{i + 1}</td>
                                            <td className="px-3 py-3 text-white/80 flex items-center gap-2"><span>{m.icon}</span>{m.name}</td>
                                            <td className="text-right px-3 py-3 text-white/70 font-mono">{m.vendorQty.toLocaleString()}</td>
                                            <td className="text-right px-3 py-3 text-white/40">{m.unit}</td>
                                            <td className="text-right px-3 py-3 text-white/50 font-mono">₹{m.rate}</td>
                                            <td className="text-right px-5 py-3 text-white/80 font-mono">₹{(m.vendorQty * m.rate).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-white/[0.03]">
                                        <td colSpan={5} className="text-right px-3 py-3 text-white/60 font-medium">Subtotal</td>
                                        <td className="text-right px-5 py-3 text-white/80 font-mono font-semibold">₹{invoiceTotal.toLocaleString()}</td>
                                    </tr>
                                    <tr className="bg-white/[0.03]">
                                        <td colSpan={5} className="text-right px-3 py-2 text-white/40 text-xs">GST (18%)</td>
                                        <td className="text-right px-5 py-2 text-white/50 font-mono text-xs">₹{Math.round(invoiceTotal * 0.18).toLocaleString()}</td>
                                    </tr>
                                    <tr className="bg-white/[0.05]">
                                        <td colSpan={5} className="text-right px-3 py-3 text-white/80 font-semibold text-base">Grand Total</td>
                                        <td className="text-right px-5 py-3 text-white/95 font-mono font-bold text-base flex items-center justify-end gap-1"><IndianRupee size={14} />₹{Math.round(invoiceTotal * 1.18).toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* ──────── FORMULAS TAB ──────── */}
                {tab === 'formulas' && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                            <h2 className="text-base font-medium text-white/80 mb-3">Calculation Methodology</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-white/50 font-mono leading-relaxed">
                                <div className="space-y-1.5">
                                    <p><span className="text-white/70">Pit Vol</span> = {PIT_LENGTH_FT}×{PIT_WIDTH_FT}×{PIT_DEPTH_FT} ft³ = <span className="text-white/70">{r2(PIT_VOL)} m³</span></p>
                                    <p><span className="text-white/70">Pipe Vol</span> = π×{r2(PIPE_R)}²×{r2(PIPE_L)} = <span className="text-white/70">{r2(PIPE_VOL)} m³</span></p>
                                    <p><span className="text-white/70">Net Vol</span> = {r2(PIT_VOL)}−{r2(PIPE_VOL)} = <span className="text-white/70">{r2(NET_VOL)} m³</span></p>
                                    <p><span className="text-white/70">Dry Vol</span> = {r2(NET_VOL)}×{CF} = <span className="text-white/70">{r2(DRY_VOL)} m³</span></p>
                                </div>
                                <div className="space-y-1.5">
                                    <p><span className="text-white/70">Cement</span> = ({C_PART}/{SUM})×{r2(CONC_DRY)}×{D_CEM} = <span className="text-white/70">{r2(stdCem)} kg</span></p>
                                    <p><span className="text-white/70">Sand</span> = ({S_PART}/{SUM})×{r2(CONC_DRY)}×{D_SAND} = <span className="text-white/70">{r2(stdSand)} kg</span></p>
                                    <p><span className="text-white/70">Gravel</span> = ({G_PART}/{SUM})×{r2(CONC_DRY)}×{D_GRAV} = <span className="text-white/70">{r2(stdGrav)} kg</span></p>
                                    <p><span className="text-white/70">Stone</span> = {STONE_FRAC}×{r2(NET_VOL)}×{CF}×{D_STONE} = <span className="text-white/70">{r2(stdStone)} kg</span></p>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                            <h2 className="text-base font-medium text-white/80 mb-2">Density Reference</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                {[{ n: 'Cement', d: D_CEM }, { n: 'Sand', d: D_SAND }, { n: 'Gravel', d: D_GRAV }, { n: 'Stone', d: D_STONE }].map(i => (
                                    <div key={i.n} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                                        <p className="text-white/40">{i.n}</p>
                                        <p className="text-white/70 font-mono font-medium mt-0.5">{i.d} kg/m³</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
