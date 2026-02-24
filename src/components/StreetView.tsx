import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Site, Point } from '../types';
import { VideoUploader } from './VideoUploader';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/virtual-tour-plugin/index.css';

interface TourNode {
  id: string;
  panorama: string;
  name: string;
  gps: [number, number];
  links: { nodeId: string }[];
  position?: { lat: number; lng: number };
}

interface StreetViewProps {
  site: Site;
  onClose: () => void;
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

export function StreetView({ site, onClose }: StreetViewProps) {
  const psvRef = useRef<any>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string>('');
  const [nodes, setNodes] = useState<TourNode[]>([]);
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    // Generate nodes based on site points (original behavior)
    if (site.points.length === 0) {
      // No pre-existing points — show the uploader
      setShowUploader(true);
      return;
    }

    const samplePanos = [
      'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-1.jpg',
      'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-2.jpg',
      'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-3.jpg',
      'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-4.jpg',
      'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-5.jpg',
      'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-6.jpg',
    ];

    const generatedNodes: TourNode[] = site.points.map((p, i) => {
      const links: { nodeId: string }[] = [];
      if (i > 0) links.push({ nodeId: `node-${i - 1}` });
      if (i < site.points.length - 1) links.push({ nodeId: `node-${i + 1}` });
      if (site.isClosed && i === site.points.length - 1 && site.points.length > 2) {
        links.push({ nodeId: `node-0` });
      }
      if (site.isClosed && i === 0 && site.points.length > 2) {
        links.push({ nodeId: `node-${site.points.length - 1}` });
      }

      return {
        id: `node-${i}`,
        panorama: samplePanos[i % samplePanos.length],
        name: `Point ${i + 1}`,
        links,
        gps: [p.lng, p.lat],
        position: p,
      };
    });

    setNodes(generatedNodes);
    setCurrentNodeId(generatedNodes[0].id);
  }, [site]);

  const handleTourReady = (tourNodes: TourNode[], _tourId: string) => {
    // Convert video-generated nodes: use gps for position
    const enrichedNodes: TourNode[] = tourNodes.map((n) => ({
      ...n,
      position: { lat: n.gps[1], lng: n.gps[0] },
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

      {nodes.length > 0 ? (
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
        <div className="w-full h-full flex items-center justify-center text-white/50">
          No points available for Street View
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={onClose}
        className="absolute top-6 left-6 p-3 bg-black/40 hover:bg-black/60 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all shadow-2xl z-10"
      >
        <ArrowLeft size={20} />
      </button>

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
                <Polygon positions={positions} color="#3b82f6" fillColor="#3b82f6" fillOpacity={0.2} weight={3} />
              ) : (
                <Polyline positions={positions} color="#3b82f6" weight={3} />
              )
            )}

            {nodes.filter(n => n.position).map((node) => (
              <Marker
                key={node.id}
                position={[node.position!.lat, node.position!.lng]}
                icon={node.id === currentNodeId ? activeIcon : defaultIcon}
                eventHandlers={{
                  click: () => navigateToNode(node.id)
                }}
              />
            ))}
          </MapContainer>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* Apple Glass Slider — Bottom Navigation Bar     */}
      {/* ═══════════════════════════════════════════════ */}
      {nodes.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-xl">
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
    </div>
  );
}
