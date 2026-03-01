import React, { useState, useMemo } from 'react';
import { ArrowLeft, Box, Truck, Home, MapPin, CheckCircle, Search, Settings, Plus, ArrowRight, Map, Columns, AlertTriangle, Clock } from 'lucide-react';
import { Project, Pipe, PipeStage, PipeEvent, LocationLog } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';
import { PipeMapCanvas } from './PipeMapCanvas';

interface PipeInventoryProps {
    project: Project;
    onBack: () => void;
    onUpdateProject: (updatedProject: Project) => void;
}

const STAGE_CONFIG = [
    { id: PipeStage.PORT, title: 'Port', icon: Box, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: PipeStage.TRANSIT, title: 'In Transit (Port→WH)', icon: Truck, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { id: PipeStage.WAREHOUSE, title: 'Warehouse', icon: Home, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
    { id: PipeStage.TRANSIT_2, title: 'In Transit (WH→Site)', icon: Truck, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { id: PipeStage.STAGING, title: 'Staging Area', icon: MapPin, color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10' },
    { id: PipeStage.INSTALLED, title: 'Installed (Laid)', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { id: PipeStage.MISSING, title: 'Missing / Damaged', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
];

export function PipeInventory({ project, onBack, onUpdateProject }: PipeInventoryProps) {
    const pipes = project.pipes || [];

    const [viewMode, setViewMode] = useState<'kanban' | 'map'>('kanban');
    const [activePhaseFilter, setActivePhaseFilter] = useState<string>('ALL');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [selectedPipe, setSelectedPipe] = useState<Pipe | null>(null);

    // Import Form State
    const [importCount, setImportCount] = useState<number | ''>('');
    const [importMaterial, setImportMaterial] = useState('Steel');
    const [importLength, setImportLength] = useState<number | ''>('');
    const [importRadius, setImportRadius] = useState<number | ''>('');
    const [importShippedBy, setImportShippedBy] = useState('');

    // Move Form State
    const [moveFromStage, setMoveFromStage] = useState<PipeStage>(PipeStage.PORT);
    const [moveToStage, setMoveToStage] = useState<PipeStage>(PipeStage.TRANSIT);
    const [moveCount, setMoveCount] = useState<number | ''>('');
    const [moveVehicle, setMoveVehicle] = useState('');
    const [moveApprovedBy, setMoveApprovedBy] = useState('');

    // Calculate top-level metrics
    const totalPipes = pipes.length;
    const totalLength = pipes.reduce((acc, p) => acc + p.length, 0);
    const installedPipes = pipes.filter(p => p.stage === PipeStage.INSTALLED);
    const totalInstalledLength = installedPipes.reduce((acc, p) => acc + p.length, 0);

    const getPipesByStage = (stage: PipeStage) => pipes.filter(p => p.stage === stage);

    const handleImport = () => {
        if (!importCount || !importLength || !importRadius) return;

        const newPipes: Pipe[] = Array.from({ length: Number(importCount) }).map(() => ({
            id: uuidv4(),
            rfid: `RFID-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            material: importMaterial,
            length: Number(importLength),
            radius: Number(importRadius),
            stage: PipeStage.PORT,
            shippedBy: importShippedBy || undefined,
            updatedAt: Date.now(),
            eventHistory: [{
                id: uuidv4(),
                stage: PipeStage.PORT,
                timestamp: Date.now(),
                notes: `Imported to Shipyard. Shipped by: ${importShippedBy || 'Unknown'}`
            }]
        }));

        onUpdateProject({
            ...project,
            pipes: [...pipes, ...newPipes]
        });

        setIsImportModalOpen(false);
        // Reset form
        setImportCount(''); setImportLength(''); setImportRadius(''); setImportShippedBy('');
    };

    const handleMove = () => {
        if (!moveCount) return;
        const countToMove = Number(moveCount);
        const availablePipes = getPipesByStage(moveFromStage);

        if (countToMove > availablePipes.length) {
            alert(`Cannot move ${countToMove} pipes. Only ${availablePipes.length} available in ${moveFromStage}.`);
            return;
        }

        // Select the first 'countToMove' pipes from the source stage
        const pipesToMoveIds = new Set(availablePipes.slice(0, countToMove).map(p => p.id));

        const updatedPipes = pipes.map(p => {
            if (pipesToMoveIds.has(p.id)) {
                const newEvent: PipeEvent = {
                    id: uuidv4(),
                    stage: moveToStage,
                    timestamp: Date.now(),
                    vehicleNumber: moveVehicle || undefined,
                    notes: moveApprovedBy ? `Approved by ${moveApprovedBy}` : undefined
                };

                return {
                    ...p,
                    stage: moveToStage,
                    vehicleNumber: moveVehicle || p.vehicleNumber,
                    approvedBy: moveApprovedBy || p.approvedBy,
                    updatedAt: Date.now(),
                    eventHistory: [...p.eventHistory, newEvent]
                };
            }
            return p;
        });

        onUpdateProject({
            ...project,
            pipes: updatedPipes
        });

        setIsMoveModalOpen(false);
        setMoveCount(''); setMoveVehicle(''); setMoveApprovedBy('');
    };

    const handleGenerateMockScenario = () => {
        const mockPipes: Pipe[] = [];
        const baseTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

        const generateLocationLogs = (start: [number, number], end: [number, number], startTime: number): LocationLog[] => {
            const dist = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)) * 111000;
            const numPoints = Math.max(2, Math.floor(dist / 50));
            const logs: LocationLog[] = [];
            const durationMs = 4 * 60 * 60 * 1000;
            const timeStep = durationMs / numPoints;
            for (let i = 1; i <= Math.min(numPoints, 200); i++) { // cap points to not freeze browser mock data
                const ratio = i / numPoints;
                const lat = start[0] + (end[0] - start[0]) * ratio;
                const lng = start[1] + (end[1] - start[1]) * ratio;
                logs.push({ lat, lng, timestamp: startTime + (i * timeStep) });
            }
            return logs;
        };

        const createHistory = (stages: { s: PipeStage, d: number, v?: string }[]): PipeEvent[] => {
            return stages.map(st => {
                const timestamp = baseTime + (st.d * 24 * 60 * 60 * 1000);
                let locationLogs: LocationLog[] | undefined;

                if (st.s === PipeStage.TRANSIT) {
                    locationLogs = generateLocationLogs([25.7617, -80.1918], [26.0112, -80.1495], timestamp);
                } else if (st.s === PipeStage.TRANSIT_2) {
                    locationLogs = generateLocationLogs([26.0112, -80.1495], [26.1224, -80.1373], timestamp);
                }

                return {
                    id: uuidv4(),
                    stage: st.s,
                    timestamp,
                    vehicleNumber: st.v,
                    notes: 'System generated mock event',
                    locationLogs
                };
            });
        };

        // 40 in Warehouse
        for (let i = 0; i < 40; i++) {
            mockPipes.push({
                id: uuidv4(), rfid: `RFID-WH-${Math.floor(Math.random() * 9000) + 1000}`, material: 'Steel', length: 10, radius: 24, stage: PipeStage.WAREHOUSE, updatedAt: Date.now(),
                eventHistory: createHistory([{ s: PipeStage.PORT, d: 0 }, { s: PipeStage.TRANSIT, d: 1, v: 'TRK-100' }, { s: PipeStage.WAREHOUSE, d: 3 }])
            });
        }
        // 30 in Transit 2
        for (let i = 0; i < 30; i++) {
            mockPipes.push({
                id: uuidv4(), rfid: `RFID-TR2-${Math.floor(Math.random() * 9000) + 1000}`, material: 'Steel', length: 10, radius: 24, stage: PipeStage.TRANSIT_2, vehicleNumber: 'TRK-5542', updatedAt: Date.now(),
                eventHistory: createHistory([{ s: PipeStage.PORT, d: 0 }, { s: PipeStage.TRANSIT, d: 1, v: 'TRK-100' }, { s: PipeStage.WAREHOUSE, d: 3 }, { s: PipeStage.TRANSIT_2, d: 5, v: 'TRK-5542' }])
            });
        }
        // 25 Installed
        for (let i = 0; i < 25; i++) {
            mockPipes.push({
                id: uuidv4(), rfid: `RFID-IN-${i}`, material: 'Steel', length: 10, radius: 24, stage: PipeStage.INSTALLED, updatedAt: Date.now(),
                eventHistory: createHistory([{ s: PipeStage.PORT, d: 0 }, { s: PipeStage.TRANSIT, d: 1, v: 'TRK-100' }, { s: PipeStage.WAREHOUSE, d: 3 }, { s: PipeStage.TRANSIT_2, d: 5, v: 'TRK-4422' }, { s: PipeStage.STAGING, d: 6 }, { s: PipeStage.INSTALLED, d: 7 }])
            });
        }
        // 5 Missing
        for (let i = 0; i < 5; i++) {
            mockPipes.push({
                id: uuidv4(), rfid: `RFID-MISS-${Math.floor(Math.random() * 9000) + 1000}`, material: 'Steel', length: 10, radius: 24, stage: PipeStage.MISSING, updatedAt: Date.now(),
                eventHistory: createHistory([{ s: PipeStage.PORT, d: 0 }, { s: PipeStage.TRANSIT, d: 1, v: 'TRK-100' }, { s: PipeStage.MISSING, d: 2 }])
            });
        }

        onUpdateProject({
            ...project,
            pipes: mockPipes
        });
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 p-8 pb-4 shrink-0">
                <button
                    onClick={onBack}
                    className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-md border border-white/10 transition-all shadow-lg"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white/90">Pipe Inventory</h1>
                    <p className="text-white/50 text-sm mt-1">{project.name} Lifecycle Tracking</p>
                </div>
                <div className="flex-1" />

                <div className="flex gap-3">
                    <button
                        onClick={handleGenerateMockScenario}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl backdrop-blur-md border border-emerald-500/20 transition-all shadow-lg text-sm font-medium"
                    >
                        Load 100 Mock Pipes
                    </button>
                    <div className="w-px h-8 bg-white/10 mx-2 self-center"></div>
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 shadow-inner">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={cn("p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm", viewMode === 'kanban' ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5")}
                        >
                            <Columns size={16} /> Kanban
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={cn("p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm", viewMode === 'map' ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5")}
                        >
                            <Map size={16} /> Map
                        </button>
                    </div>

                    {viewMode === 'map' && (
                        <>
                            <div className="w-px h-8 bg-white/10 mx-2 self-center"></div>
                            <select
                                value={activePhaseFilter}
                                onChange={(e) => setActivePhaseFilter(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none min-w-[140px]"
                            >
                                <option value="ALL">All Phases</option>
                                <option value="PORT">Port</option>
                                <option value="TRANSIT">In Transit</option>
                                <option value="WAREHOUSE">Warehouse</option>
                                <option value="STAGING">Staging Area</option>
                                <option value="INSTALLED">Installed</option>
                            </select>
                        </>
                    )}

                    <div className="w-px h-8 bg-white/10 mx-2 self-center"></div>
                    <button
                        onClick={() => setIsMoveModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl backdrop-blur-md border border-indigo-500/20 transition-all shadow-lg text-sm font-medium"
                    >
                        <ArrowRight size={18} />
                        Move Batch
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md border border-white/10 transition-all shadow-lg text-sm font-medium"
                    >
                        <Plus size={18} />
                        Import (Port)
                    </button>
                </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-4 gap-4 px-8 mb-6 shrink-0">
                <div className="p-5 bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-white/50 text-xs font-medium uppercase tracking-wider">Total Pipes</p>
                        <p className="text-2xl font-semibold text-white mt-1">{totalPipes}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl text-white/70"><Box size={24} /></div>
                </div>
                <div className="p-5 bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-white/50 text-xs font-medium uppercase tracking-wider">Total Length</p>
                        <p className="text-2xl font-semibold text-white mt-1">{totalLength.toLocaleString()} <span className="text-sm text-white/50">m</span></p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl text-white/70"><Settings size={24} /></div>
                </div>
                <div className="p-5 bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-white/50 text-xs font-medium uppercase tracking-wider">Pipes Laid</p>
                        <p className="text-2xl font-semibold text-emerald-400 mt-1">{installedPipes.length}</p>
                    </div>
                    <div className="p-3 bg-emerald-400/10 rounded-xl text-emerald-400"><CheckCircle size={24} /></div>
                </div>
                <div className="p-5 bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-white/50 text-xs font-medium uppercase tracking-wider">Length Laid</p>
                        <p className="text-2xl font-semibold text-emerald-400 mt-1">{totalInstalledLength.toLocaleString()} <span className="text-sm text-emerald-400/50">m</span></p>
                    </div>
                    <div className="p-3 bg-emerald-400/10 rounded-xl text-emerald-400"><CheckCircle size={24} /></div>
                </div>
            </div>

            {/* Kanban Board OR Map View */}
            {viewMode === 'kanban' ? (
                <div className="flex-1 overflow-x-auto overflow-y-hidden px-8 pb-8">
                    <div className="flex gap-6 h-full min-w-max">
                        {STAGE_CONFIG.map((stage) => {
                            const stagePipes = getPipesByStage(stage.id);
                            const stageLength = stagePipes.reduce((acc, p) => acc + p.length, 0);

                            return (
                                <div key={stage.id} className="w-[320px] h-full flex flex-col bg-black/20 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shrink-0">
                                    {/* Column Header */}
                                    <div className="p-5 border-b border-white/5 bg-white/[0.02]">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={cn("p-2 rounded-lg", stage.bg, stage.color)}>
                                                <stage.icon size={18} />
                                            </div>
                                            <h3 className="font-semibold text-white/90">{stage.title}</h3>
                                            <span className="ml-auto bg-white/10 text-white/70 text-xs font-bold px-2.5 py-1 rounded-full">
                                                {stagePipes.length}
                                            </span>
                                        </div>
                                        <div className="text-xs text-white/50 flex justify-between">
                                            <span>Total Length:</span>
                                            <span className="font-mono text-white/70">{stageLength.toLocaleString()} m</span>
                                        </div>
                                    </div>

                                    {/* Column Body - Virtualized/List of tags */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                        {stagePipes.slice(0, 50).map(pipe => (
                                            <div
                                                key={pipe.id}
                                                onClick={() => setSelectedPipe(pipe)}
                                                className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-colors cursor-pointer group"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="text-sm font-mono text-white/90 bg-black/40 px-2 py-1 rounded-md">{pipe.rfid}</span>
                                                    <span className="text-xs text-white/40">{new Date(pipe.updatedAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
                                                    <div><span className="text-white/40">Mat:</span> {pipe.material}</div>
                                                    <div><span className="text-white/40">Len:</span> {pipe.length}m</div>
                                                    <div><span className="text-white/40">Rad:</span> {pipe.radius}"</div>
                                                    {pipe.vehicleNumber && <div><span className="text-white/40">Veh:</span> {pipe.vehicleNumber}</div>}
                                                </div>
                                            </div>
                                        ))}
                                        {stagePipes.length > 50 && (
                                            <div className="text-center text-xs text-white/40 py-2">
                                                + {stagePipes.length - 50} more pipes...
                                            </div>
                                        )}
                                        {stagePipes.length === 0 && (
                                            <div className="h-32 flex items-center justify-center text-white/20 text-sm border-2 border-dashed border-white/5 rounded-2xl">
                                                Empty
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="flex-1 px-8 pb-8 flex flex-col items-end gap-4 relative">
                    <div className="flex-1 w-full h-full relative">
                        <PipeMapCanvas
                            warehouseCount={getPipesByStage(PipeStage.WAREHOUSE).length}
                            transitCount={getPipesByStage(PipeStage.TRANSIT).length}
                            transit2Count={getPipesByStage(PipeStage.TRANSIT_2).length}
                            installedPipes={installedPipes}
                            activePhaseFilter={activePhaseFilter}
                        />
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
                        <h2 className="text-2xl font-semibold text-white mb-6">Import Pipes to Port</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-white/50 uppercase mb-1">Quantity</label>
                                <input type="number" value={importCount} onChange={e => setImportCount(Number(e.target.value))} placeholder="e.g. 100" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-white/50 uppercase mb-1">Length (m)</label>
                                    <input type="number" value={importLength} onChange={e => setImportLength(Number(e.target.value))} placeholder="e.g. 12" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-white/50 uppercase mb-1">Radius (in)</label>
                                    <input type="number" value={importRadius} onChange={e => setImportRadius(Number(e.target.value))} placeholder="e.g. 24" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-white/50 uppercase mb-1">Shipped By (Optional)</label>
                                <input type="text" value={importShippedBy} onChange={e => setImportShippedBy(e.target.value)} placeholder="e.g. Maersk" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button onClick={() => setIsImportModalOpen(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors font-medium">Cancel</button>
                            <button onClick={handleImport} className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors font-medium shadow-lg shadow-indigo-500/20">Import Batch</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Move Batch Modal */}
            {isMoveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
                        <h2 className="text-2xl font-semibold text-white mb-6">Move Pipe Batch</h2>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-white/50 uppercase mb-1">From Stage</label>
                                    <select value={moveFromStage} onChange={e => setMoveFromStage(e.target.value as PipeStage)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none">
                                        {STAGE_CONFIG.map(s => <option key={s.id} value={s.id} className="bg-[#111]">{s.title}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-white/50 uppercase mb-1">To Stage</label>
                                    <select value={moveToStage} onChange={e => setMoveToStage(e.target.value as PipeStage)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none">
                                        {STAGE_CONFIG.map(s => <option key={s.id} value={s.id} className="bg-[#111]">{s.title}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-white/50 uppercase mb-1">Quantity to Move</label>
                                <input type="number" value={moveCount} onChange={e => setMoveCount(Number(e.target.value))} placeholder="e.g. 30" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                <p className="text-xs text-white/30 mt-1.5">Max available: {getPipesByStage(moveFromStage).length}</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-white/50 uppercase mb-1">Vehicle/Carrier Number</label>
                                <input type="text" value={moveVehicle} onChange={e => setMoveVehicle(e.target.value)} placeholder="e.g. TRK-9921" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-white/50 uppercase mb-1">Approved By</label>
                                <input type="text" value={moveApprovedBy} onChange={e => setMoveApprovedBy(e.target.value)} placeholder="e.g. John Doe" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button onClick={() => setIsMoveModalOpen(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors font-medium">Cancel</button>
                            <button onClick={handleMove} className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors font-medium shadow-lg shadow-indigo-500/20">Confirm Move</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Pipe Tracking Details Modal (Amazon Style) */}
            {selectedPipe && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl relative flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-start mb-6 shrink-0">
                            <div>
                                <h2 className="text-2xl font-semibold text-white">Tracking Details</h2>
                                <p className="text-white/50 font-mono text-sm mt-1">{selectedPipe.rfid}</p>
                            </div>
                            <button onClick={() => setSelectedPipe(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                                <Plus size={20} className="rotate-45" />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 p-4 bg-white/[0.02] rounded-2xl border border-white/5 mb-6 shrink-0 text-center">
                            <div>
                                <p className="text-xs text-white/40 mb-1">Material</p>
                                <p className="text-sm font-medium text-white">{selectedPipe.material}</p>
                            </div>
                            <div className="border-l border-r border-white/5">
                                <p className="text-xs text-white/40 mb-1">Length</p>
                                <p className="text-sm font-medium text-white">{selectedPipe.length}m</p>
                            </div>
                            <div>
                                <p className="text-xs text-white/40 mb-1">Radius</p>
                                <p className="text-sm font-medium text-white">{selectedPipe.radius}"</p>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-6 relative mb-6">
                            {/* Vertical Line */}
                            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-white/10 rounded-full z-0"></div>

                            {[...selectedPipe.eventHistory].sort((a, b) => b.timestamp - a.timestamp).map((event, idx) => {
                                const isLatest = idx === 0;
                                const stageInfo = STAGE_CONFIG.find(s => s.id === event.stage);
                                const Icon = stageInfo?.icon || Box;

                                return (
                                    <div key={event.id} className="relative z-10 flex gap-4 animate-in slide-in-from-right-4 fade-in" style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}>
                                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-[#111] shadow-lg", isLatest ? (stageInfo?.bg + ' ' + stageInfo?.color) : "bg-white/5 text-white/40")}>
                                            <Icon size={16} />
                                        </div>
                                        <div className={cn("flex-1 pt-1", isLatest ? "opacity-100" : "opacity-60")}>
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className={cn("font-medium", isLatest ? "text-white" : "text-white/80")}>
                                                    {stageInfo?.title || event.stage}
                                                </h4>
                                                <div className="text-right">
                                                    <p className="text-xs text-white/60">{new Date(event.timestamp).toLocaleDateString()}</p>
                                                    <p className="text-[10px] text-white/40">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </div>
                                            {event.vehicleNumber && (
                                                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><Truck size={12} /> {event.vehicleNumber}</p>
                                            )}
                                            {event.notes && (
                                                <p className="text-xs text-white/40 mt-1.5 italic">"{event.notes}"</p>
                                            )}
                                            {event.locationLogs && event.locationLogs.length > 0 && (
                                                <div className="mt-3 bg-black/40 rounded-lg p-2 max-h-32 overflow-y-auto custom-scrollbar border border-white/5">
                                                    <div className="text-[10px] text-white/40 mb-1 flex justify-between font-mono uppercase tracking-wider">
                                                        <span>Transit GPS Logs ({event.locationLogs.length})</span>
                                                        <span>~50m interval</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {event.locationLogs.map((log, lidx) => (
                                                            <div key={lidx} className="flex justify-between items-center text-[10px] font-mono">
                                                                <span className="text-white/60">
                                                                    {log.lat.toFixed(5)}, {log.lng.toFixed(5)}
                                                                </span>
                                                                <span className="text-emerald-400/80">
                                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Actions */}
                        <div className="shrink-0 space-y-3">
                            {selectedPipe.stage !== PipeStage.MISSING && (
                                <button
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to flag this pipe as missing or damaged? It will be removed from your active lifecycle stats.')) {
                                            const updatedPipes = pipes.map(p => {
                                                if (p.id === selectedPipe.id) {
                                                    const newEvent: PipeEvent = { id: uuidv4(), stage: PipeStage.MISSING, timestamp: Date.now(), notes: 'Flagged as Missing/Damaged by User' };
                                                    return { ...p, stage: PipeStage.MISSING, updatedAt: Date.now(), eventHistory: [...p.eventHistory, newEvent] };
                                                }
                                                return p;
                                            });
                                            onUpdateProject({ ...project, pipes: updatedPipes });
                                            setSelectedPipe(null);
                                        }
                                    }}
                                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                                >
                                    <AlertTriangle size={18} />
                                    Mark as Missing / Damaged
                                </button>
                            )}
                            <button onClick={() => setSelectedPipe(null)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors font-medium">
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
