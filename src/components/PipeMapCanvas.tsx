import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import mapStyle from '../map-style.json';
import { Pipe } from '../types';

// Coordinates for the mock route
export const MOCK_PORT = [25.7617, -80.1918] as [number, number]; // Miami Port
export const MOCK_WAREHOUSE = [26.0112, -80.1495] as [number, number]; // Hollywood Warehouse
export const MOCK_SITE = [26.1224, -80.1373] as [number, number]; // Fort Lauderdale Site

// The physical path where pipes are being installed (30 pipes * 10m = ~300m)
export const LAID_PIPES_PATH: [number, number][] = [
    MOCK_SITE,
    [26.1235, -80.1373],
    [26.1245, -80.1380],
    [26.1250, -80.1390]
];

// Icons
const portIcon = L.divIcon({
    html: `<div class="w-8 h-8 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold">P</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
});

const warehouseIcon = L.divIcon({
    html: `<div class="w-8 h-8 bg-indigo-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold">W</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
});

const siteIcon = L.divIcon({
    html: `<div class="w-8 h-8 bg-fuchsia-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold">S</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
});

const truckIcon = L.divIcon({
    html: `<div class="w-8 h-8 bg-amber-500 rounded-lg border-2 border-white shadow-lg flex items-center justify-center text-white font-bold">🚚</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
});

interface PipeMapCanvasProps {
    warehouseCount: number;
    transitCount: number;
    transit2Count: number;
    installedPipes: Pipe[];
    activePhaseFilter: string;
}

// Helper to interpolate N points evenly along a path
function interpolatePoints(path: [number, number][], numPoints: number): [number, number][] {
    if (path.length < 2 || numPoints <= 0) return [];
    if (numPoints === 1) return [path[0]];

    // 1. Calculate total length of path in generic units
    const segments = [];
    let totalDist = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        const dist = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
        segments.push({ p1, p2, dist });
        totalDist += dist;
    }

    // 2. Find points at evenly spaced distances
    const points: [number, number][] = [];
    const step = totalDist / (numPoints - 1); // Note: numPoints-1 ensures we hit the start and end

    let currentSegmentIdx = 0;
    let distanceCoveredInSegment = 0;

    for (let i = 0; i < numPoints; i++) {
        if (i === 0) {
            points.push(path[0]);
            continue;
        }
        if (i === numPoints - 1) {
            points.push(path[path.length - 1]);
            continue;
        }

        const targetDist = i * step;

        // Find the right segment
        let accumDist = 0;
        let segment = segments[0];

        for (let j = 0; j < segments.length; j++) {
            const nextAccum = accumDist + segments[j].dist;
            if (targetDist <= nextAccum + 0.000001) { // Floating point tolerance
                segment = segments[j];
                distanceCoveredInSegment = targetDist - accumDist;
                break;
            }
            accumDist = nextAccum;
        }

        // Interpolate along the segment
        const ratio = segment.dist === 0 ? 0 : distanceCoveredInSegment / segment.dist;
        const lat = segment.p1[0] + (segment.p2[0] - segment.p1[0]) * ratio;
        const lng = segment.p1[1] + (segment.p2[1] - segment.p1[1]) * ratio;

        points.push([lat, lng]);
    }

    return points;
}

export function PipeMapCanvas({ warehouseCount, transitCount, transit2Count, installedPipes, activePhaseFilter }: PipeMapCanvasProps) {
    const [truckPos, setTruckPos] = useState<[number, number]>(MOCK_PORT);
    const [truck2Pos, setTruck2Pos] = useState<[number, number]>(MOCK_WAREHOUSE);
    const installedCount = installedPipes.length;

    // Calculate interpolated points for individual pipes
    const pipeCoordinates = React.useMemo(() => {
        return interpolatePoints(LAID_PIPES_PATH, installedCount);
    }, [installedCount]);

    // Animate the truck moving from Port to Warehouse every 50 meters (mock logic)
    useEffect(() => {
        if (transitCount === 0) return;

        let progress = 0;
        const interval = setInterval(() => {
            progress += 0.05;
            if (progress > 1) progress = 0; // Loop the truck route for demo purposes

            const lat = MOCK_PORT[0] + (MOCK_WAREHOUSE[0] - MOCK_PORT[0]) * progress;
            const lng = MOCK_PORT[1] + (MOCK_WAREHOUSE[1] - MOCK_PORT[1]) * progress;

            setTruckPos([lat, lng]);
        }, 1000); // Update position every 1s

        return () => clearInterval(interval);
    }, [transitCount]);

    // Animate second truck moving from Warehouse to Site
    useEffect(() => {
        if (transit2Count === 0) return;

        let progress = 0;
        const interval = setInterval(() => {
            progress += 0.05;
            if (progress > 1) progress = 0;

            const lat = MOCK_WAREHOUSE[0] + (MOCK_SITE[0] - MOCK_WAREHOUSE[0]) * progress;
            const lng = MOCK_WAREHOUSE[1] + (MOCK_SITE[1] - MOCK_WAREHOUSE[1]) * progress;

            setTruck2Pos([lat, lng]);
        }, 1200); // Slightly different speed

        return () => clearInterval(interval);
    }, [transit2Count]);

    return (
        <div className="h-full w-full rounded-3xl overflow-hidden bg-black/20 border border-white/5 relative">
            <MapContainer
                center={MOCK_WAREHOUSE}
                zoom={11}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
            >
                <TileLayer
                    attribution={mapStyle.tileLayer.attribution}
                    url={mapStyle.tileLayer.url}
                    maxZoom={mapStyle.tileLayer.maxZoom}
                />

                {/* Transit Route Paths (Dashed) */}
                {(activePhaseFilter === 'ALL' || activePhaseFilter === 'TRANSIT') && (
                    <Polyline positions={[MOCK_PORT, MOCK_WAREHOUSE]} color="#f59e0b" weight={3} dashArray="5, 10" opacity={0.5} />
                )}
                {(activePhaseFilter === 'ALL' || activePhaseFilter === 'TRANSIT_2') && (
                    <Polyline positions={[MOCK_WAREHOUSE, MOCK_SITE]} color="#f97316" weight={3} dashArray="5, 10" opacity={0.5} />
                )}

                {/* Installed Pipes Path (Solid Green Base) */}
                {(activePhaseFilter === 'ALL' || activePhaseFilter === 'INSTALLED') && installedCount > 0 && (
                    <Polyline positions={LAID_PIPES_PATH} color="#10b981" weight={8} opacity={0.5} />
                )}

                {/* Individual Installed Pipes */}
                {(activePhaseFilter === 'ALL' || activePhaseFilter === 'INSTALLED') && installedPipes.map((pipe, idx) => {
                    const pos = pipeCoordinates[idx];
                    if (!pos) return null;

                    return (
                        <Marker
                            key={pipe.id}
                            position={pos}
                            icon={L.divIcon({
                                html: `<div class="w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#111] shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>`,
                                className: '',
                                iconSize: [12, 12],
                                iconAnchor: [6, 6]
                            })}
                        >
                            <Tooltip direction="top" offset={[0, -6]}>
                                <div className="p-1 min-w-[160px]">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <strong className="text-emerald-600 font-mono text-xs">{pipe.rfid}</strong>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                                        <div>Material: <span className="font-medium text-gray-900">{pipe.material}</span></div>
                                        <div>Length: <span className="font-medium text-gray-900">{pipe.length}m</span></div>
                                        <div>Radius: <span className="font-medium text-gray-900">{pipe.radius}"</span></div>
                                        <div>Stage: <span className="font-medium text-gray-900">Laid</span></div>
                                    </div>
                                </div>
                            </Tooltip>
                        </Marker>
                    );
                })}

                {/* Port Marker */}
                {(activePhaseFilter === 'ALL' || activePhaseFilter === 'PORT') && (
                    <Marker position={MOCK_PORT} icon={portIcon}>
                        <Tooltip>
                            <strong>Shipyard / Port</strong><br />
                            Origin of incoming pipes.
                        </Tooltip>
                    </Marker>
                )}

                {/* Warehouse Marker */}
                {(activePhaseFilter === 'ALL' || activePhaseFilter === 'WAREHOUSE') && (
                    <Marker position={MOCK_WAREHOUSE} icon={warehouseIcon}>
                        <Tooltip>
                            <div className="p-1">
                                <strong className="text-indigo-600">Central Warehouse</strong>
                                <p className="mt-1">Inventory: <strong>{warehouseCount}</strong> pipes</p>
                            </div>
                        </Tooltip>
                    </Marker>
                )}

                {/* Staging Site Marker */}
                {(activePhaseFilter === 'ALL' || activePhaseFilter === 'STAGING') && (
                    <Marker position={MOCK_SITE} icon={siteIcon}>
                        <Tooltip>
                            <strong>Staging Area</strong><br />
                            Final inspection before installation.
                        </Tooltip>
                    </Marker>
                )}

                {/* Animated Truck for Transit 1 */}
                {(activePhaseFilter === 'ALL' || activePhaseFilter === 'TRANSIT') && transitCount > 0 && (
                    <Marker position={truckPos} icon={truckIcon}>
                        <Tooltip permanent={false} direction="top">
                            <div className="p-1 min-w-[150px]">
                                <strong className="text-amber-600 mb-1 block">In Transit (Port→WH)</strong>
                                <div className="text-sm text-gray-700">
                                    <p>Moving: <strong>{transitCount}</strong> pipes</p>
                                    <p className="text-xs mt-1 text-gray-500">Scanning RFID tag every 50m...</p>
                                </div>
                            </div>
                        </Tooltip>
                    </Marker>
                )}

                {/* Animated Truck for Transit 2 */}
                {(activePhaseFilter === 'ALL' || activePhaseFilter === 'TRANSIT_2') && transit2Count > 0 && (
                    <Marker position={truck2Pos} icon={truckIcon}>
                        <Tooltip permanent={false} direction="top">
                            <div className="p-1 min-w-[150px]">
                                <strong className="text-orange-600 mb-1 block">In Transit (WH→Site)</strong>
                                <div className="text-sm text-gray-700">
                                    <p>Moving: <strong>{transit2Count}</strong> pipes</p>
                                    <p className="text-xs mt-1 text-gray-500">Final delivery in progress...</p>
                                </div>
                            </div>
                        </Tooltip>
                    </Marker>
                )}
            </MapContainer>
        </div>
    );
}
