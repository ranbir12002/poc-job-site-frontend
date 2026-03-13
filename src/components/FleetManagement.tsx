import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Truck, Activity, Thermometer, MapPin, Search, Filter, AlertTriangle, CheckCircle, Clock, Calendar, BarChart2, Zap, Settings, ShieldAlert, X } from 'lucide-react';
import L from 'leaflet';

// ─── Interfaces & Mock Data ──────────────────────────────────────────

type Status = 'Active' | 'Idle' | 'Maintenance' | 'Offline';

interface Telemetry {
    fuelLevel: number;        // %
    engineTemp: number;       // °C
    operatingHours: number;   // hrs
    batteryVolt: number;      // V
    lastPing: string;
    alerts: string[];
}

interface Machine {
    id: string;
    name: string;
    type: string;
    siteId: string;
    siteName: string;
    status: Status;
    coords: { lat: number, lng: number };
    telemetry: Telemetry;
    history: { time: string, temp: number, fuel: number }[];
}

const SITES = [
    { id: 'S-01', name: 'JP Nagar Phase II', coords: { lat: 12.8912, lng: 77.5853 } },
    { id: 'S-02', name: 'Hebbal Flyover Extension', coords: { lat: 13.0354, lng: 77.5971 } },
    { id: 'S-03', name: 'Whitefield Metro Depot', coords: { lat: 12.9698, lng: 77.7500 } },
];

function generateHistory() {
    const points = [];
    let temp = 70 + Math.random() * 20;
    let fuel = 80 + Math.random() * 10;
    for (let i = 24; i >= 0; i--) {
        points.push({
            time: `${i}h ago`,
            temp: temp + (Math.random() * 5 - 2.5),
            fuel: fuel - (Math.random() * 0.5)
        });
        temp += (Math.random() * 5 - 2.5);
        fuel -= (Math.random() * 0.5 + 0.1);
    }
    return points;
}

const MOCK_MACHINERY: Machine[] = [
    {
        id: 'EXC-001', name: 'Volvo EC200D', type: 'Excavator', siteId: 'S-01', siteName: 'JP Nagar Phase II', status: 'Active', coords: { lat: 12.8915, lng: 77.5850 },
        telemetry: { fuelLevel: 45, engineTemp: 88, operatingHours: 4250, batteryVolt: 24.2, lastPing: '2 mins ago', alerts: [] }, history: generateHistory()
    },
    {
        id: 'EXC-002', name: 'CAT 320', type: 'Excavator', siteId: 'S-02', siteName: 'Hebbal Flyover', status: 'Idle', coords: { lat: 13.0350, lng: 77.5975 },
        telemetry: { fuelLevel: 78, engineTemp: 65, operatingHours: 3100, batteryVolt: 24.5, lastPing: '15 mins ago', alerts: [] }, history: generateHistory()
    },
    {
        id: 'DMP-014', name: 'Tata Signa 4825.TK', type: 'Dump Truck', siteId: 'S-01', siteName: 'JP Nagar Phase II', status: 'Active', coords: { lat: 12.8910, lng: 77.5862 },
        telemetry: { fuelLevel: 22, engineTemp: 92, operatingHours: 1850, batteryVolt: 23.8, lastPing: '1 min ago', alerts: ['Low Fuel Warning'] }, history: generateHistory()
    },
    {
        id: 'CRN-005', name: 'Liebherr LTM 1120', type: 'Mobile Crane', siteId: 'S-03', siteName: 'Whitefield Metro Depot', status: 'Active', coords: { lat: 12.9702, lng: 77.7505 },
        telemetry: { fuelLevel: 65, engineTemp: 82, operatingHours: 5600, batteryVolt: 24.1, lastPing: '5 mins ago', alerts: [] }, history: generateHistory()
    },
    {
        id: 'DZR-008', name: 'Komatsu D155A', type: 'Bulldozer', siteId: 'S-02', siteName: 'Hebbal Flyover', status: 'Maintenance', coords: { lat: 13.0361, lng: 77.5968 },
        telemetry: { fuelLevel: 15, engineTemp: 105, operatingHours: 6200, batteryVolt: 22.1, lastPing: '2 hrs ago', alerts: ['Engine Overheat', 'Hydraulic Pressure Low'] }, history: generateHistory()
    },
    {
        id: 'BHO-003', name: 'JCB 3DX', type: 'Backhoe', siteId: 'S-01', siteName: 'JP Nagar Phase II', status: 'Active', coords: { lat: 12.8920, lng: 77.5845 },
        telemetry: { fuelLevel: 55, engineTemp: 85, operatingHours: 2100, batteryVolt: 24.4, lastPing: 'Just now', alerts: [] }, history: generateHistory()
    },
    {
        id: 'GRD-002', name: 'CAT 140K', type: 'Motor Grader', siteId: 'S-03', siteName: 'Whitefield Metro Depot', status: 'Offline', coords: { lat: 12.9690, lng: 77.7490 },
        telemetry: { fuelLevel: 0, engineTemp: 25, operatingHours: 4800, batteryVolt: 0.0, lastPing: '3 days ago', alerts: ['GPS Signal Lost'] }, history: generateHistory()
    },
];

const STATUS_COLORS: Record<Status, string> = {
    'Active': 'bg-emerald-500 text-emerald-100 border-emerald-500/50',
    'Idle': 'bg-amber-500 text-amber-100 border-amber-500/50',
    'Maintenance': 'bg-red-500 text-red-100 border-red-500/50',
    'Offline': 'bg-slate-500 text-slate-100 border-slate-500/50',
};

// ─── Sub-components ──────────────────────────────────────────────────

function TelemetryRing({ value, max, colorClass, icon: Icon, label, unit }: any) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    const r = 20, c = Math.PI * (r * 2);
    const dashoffset = c - (pct / 100) * c;
    return (
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="relative flex items-center justify-center w-[54px] h-[54px]">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                    <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="4" className={colorClass} strokeDasharray={c} strokeDashoffset={dashoffset} strokeLinecap="round" />
                </svg>
                <div className={`absolute inset-0 flex items-center justify-center ${colorClass}`}>
                    <Icon size={16} />
                </div>
            </div>
            <div className="text-center">
                <div className="text-sm font-semibold text-white/90">{Math.round(value)}{unit}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-wide">{label}</div>
            </div>
        </div>
    );
}

function MachinePanel({ machine, onClose }: { machine: Machine, onClose: () => void }) {
    if (!machine) return null;
    return (
        <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#0a0a0f]/95 backdrop-blur-2xl border-l border-white/[0.08] shadow-2xl flex flex-col animate-in slide-in-from-right z-50">
            <div className="p-5 border-b border-white/[0.06] flex items-start justify-between bg-white/[0.01]">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[machine.status]}`}>
                            {machine.status}
                        </span>
                        <span className="text-xs text-white/40"><Clock size={10} className="inline mr-1" />{machine.telemetry.lastPing}</span>
                    </div>
                    <h2 className="text-xl font-semibold text-white/90">{machine.id}</h2>
                    <p className="text-sm text-white/50">{machine.name} • {machine.type}</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all">
                    <X size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {machine.telemetry.alerts.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 space-y-2">
                        <h3 className="text-xs font-semibold text-red-400 uppercase flex items-center gap-1.5"><ShieldAlert size={14} /> Active Alerts</h3>
                        {machine.telemetry.alerts.map((a, i) => (
                            <div key={i} className="text-sm text-red-300/90 flex items-start gap-2">
                                <span className="mt-1 w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" /> {a}
                            </div>
                        ))}
                    </div>
                )}

                <div>
                    <h3 className="text-xs font-semibold text-white/40 uppercase mb-3 px-1">Live Telemetry</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <TelemetryRing value={machine.telemetry.fuelLevel} max={100} colorClass={machine.telemetry.fuelLevel < 25 ? "text-red-400" : "text-emerald-400"} icon={Zap} label="Fuel Level" unit="%" />
                        <TelemetryRing value={machine.telemetry.engineTemp} max={120} colorClass={machine.telemetry.engineTemp > 95 ? "text-red-400" : "text-amber-400"} icon={Thermometer} label="Engine Temp" unit="°C" />
                        <TelemetryRing value={machine.telemetry.operatingHours} max={10000} colorClass="text-blue-400" icon={Clock} label="Run Time" unit="h" />
                        <TelemetryRing value={machine.telemetry.batteryVolt} max={28} colorClass={machine.telemetry.batteryVolt < 22 ? "text-red-400" : "text-indigo-400"} icon={Activity} label="Battery" unit="V" />
                    </div>
                </div>

                <div>
                    <h3 className="text-xs font-semibold text-white/40 uppercase mb-3 px-1 flex items-center justify-between">
                        <span>24h Trend</span>
                        <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded">Engine Temp (°C)</span>
                    </h3>
                    <div className="h-32 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-end gap-1">
                        {machine.history.map((h, i) => {
                            const hPct = ((h.temp - 60) / 60) * 100;
                            return (
                                <div key={i} className="relative flex-1 group h-full flex items-end justify-center">
                                    <div
                                        className={`w-full max-w-[8px] rounded-t-sm transition-all duration-300 group-hover:bg-indigo-400 ${h.temp > 95 ? 'bg-red-400/80 shadow-[0_0_8px_rgba(248,113,113,0.4)]' : 'bg-white/20'}`}
                                        style={{ height: `${Math.max(5, Math.min(100, hPct))}%` }}
                                    />
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 border border-white/10 shadow-xl">
                                        {Math.round(h.temp)}°C<br /><span className="text-white/40">{h.time}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <h3 className="text-xs font-semibold text-white/40 uppercase mb-3 px-1">Location</h3>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-start gap-3">
                        <div className="p-2.5 bg-white/5 rounded-lg text-white/50"><MapPin size={18} /></div>
                        <div>
                            <p className="text-sm text-white/80 font-medium">{machine.siteName}</p>
                            <p className="text-xs text-white/40 mt-1 font-mono">{machine.coords.lat.toFixed(5)}, {machine.coords.lng.toFixed(5)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Fleet Management Component ─────────────────────────────────

type Tab = 'board' | 'map' | 'site';

export function FleetManagement({ onBack }: { onBack: () => void }) {
    const [tab, setTab] = useState<Tab>('board');
    const [search, setSearch] = useState('');
    const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);

    const filtered = MOCK_MACHINERY.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.id.toLowerCase().includes(search.toLowerCase()) ||
        m.type.toLowerCase().includes(search.toLowerCase())
    );

    const selectedMachine = MOCK_MACHINERY.find(m => m.id === selectedMachineId) || null;

    // -- Map Initialization effect --
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);

    useEffect(() => {
        if (tab !== 'map' || !mapRef.current) return;

        // Initialize map once
        if (!mapInstance.current) {
            mapInstance.current = L.map(mapRef.current, { center: [12.9716, 77.5946], zoom: 11, zoomControl: false });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(mapInstance.current);
            L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
        }

        // Clear old markers
        mapInstance.current.eachLayer(layer => {
            if (layer instanceof L.Marker) layer.remove();
        });

        // Add new markers
        filtered.forEach(m => {
            const color = m.status === 'Active' ? '#10b981' : m.status === 'Idle' ? '#f59e0b' : m.status === 'Maintenance' ? '#ef4444' : '#64748b';
            const iconHtml = `<div class="w-8 h-8 rounded-full border-2 border-white/20 shadow-lg flex items-center justify-center font-bold text-white text-[10px]" style="background-color: ${color}">${m.type[0]}</div>`;
            const divIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });

            const marker = L.marker([m.coords.lat, m.coords.lng], { icon: divIcon }).addTo(mapInstance.current!);
            marker.bindPopup(`<b style="color:#000">${m.id}</b><br><span style="color:#666">${m.name}<br>${m.siteName}</span>`);
            marker.on('click', () => setSelectedMachineId(m.id));
        });

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [tab, filtered]);


    return (
        <div className="flex flex-col h-full w-full bg-[#050505] text-slate-100 font-sans overflow-hidden relative selection:bg-white/20">

            {/* Header */}
            <div className="flex items-center gap-4 px-6 md:px-8 py-5 border-b border-white/[0.06] bg-black/40 backdrop-blur-md z-10">
                <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-white/20">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-semibold text-white/90 tracking-tight flex items-center gap-2">
                        <Truck size={24} className="text-indigo-400" />
                        Fleet Management
                    </h1>
                    <p className="text-sm text-white/40 mt-0.5">Heavy machinery tracking & IoT telemetry</p>
                </div>

                <div className="ml-auto flex items-center gap-3">
                    <div className="relative hidden md:block">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                            type="text"
                            placeholder="Search machinery..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-64 bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/50 focus:bg-white/10 transition-all"
                        />
                    </div>
                    <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-all border border-transparent hover:border-white/10">
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 md:px-8 pt-4 flex gap-2 border-b border-white/[0.04] bg-black/20 z-10">
                {[
                    { id: 'board', label: 'Board View', icon: <BarChart2 size={16} /> },
                    { id: 'map', label: 'Live Tracking Map', icon: <MapPin size={16} /> },
                    { id: 'site', label: 'Allocation by Site', icon: <Calendar size={16} /> },
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id as Tab)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-white/[0.05] text-white/90 border-b-2 border-indigo-400' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'}`}
                    >
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative overflow-hidden bg-white/[0.01]">

                {/* Board View */}
                {tab === 'board' && (
                    <div className="absolute inset-0 overflow-x-auto overflow-y-hidden p-6 md:p-8">
                        <div className="flex gap-6 h-full min-w-max">
                            {['Active', 'Idle', 'Maintenance'].map(statusLabel => {
                                const colMachinery = filtered.filter(m => m.status === statusLabel);
                                return (
                                    <div key={statusLabel} className="w-[320px] flex flex-col h-full bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-4 px-1">
                                            <h3 className="font-semibold text-white/80">{statusLabel}</h3>
                                            <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs text-white/50">{colMachinery.length}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
                                            {colMachinery.map(m => (
                                                <div
                                                    key={m.id}
                                                    onClick={() => setSelectedMachineId(m.id)}
                                                    className="p-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-indigo-400/30 rounded-xl cursor-pointer transition-all group"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <div className="text-sm font-semibold text-white/90 group-hover:text-indigo-300 transition-colors">{m.id}</div>
                                                            <div className="text-xs text-white/40">{m.name}</div>
                                                        </div>
                                                        {m.telemetry.alerts.length > 0 && <AlertTriangle size={14} className="text-red-400" />}
                                                    </div>

                                                    <div className="text-xs text-white/50 mb-3 flex items-center gap-1.5 line-clamp-1"><MapPin size={12} />{m.siteName}</div>

                                                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.04]">
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                            <Zap size={12} className={m.telemetry.fuelLevel < 25 ? "text-red-400" : "text-emerald-400"} />
                                                            <span className="text-white/70">{m.telemetry.fuelLevel}%</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                            <Thermometer size={12} className={m.telemetry.engineTemp > 95 ? "text-red-400" : "text-amber-400"} />
                                                            <span className="text-white/70">{m.telemetry.engineTemp}°C</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Map View */}
                {tab === 'map' && (
                    <div className="absolute inset-0">
                        <div ref={mapRef} className="w-full h-full z-0" />
                        {/* Map overlay metrics */}
                        <div className="absolute top-6 left-6 z-10 flex flex-col gap-3 pointer-events-none">
                            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl pointer-events-auto">
                                <h3 className="text-xs font-semibold uppercase text-white/40 tracking-wider mb-3">Live Fleet Status</h3>
                                <div className="flex gap-4">
                                    <div className="text-center"><div className="text-xl font-mono text-emerald-400">{filtered.filter(m => m.status === 'Active').length}</div><div className="text-[10px] text-white/50">Active</div></div>
                                    <div className="text-center"><div className="text-xl font-mono text-amber-400">{filtered.filter(m => m.status === 'Idle').length}</div><div className="text-[10px] text-white/50">Idle</div></div>
                                    <div className="text-center"><div className="text-xl font-mono text-red-400">{filtered.filter(m => m.status === 'Maintenance').length}</div><div className="text-[10px] text-white/50">Maint</div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Site Allocation View */}
                {tab === 'site' && (
                    <div className="absolute inset-0 overflow-y-auto p-6 md:p-8 space-y-6">
                        {SITES.map(site => {
                            const siteMachinery = filtered.filter(m => m.siteId === site.id);
                            if (siteMachinery.length === 0) return null;

                            const activeCount = siteMachinery.filter(m => m.status === 'Active').length;
                            const utilPct = Math.round((activeCount / siteMachinery.length) * 100);

                            return (
                                <div key={site.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                                    <div className="px-6 py-4 border-b border-white/[0.04] bg-white/[0.01] flex flex-wrap gap-4 items-center justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold text-white/90 flex items-center gap-2"><MapPin size={18} className="text-indigo-400" /> {site.name}</h2>
                                            <p className="text-xs text-white/40 mt-1">{site.id} • {siteMachinery.length} assets assigned</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-sm font-semibold text-white/80">{utilPct}% Usage</div>
                                                <div className="text-[10px] text-white/40 uppercase">Site Utilisation</div>
                                            </div>
                                            <div className="w-12 h-12 relative flex justify-center items-center">
                                                <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#818cf8" strokeWidth="3" strokeDasharray={`${utilPct}, 100`} />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.04]">
                                                    <th className="px-4 py-2 text-left font-medium">Asset ID</th>
                                                    <th className="px-4 py-2 text-left font-medium">Type</th>
                                                    <th className="px-4 py-2 text-left font-medium">Status</th>
                                                    <th className="px-4 py-2 text-right font-medium">Fuel</th>
                                                    <th className="px-4 py-2 text-right font-medium">Run Hrs</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {siteMachinery.map(m => (
                                                    <tr key={m.id} onClick={() => setSelectedMachineId(m.id)} className="border-b border-white/[0.02] hover:bg-white/[0.03] transition-colors cursor-pointer group">
                                                        <td className="px-4 py-3 font-semibold text-white/80 group-hover:text-indigo-300">{m.id}</td>
                                                        <td className="px-4 py-3 text-white/60">{m.type} <span className="text-white/30 text-xs ml-1 block xl:inline">({m.name})</span></td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[m.status]}`}>{m.status}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-white/60">
                                                            <span className={m.telemetry.fuelLevel < 25 ? "text-red-400" : ""}>{Math.round(m.telemetry.fuelLevel)}%</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-white/60">{m.telemetry.operatingHours.toLocaleString()}h</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

            </div>

            {/* Side Panel Overlay */}
            {selectedMachine && (
                <MachinePanel machine={selectedMachine} onClose={() => setSelectedMachineId(null)} />
            )}

        </div>
    );
}
