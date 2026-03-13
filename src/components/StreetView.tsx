import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, Route, Navigation, Flag, Layers, Eye, Scan, MapPin } from 'lucide-react';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Site, Point, LidarScan } from '../types';
import { VideoUploader } from './VideoUploader';
import { ScanViewer } from './ScanViewer';
import { LidarCapture } from './LidarCapture';
import { calculateDistance, calculateTotalDistance } from '../lib/utils';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/virtual-tour-plugin/index.css';

interface TourNode {
  id: string;
  panorama: string;
  name: string;
  gps: [number, number];
  links: { nodeId: string }[];
  position?: { lat: number; lng: number };
  panoData?: any;
}

interface StreetViewProps {
  site: Site;
  onClose: () => void;
  onApprove?: () => void;
}

// Custom icon for the active node in the minimap
const activeIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const defaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const approvedIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MinimapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

/** Build a custom arrow DOM element — bold chevron style */
function createArrowElement(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `;

  const svgContainer = document.createElement('div');
  svgContainer.style.cssText = `
    transition: opacity 0.2s ease;
    filter: drop-shadow(0 3px 8px rgba(0,0,0,0.6));
  `;

  // SVG chevron — thick white fill with dark outline, large
  svgContainer.innerHTML = `
    <svg width="80" height="46" viewBox="0 0 52 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 26 L26 6 L48 26"
        stroke="#111"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <path
        d="M4 26 L26 6 L48 26"
        stroke="rgba(255,255,255,0.95)"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </svg>
  `;

  wrapper.appendChild(svgContainer);

  wrapper.addEventListener('mouseenter', () => {
    svgContainer.style.opacity = '0.7';
  });
  wrapper.addEventListener('mouseleave', () => {
    svgContainer.style.opacity = '1';
  });

  return wrapper;
}

export function StreetView({ site, onClose, onApprove }: StreetViewProps) {
  const psvRef = useRef<any>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string>('');
  const [nodes, setNodes] = useState<TourNode[]>([]);
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


  const [viewTab, setViewTab] = useState<'photo' | 'depth' | 'scan'>('photo');
  const [activeScan, setActiveScan] = useState<LidarScan | null>(null);
  const [showLidarCapture, setShowLidarCapture] = useState(false);
  const [isFetchingNodes, setIsFetchingNodes] = useState(false);

  const samplePanos = useMemo(() => [
    'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-1.jpg',
    'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-2.jpg',
    'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-3.jpg',
    'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-4.jpg',
    'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-5.jpg',
    'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-6.jpg',
    'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-7.jpg',
  ], []);



  // Build / rebuild nodes whenever site or activeRecording changes
  useEffect(() => {
    async function loadNodes() {
      // Use activeRecording's tourNodes, fallback to site.metrics.tourNodes
      const memoryNodes = activeRecording?.tourNodes || site.metrics?.tourNodes;
      const tourId = activeRecording?.tourId || site.metrics?.tourId;
      
      let finalTourNodes = memoryNodes;

      // If and only if we have a tourId but no nodes in memory, fetch on demand
      if ((!finalTourNodes || finalTourNodes.length === 0) && tourId) {
        setIsFetchingNodes(true);
        try {
          const res = await fetch(`/frames/${tourId}/nodes.json`);
          if (res.ok) {
            finalTourNodes = await res.json();
          }
        } catch (err) {
          console.error("Failed to fetch on-demand nodes:", err);
        } finally {
          setIsFetchingNodes(false);
        }
      }

      if (finalTourNodes && finalTourNodes.length > 0) {
        const enrichedNodes: TourNode[] = finalTourNodes.map((n: any) => ({
          ...n,
          panorama: n.panorama,
          position: { lat: n.gps[1], lng: n.gps[0] },
          panoData: (image: HTMLImageElement) => {
            const verticalFov = 60; 
            const fullHeight = Math.round(image.height * (180 / verticalFov));
            const fullWidth = fullHeight * 2;
            return {
              fullWidth,
              fullHeight,
              croppedWidth: image.width,
              croppedHeight: image.height,
              croppedX: Math.round((fullWidth - image.width) / 2),
              croppedY: Math.round((fullHeight - image.height) / 2),
            };
          }
        }));
        setNodes(enrichedNodes);
        // CRITICAL: Always reset to the first node when switching recordings/versions
        setCurrentNodeId(enrichedNodes[0].id);
      } else {
        setNodes([]);
        setCurrentNodeId('');
      }
    }

    loadNodes();
  }, [site, activeRecordingId, activeRecording]);

  // When nodes change (due to toggle), push updated nodes into the VirtualTourPlugin
  useEffect(() => {
    if (psvRef.current && nodes.length > 0) {
      const virtualTour = psvRef.current.getPlugin(VirtualTourPlugin);
      if (virtualTour) {
        const targetNodeId = currentNodeId || nodes[0].id;
        virtualTour.setNodes(nodes, targetNodeId);
      }
    }
  }, [nodes]);

  const handleTourReady = (tourNodes: TourNode[], _tourId: string) => {
    // Convert video-generated nodes: use gps for position and crop the view for video frames
    const enrichedNodes: TourNode[] = tourNodes.map((n) => ({
      ...n,
      position: { lat: n.gps[1], lng: n.gps[0] },
      panoData: (image: HTMLImageElement) => {
        const verticalFov = 60;
        const fullHeight = Math.round(image.height * (180 / verticalFov));
        const fullWidth = fullHeight * 2;
        
        return {
          fullWidth,
          fullHeight,
          croppedWidth: image.width,
          croppedHeight: image.height,
          croppedX: Math.round((fullWidth - image.width) / 2),
          croppedY: Math.round((fullHeight - image.height) / 2),
        };
      }
    }));
    setNodes(enrichedNodes);
    setCurrentNodeId(enrichedNodes[0]?.id || '');
    setShowUploader(false);
  };

  const handleReady = (instance: any) => {
    psvRef.current = instance;
    const virtualTour = instance.getPlugin(VirtualTourPlugin);
    if (virtualTour && nodes.length > 0) {
      virtualTour.setNodes(nodes, nodes[0].id);

      virtualTour.addEventListener('node-changed', ({ node }: any) => {
        setCurrentNodeId(node.id);
      });
    }


  };

  const navigateToNode = (nodeId: string) => {
    if (psvRef.current) {
      const virtualTour = psvRef.current.getPlugin(VirtualTourPlugin);
      if (virtualTour) {
        virtualTour.setCurrentNode(nodeId);
      }
    }
  };

  const currentIndex = useMemo(() => {
    return nodes.findIndex(n => n.id === currentNodeId);
  }, [nodes, currentNodeId]);

  // --- Metrics Calculations ---
  const validPositions = useMemo(() => {
    return nodes
      .filter(n => n.position)
      .map(n => ({ lat: n.position!.lat, lng: n.position!.lng }));
  }, [nodes]);

  const { totalDistance, progressPct, distFromStart } = useMemo(() => {
    if (validPositions.length < 2) {
      return { totalDistance: 0, progressPct: 0, distFromStart: 0 };
    }

    // Total Path Distance
    const total = calculateTotalDistance(validPositions);

    // Distance from previous and Cumulative distance to current node
    let cumulative = 0;
    let fromPrev = 0;

    // Calculate progress up to currentIndex
    // Ensure currentIndex is valid
    const safeCurrIndex = Math.max(0, Math.min(currentIndex, validPositions.length - 1));

    // Distance from start to current point (straight line distance, not cumulative path)
    let fromStart = 0;
    if (safeCurrIndex > 0) {
      const pStart = validPositions[0];
      const pCurr = validPositions[safeCurrIndex];
      fromStart = calculateDistance(pStart.lat, pStart.lng, pCurr.lat, pCurr.lng);
    }

    for (let i = 1; i <= safeCurrIndex; i++) {
      const p1 = validPositions[i - 1];
      const p2 = validPositions[i];
      const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
      cumulative += dist;
    }

    const pct = total > 0 ? (cumulative / total) * 100 : 0;

    return {
      totalDistance: total,
      progressPct: pct,
      distFromStart: fromStart
    };
  }, [validPositions, currentIndex]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    if (nodes[idx]) {
      navigateToNode(nodes[idx].id);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) navigateToNode(nodes[currentIndex - 1].id);
  };

  const handleNext = () => {
    if (currentIndex < nodes.length - 1) navigateToNode(nodes[currentIndex + 1].id);
  };

  // If showing the LiDAR capture/upload page
  if (showLidarCapture) {
    return (
      <LidarCapture
        onScanReady={(scan) => {
          setActiveScan(scan);
          setViewTab('scan');
          setShowLidarCapture(false);
        }}
        onCancel={() => setShowLidarCapture(false)}
      />
    );
  }

  // If viewing a 3D scan
  if (viewTab === 'scan' && activeScan) {
    return (
      <ScanViewer
        scan={activeScan}
        onClose={() => {
          setViewTab('photo');
          setActiveScan(null);
        }}
      />
    );
  }

  // If showing the uploader
  if (showUploader) {
    return (
      <div className="absolute inset-0 z-50 bg-black animate-in fade-in duration-500 rounded-[inherit] overflow-hidden">
        <VideoUploader
          onTourReady={handleTourReady}
          onCancel={onClose}
        />
      </div>
    );
  }

  const positions = nodes
    .filter(n => n.position)
    .map((n) => [n.position!.lat, n.position!.lng] as [number, number]);
  const currentNode = nodes.find(n => n.id === currentNodeId);
  const mapCenter: [number, number] = currentNode?.position
    ? [currentNode.position.lat, currentNode.position.lng]
    : (positions[0] || [51.505, -0.09]);

  const MetricItem = ({ icon: Icon, label, value, unit }: { icon: any, label: string, value: string | number, unit?: string }) => (
    <div className="flex items-center gap-4 py-3 group">
      <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-white/10 transition-colors border border-white/5 shadow-inner">
        <Icon className="w-5 h-5 text-indigo-300" />
      </div>
      <div>
        <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-0.5">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold text-white tracking-tight">{value}</span>
          {unit && <span className="text-sm text-white/50 font-medium">{unit}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 z-50 bg-black animate-in fade-in duration-500 rounded-[inherit] overflow-hidden">
      {/* Inject custom slider styles */}
      <style>{`
        /* Custom range slider — Apple glass style */
        .glass-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          background: linear-gradient(90deg, rgba(99,102,241,0.6) 0%, rgba(168,85,247,0.4) 100%);
          border-radius: 999px;
          outline: none;
          cursor: pointer;
          position: relative;
        }
        .glass-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255,255,255,0.95);
          box-shadow: 0 0 12px rgba(99,102,241,0.7), 0 0 24px rgba(99,102,241,0.3), 0 2px 6px rgba(0,0,0,0.3);
          border: 2px solid rgba(99,102,241,0.6);
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .glass-slider::-webkit-slider-thumb:hover {
          transform: scale(1.25);
          box-shadow: 0 0 18px rgba(99,102,241,0.9), 0 0 36px rgba(99,102,241,0.4), 0 2px 8px rgba(0,0,0,0.4);
        }
        .glass-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255,255,255,0.95);
          box-shadow: 0 0 12px rgba(99,102,241,0.7), 0 0 24px rgba(99,102,241,0.3), 0 2px 6px rgba(0,0,0,0.3);
          border: 2px solid rgba(99,102,241,0.6);
          cursor: pointer;
        }
        .glass-slider::-moz-range-track {
          height: 4px;
          background: linear-gradient(90deg, rgba(99,102,241,0.6) 0%, rgba(168,85,247,0.4) 100%);
          border-radius: 999px;
        }
      `}</style>

      {isFetchingNodes ? (
        <div className="flex flex-col items-center justify-center w-full h-full bg-black">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
          <p className="text-white/60 font-medium">Fetching tour nodes...</p>
        </div>
      ) : nodes.length > 0 ? (
        <ReactPhotoSphereViewer
          src={nodes[0].panorama}
          height="100%"
          width="100%"
          defaultPitch={0}
          defaultYaw={0}
          defaultZoomLvl={30}
          sphereCorrection={{ pan: 0, tilt: 0, roll: 0 }}
          onReady={handleReady}
          navbar={false}
          plugins={[
            [VirtualTourPlugin, {
              positionMode: 'gps',
              renderMode: '3d',
              preload: true,
              transitionOptions: {
                showLoader: true,
                speed: '20rpm',
                effect: 'fade',
                rotation: false,
              },
              arrowStyle: {
                element: createArrowElement(),
                size: { width: 60, height: 60 },
              },
            }],
          ]}
        />
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full text-center p-8 bg-black">
          <Layers className="w-16 h-16 text-white/20 mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">No Tour Data Available</h3>
          <p className="text-white/50 max-w-sm mb-6">
            There are no recorded video frames or GPS points for this site. 
            Please record a video using the Site Recorder or upload an existing video to generate the walkthrough.
          </p>
          <button
            onClick={() => setShowUploader(true)}
            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg transition-colors font-medium"
          >
            Upload Video
          </button>
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={onClose}
        className="absolute top-6 left-6 p-3 bg-black/40 hover:bg-black/60 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all shadow-2xl z-10"
      >
        <ArrowLeft size={20} />
      </button>

      {/* Version Selector & Depth Toggle */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex gap-4 items-center">
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
        <div
          className="flex items-center rounded-2xl p-1 gap-0.5"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
            backdropFilter: 'blur(40px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.6)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <button
            onClick={() => setViewTab('photo')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${viewTab === 'photo'
              ? 'bg-white/15 text-white shadow-lg'
              : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
          >
            <Eye size={16} />
            Photo
          </button>
          <button
            onClick={() => {
              // Check if there's an existing scan
              const existingScan = activeRecording?.lidarScans?.[0];
              if (existingScan) {
                setActiveScan(existingScan);
                setViewTab('scan');
              } else {
                setShowLidarCapture(true);
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${viewTab === 'scan'
              ? 'bg-emerald-500/30 text-emerald-200 shadow-lg border border-emerald-500/20'
              : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
          >
            <Scan size={16} />
            3D Scan
          </button>
        </div>
      </div>

      {/* Upload Video Button */}
      <button
        onClick={() => setShowUploader(true)}
        className="absolute top-6 right-6 px-4 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-2xl backdrop-blur-xl border border-indigo-500/20 transition-all shadow-2xl z-10 text-sm font-medium"
      >
        Upload Video
      </button>

      {/* Minimap */}
      {positions.length > 0 && (
        <div className="absolute bottom-28 right-6 w-56 h-56 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-10 overflow-hidden">
          <MapContainer
            center={mapCenter}
            zoom={16}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
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

            {nodes.filter(n => n.position).map((node) => (
              <Marker
                key={node.id}
                position={[node.position!.lat, node.position!.lng]}
                icon={node.id === currentNodeId ? activeIcon : (isApproved ? approvedIcon : defaultIcon)}
                eventHandlers={{
                  click: () => navigateToNode(node.id)
                }}
              />
            ))}
          </MapContainer>
        </div>
      )}

      {/* Metrics Panel (Left Side) - Apple Glass Style */}
      {nodes.length > 1 && (
        <div className="absolute bottom-28 left-6 w-72 z-20 animate-in fade-in slide-in-from-left-4 duration-500">
          <div
            className="rounded-3xl overflow-hidden backdrop-blur-3xl border border-white/10 shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(20,20,30,0.6) 0%, rgba(10,10,15,0.7) 100%)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 bg-white/5">
              <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <Route className="w-4 h-4 text-indigo-400" />
                Tour Metrics
              </h3>
            </div>

            {/* Content */}
            <div className="p-6 space-y-2">
              <MetricItem
                icon={Navigation}
                label="Dist. from Start"
                value={distFromStart.toFixed(1)}
                unit="m"
              />
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />
              
              <MetricItem
                icon={MapPin}
                label="Current Position"
                value={`${currentNode?.position?.lat.toFixed(6)}, ${currentNode?.position?.lng.toFixed(6)}`}
              />
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />

              <MetricItem
                icon={Route}
                label="Total Distance"
                value={totalDistance.toFixed(1)}
                unit="m"
              />
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />

              <MetricItem
                icon={Flag}
                label="Recording Date"
                value={activeRecording ? new Date(activeRecording.createdAt).toLocaleDateString() : 'N/A'}
              />

              {/* Progress Bar Item */}
              <div className="pt-3">
                <div className="flex justify-between items-end mb-2">
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-emerald-400" />
                    Progress
                  </p>
                  <span className="text-sm font-semibold text-white">{Math.round(progressPct)}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* Apple Glass Slider — Bottom Navigation Bar     */}
      {/* ═══════════════════════════════════════════════ */}
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
            {/* Prev Button */}
            <button
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              className="p-2 rounded-full bg-white/5 hover:bg-white/15 disabled:opacity-20 disabled:cursor-not-allowed text-white transition-all active:scale-90"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>

            {/* Slider Track */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <input
                type="range"
                min={0}
                max={nodes.length - 1}
                value={currentIndex >= 0 ? currentIndex : 0}
                onChange={handleSliderChange}
                className="glass-slider w-full"
              />
            </div>

            {/* Next Button */}
            <button
              onClick={handleNext}
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

      {/* Approval Button — appears at last node */}
      {nodes.length > 1 && currentIndex === nodes.length - 1 && !isApproved && onApprove && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top duration-500">
          <button
            onClick={() => {
              setIsApproved(true);
              onApprove();
            }}
            className="flex items-center gap-3 px-8 py-4 bg-emerald-500/90 hover:bg-emerald-500 text-white rounded-2xl backdrop-blur-xl border border-emerald-400/30 transition-all shadow-2xl font-semibold text-lg"
          >
            <CheckCircle size={24} />
            Approve Section
          </button>
        </div>
      )}

      {/* Approved Badge */}
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
