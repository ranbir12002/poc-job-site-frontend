import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, Play, Pause, Maximize2, Minimize2, Route, Navigation, Flag, Camera, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Polygon, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Site } from '../types';
import { VideoUploader } from './VideoUploader';
import { calculateDistance, calculateTotalDistance } from '../lib/utils';

interface WalkthroughNode {
  id: string;
  panorama: string;
  name: string;
  gps: [number, number];
  links: { nodeId: string }[];
  position?: { lat: number; lng: number };
}

interface SiteWalkthroughProps {
  site: Site;
  onClose: () => void;
  onApprove?: () => void;
}

const activeIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const defaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

function MinimapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

export function SiteWalkthrough({ site, onClose, onApprove }: SiteWalkthroughProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nodes, setNodes] = useState<WalkthroughNode[]>([]);
  const [showUploader, setShowUploader] = useState(false);
  
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(
    site.recordings && site.recordings.length > 0 ? site.recordings[site.recordings.length - 1].id : null
  );

  const activeRecording = useMemo(() => {
    return site.recordings?.find(r => r.id === activeRecordingId);
  }, [site.recordings, activeRecordingId]);

  const [isApproved, setIsApproved] = useState(activeRecording?.approved ?? site.approved ?? false);

  useEffect(() => {
    setIsApproved(activeRecording?.approved ?? site.approved ?? false);
  }, [activeRecording, site.approved]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isFetchingNodes, setIsFetchingNodes] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize nodes from activeRecording or site.metrics.tourNodes
  useEffect(() => {
    async function loadNodes() {
      const memoryNodes = activeRecording?.tourNodes || site.metrics?.tourNodes;
      const tourId = activeRecording?.tourId || site.metrics?.tourId;
      
      let finalNodes = memoryNodes;

      if ((!finalNodes || finalNodes.length === 0) && tourId) {
        setIsFetchingNodes(true);
        try {
          const res = await fetch(`/frames/${tourId}/nodes.json`);
          if (res.ok) {
            finalNodes = await res.json();
          }
        } catch (err) {
          console.error("Failed to fetch walkthrough nodes:", err);
        } finally {
          setIsFetchingNodes(false);
        }
      }

      if (finalNodes && finalNodes.length > 0) {
        const enrichedNodes: WalkthroughNode[] = finalNodes.map((n: any) => ({
          ...n,
          position: { lat: n.gps[1], lng: n.gps[0] },
        }));
        setNodes(enrichedNodes);
        setCurrentIndex(0);
        setIsPlaying(false);
        setShowUploader(false);
      } else {
        setNodes([]);
        setCurrentIndex(0);
        setShowUploader(true);
      }
    }

    loadNodes();
  }, [site, activeRecording]);

  const handleTourReady = (tourNodes: WalkthroughNode[], _tourId: string) => {
    const enrichedNodes: WalkthroughNode[] = tourNodes.map((n) => ({
      ...n,
      position: { lat: n.gps[1], lng: n.gps[0] },
    }));
    setNodes(enrichedNodes);
    setCurrentIndex(0);
    setShowUploader(false);
  };

  // Auto-play logic
  useEffect(() => {
    if (isPlaying && nodes.length > 1) {
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= nodes.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, nodes.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) setCurrentIndex(prev => prev - 1);
      if (e.key === 'ArrowRight' && currentIndex < nodes.length - 1) setCurrentIndex(prev => prev + 1);
      if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p); }
      if (e.key === 'Escape') { if (isFullscreen) setIsFullscreen(false); else onClose(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, nodes.length, isFullscreen, onClose]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentIndex(parseInt(e.target.value, 10));
    setIsPlaying(false);
  };

  // Metrics
  const validPositions = useMemo(() =>
    nodes.filter(n => n.position).map(n => ({ lat: n.position!.lat, lng: n.position!.lng })),
    [nodes]
  );

  const { totalDistance, progressPct, distFromStart } = useMemo(() => {
    if (validPositions.length < 2) return { totalDistance: 0, progressPct: 0, distFromStart: 0 };
    const total = calculateTotalDistance(validPositions);
    const safeIdx = Math.max(0, Math.min(currentIndex, validPositions.length - 1));
    let cumulative = 0;
    for (let i = 1; i <= safeIdx; i++) {
      cumulative += calculateDistance(validPositions[i - 1].lat, validPositions[i - 1].lng, validPositions[i].lat, validPositions[i].lng);
    }
    let fromStart = 0;
    if (safeIdx > 0) {
      fromStart = calculateDistance(validPositions[0].lat, validPositions[0].lng, validPositions[safeIdx].lat, validPositions[safeIdx].lng);
    }
    return { totalDistance: total, progressPct: total > 0 ? (cumulative / total) * 100 : 0, distFromStart: fromStart };
  }, [validPositions, currentIndex]);

  // Uploader view
  if (showUploader) {
    return (
      <div className="absolute inset-0 z-50 bg-black animate-in fade-in duration-500 rounded-[inherit] overflow-hidden">
        <VideoUploader onTourReady={handleTourReady} onCancel={onClose} />
      </div>
    );
  }

  const currentNode = nodes[currentIndex];
  const positions = nodes.filter(n => n.position).map((n) => [n.position!.lat, n.position!.lng] as [number, number]);
  const mapCenter: [number, number] = currentNode?.position
    ? [currentNode.position.lat, currentNode.position.lng]
    : (positions[0] || [51.505, -0.09]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-50 bg-black animate-in fade-in duration-500 rounded-[inherit] overflow-hidden">
      {/* Custom slider styles */}
      <style>{`
        .wt-slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 4px;
          background: linear-gradient(90deg, rgba(99,102,241,0.6) 0%, rgba(168,85,247,0.4) 100%);
          border-radius: 999px; outline: none; cursor: pointer;
        }
        .wt-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(255,255,255,0.95);
          box-shadow: 0 0 12px rgba(99,102,241,0.7), 0 0 24px rgba(99,102,241,0.3), 0 2px 6px rgba(0,0,0,0.3);
          border: 2px solid rgba(99,102,241,0.6); cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .wt-slider::-webkit-slider-thumb:hover { transform: scale(1.25); }
        .wt-slider::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(255,255,255,0.95);
          box-shadow: 0 0 12px rgba(99,102,241,0.7), 0 2px 6px rgba(0,0,0,0.3);
          border: 2px solid rgba(99,102,241,0.6); cursor: pointer;
        }
        .wt-slider::-moz-range-track {
          height: 4px;
          background: linear-gradient(90deg, rgba(99,102,241,0.6) 0%, rgba(168,85,247,0.4) 100%);
          border-radius: 999px;
        }
        @keyframes frameFadeIn {
          from { opacity: 0; transform: scale(1.02); }
          to { opacity: 1; transform: scale(1); }
        }
        .frame-animate { animation: frameFadeIn 0.3s ease-out; }
      `}</style>

      {isFetchingNodes ? (
        <div className="flex flex-col items-center justify-center w-full h-full bg-black">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
          <p className="text-white/60 font-medium">Loading walkthrough...</p>
        </div>
      ) : nodes.length > 0 ? (
        <div className={`absolute inset-0 flex items-center justify-center bg-black ${isFullscreen ? '' : 'pb-20 pt-16'}`}>
          {/* Cinematic letterbox bars */}
          {!isFullscreen && (
            <>
              <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent z-[1]" />
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent z-[1]" />
            </>
          )}

          <img
            key={currentNode?.panorama}
            src={currentNode?.panorama}
            alt={currentNode?.name || `Frame ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain frame-animate select-none"
            draggable={false}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
          />

          {/* Frame number overlay */}
          <div className="absolute top-20 right-6 z-10">
            <div
              className="px-3 py-1.5 rounded-xl text-xs font-mono"
              style={{
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <span className="text-white/90 font-semibold">{currentIndex + 1}</span>
              <span className="text-white/40 mx-1">/</span>
              <span className="text-white/50">{nodes.length}</span>
              <span className="text-white/30 ml-2">frames</span>
            </div>
          </div>

          {/* Left/Right click zones for navigation */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1/4 cursor-pointer z-[2] group"
            onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
          >
            {currentIndex > 0 && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="p-3 bg-black/40 backdrop-blur-xl rounded-full border border-white/10">
                  <ChevronLeft size={24} className="text-white" />
                </div>
              </div>
            )}
          </div>
          <div
            className="absolute right-0 top-0 bottom-0 w-1/4 cursor-pointer z-[2] group"
            onClick={() => currentIndex < nodes.length - 1 && setCurrentIndex(currentIndex + 1)}
          >
            {currentIndex < nodes.length - 1 && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="p-3 bg-black/40 backdrop-blur-xl rounded-full border border-white/10">
                  <ChevronRight size={24} className="text-white" />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/50">
          No frames available
        </div>
      )}

      {/* ═══════════ TOP BAR ═══════════ */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-5">
        {/* Back + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-3 bg-black/40 hover:bg-black/60 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all shadow-2xl"
          >
            <ArrowLeft size={20} />
          </button>
          <div
            className="px-4 py-2 rounded-2xl"
            style={{
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div className="flex items-center gap-2">
              <Camera size={14} className="text-amber-400" />
              <span className="text-white/80 text-sm font-medium">Phone Walkthrough</span>
            </div>
            <p className="text-white/40 text-xs mt-0.5">{site.name}</p>
          </div>
        </div>

        {/* Upload + Fullscreen buttons */}
        <div className="flex items-center gap-4">
          {site.recordings && site.recordings.length > 1 && (
            <select 
              value={activeRecordingId || ''} 
              onChange={e => setActiveRecordingId(e.target.value)}
              className="bg-black/60 text-white border border-white/20 rounded-xl px-4 py-2.5 text-sm font-medium backdrop-blur-xl outline-none cursor-pointer"
            >
              {site.recordings.slice().reverse().map(r => (
                <option key={r.id} value={r.id} className="bg-black/80">{r.name || new Date(r.createdAt).toLocaleDateString()}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowUploader(true)}
            className="px-4 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-2xl backdrop-blur-xl border border-indigo-500/20 transition-all text-sm font-medium"
          >
            Upload Video
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2.5 bg-black/40 hover:bg-black/60 text-white/70 hover:text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* ═══════════ MINIMAP ═══════════ */}
      {positions.length > 0 && !isFullscreen && (
        <div className="absolute bottom-28 right-6 w-56 h-56 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden">
          <MapContainer center={mapCenter} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MinimapUpdater center={mapCenter} />
            {positions.length > 1 && (
              site.isClosed ? (
                <Polygon 
                  positions={positions} 
                  color={isApproved ? '#10b981' : '#3b82f6'} 
                  fillColor={isApproved ? '#10b981' : '#3b82f6'} 
                  fillOpacity={0.2} 
                  weight={3} 
                />
              ) : (
                <Polyline 
                  positions={positions} 
                  color={isApproved ? '#10b981' : '#3b82f6'} 
                  weight={3} 
                />
              )
            )}
            {nodes.filter(n => n.position).map((node, i) => (
              <Marker
                key={node.id}
                position={[node.position!.lat, node.position!.lng]}
                icon={i === currentIndex ? activeIcon : defaultIcon}
                eventHandlers={{ click: () => { setCurrentIndex(i); setIsPlaying(false); }}}
              />
            ))}
          </MapContainer>
        </div>
      )}

      {/* ═══════════ METRICS PANEL ═══════════ */}
      {nodes.length > 1 && !isFullscreen && (
        <div className="absolute bottom-28 left-6 w-72 z-20 animate-in fade-in slide-in-from-left-4 duration-500">
          <div
            className="rounded-3xl overflow-hidden backdrop-blur-3xl border border-white/10 shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(20,20,30,0.6) 0%, rgba(10,10,15,0.7) 100%)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="px-6 py-4 border-b border-white/5 bg-white/5">
              <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <Route className="w-4 h-4 text-amber-400" />
                Walkthrough Metrics
              </h3>
            </div>
            <div className="p-6 space-y-2">
              <div className="flex items-center gap-4 py-2">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5"><Navigation className="w-5 h-5 text-amber-300" /></div>
                <div>
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-0.5">Dist. from Start</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-semibold text-white">{distFromStart.toFixed(1)}</span>
                    <span className="text-sm text-white/50">m</span>
                  </div>
                </div>
              </div>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              
              <div className="flex items-center gap-4 py-2">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5"><MapPin className="w-5 h-5 text-amber-300" /></div>
                <div>
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-0.5">Current Position</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-semibold text-white">
                      {currentNode?.position ? `${currentNode.position.lat.toFixed(6)}, ${currentNode.position.lng.toFixed(6)}` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="flex items-center gap-4 py-2">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5"><Route className="w-5 h-5 text-amber-300" /></div>
                <div>
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-0.5">Total Distance</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-semibold text-white">{totalDistance.toFixed(1)}</span>
                    <span className="text-sm text-white/50">m</span>
                  </div>
                </div>
              </div>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="flex items-center gap-4 py-2">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5"><Flag className="w-5 h-5 text-emerald-400" /></div>
                <div>
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-0.5">Recording Date</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-semibold text-white">
                      {activeRecording ? new Date(activeRecording.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-3">
                <div className="flex justify-between items-end mb-2">
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-emerald-400" /> Progress
                  </p>
                  <span className="text-sm font-semibold text-white">{Math.round(progressPct)}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ BOTTOM NAVIGATION BAR ═══════════ */}
      {nodes.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-4xl">
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-[1.75rem]"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
              backdropFilter: 'blur(40px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.6)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            {/* Prev */}
            <button
              onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setIsPlaying(false); }}
              disabled={currentIndex <= 0}
              className="p-2 rounded-full bg-white/5 hover:bg-white/15 disabled:opacity-20 disabled:cursor-not-allowed text-white transition-all active:scale-90"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>

            {/* Play/Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2 rounded-full transition-all active:scale-90 ${isPlaying ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-white/5 text-white hover:bg-white/15'}`}
            >
              {isPlaying ? <Pause size={18} strokeWidth={2.5} /> : <Play size={18} strokeWidth={2.5} />}
            </button>

            {/* Slider */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <input
                type="range"
                min={0}
                max={nodes.length - 1}
                value={currentIndex}
                onChange={handleSliderChange}
                className="wt-slider w-full"
              />
            </div>

            {/* Next */}
            <button
              onClick={() => { setCurrentIndex(Math.min(nodes.length - 1, currentIndex + 1)); setIsPlaying(false); }}
              disabled={currentIndex >= nodes.length - 1}
              className="p-2 rounded-full bg-white/5 hover:bg-white/15 disabled:opacity-20 disabled:cursor-not-allowed text-white transition-all active:scale-90"
            >
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>

            {/* Frame Counter */}
            <div className="text-white/50 text-xs font-mono tabular-nums min-w-[3.5rem] text-center select-none">
              <span className="text-white/90 font-semibold">{currentIndex + 1}</span>
              <span className="mx-0.5">/</span>
              <span>{nodes.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ APPROVAL ═══════════ */}
      {nodes.length > 1 && currentIndex === nodes.length - 1 && !isApproved && onApprove && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top duration-500">
          <button
            onClick={() => { setIsApproved(true); onApprove(); }}
            className="flex items-center gap-3 px-8 py-4 bg-emerald-500/90 hover:bg-emerald-500 text-white rounded-2xl backdrop-blur-xl border border-emerald-400/30 transition-all shadow-2xl font-semibold text-lg"
          >
            <CheckCircle size={24} />
            Approve Section
          </button>
        </div>
      )}

      {isApproved && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-2xl backdrop-blur-xl border border-emerald-500/30 font-medium">
            <CheckCircle size={20} />
            Section Approved
          </div>
        </div>
      )}
    </div>
  );
}
