import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Circle, Square, MapPin } from 'lucide-react';
import { Site, Point } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import mapStyle from '../map-style.json';
import L from 'leaflet';
import { calculateMetrics } from './MapCanvas';

function MiniMapUpdater({ center }: { center?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 18);
    }
  }, [center, map]);
  return null;
}

interface SiteRecorderProps {
  onBack: () => void;
  onSave: (site: Site) => void;
}

export function SiteRecorder({ onBack, onSave }: SiteRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | undefined>();
  const [watchId, setWatchId] = useState<number | null>(null);
  const [siteName, setSiteName] = useState('Recorded Site');
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Camera error:", err);
        setCameraError(true);
      });

    navigator.geolocation.getCurrentPosition(
      pos => setCurrentLocation([pos.coords.latitude, pos.coords.longitude]),
      err => console.error("Location error:", err),
      { enableHighAccuracy: true }
    );

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
    } else {
      setIsRecording(true);
      const id = navigator.geolocation.watchPosition(
        pos => {
          const newPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation([newPoint.lat, newPoint.lng]);
          setPoints(prev => [...prev, newPoint]);
        },
        err => console.error("Location watch error:", err),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      setWatchId(id);
    }
  };

  const handleSave = () => {
    const site: Site = {
      id: uuidv4(),
      name: siteName,
      createdAt: Date.now(),
      points,
      metrics: calculateMetrics(points, false),
      isClosed: false,
    };
    onSave(site);
  };

  const positions = points.map(p => [p.lat, p.lng] as [number, number]);

  return (
    <div className="flex h-full w-full animate-in fade-in duration-500 relative bg-black rounded-[inherit] overflow-hidden">
      {/* Camera Feed or Mock Image */}
      {cameraError ? (
        <img 
          src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" 
          alt="Mock Camera Feed" 
          className="absolute inset-0 w-full h-full object-cover z-0"
          referrerPolicy="no-referrer"
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      )}

      {/* Glass Overlay UI */}
      <div className="absolute inset-0 z-10 flex flex-col justify-between p-4 md:p-6 pointer-events-none">
        {/* Top Bar */}
        <div className="flex justify-between items-start pointer-events-auto gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-3 bg-black/40 hover:bg-black/60 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all shadow-2xl"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2 shadow-2xl flex items-center">
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none w-32 md:w-48"
                placeholder="Site Name"
              />
            </div>
          </div>

          {!isRecording && points.length > 0 && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-xl border border-white/20 transition-all shadow-2xl font-medium"
            >
              <Save size={18} />
              <span className="hidden sm:inline">Save</span>
            </button>
          )}
        </div>

        {/* Bottom Area */}
        <div className="flex flex-col md:flex-row justify-between items-end pointer-events-auto gap-4">
          {/* Mini Map */}
          <div className="w-32 h-32 md:w-48 md:h-48 bg-black/40 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden relative self-start md:self-end">
            {currentLocation ? (
              <MapContainer
                center={currentLocation}
                zoom={18}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                attributionControl={false}
              >
                <TileLayer
                  url={mapStyle.tileLayer.url}
                  maxZoom={mapStyle.tileLayer.maxZoom}
                />
                {mapStyle.overlayLayer && mapStyle.overlayLayer.url && (
                  <TileLayer url={mapStyle.overlayLayer.url} />
                )}
                <MiniMapUpdater center={currentLocation} />
                {positions.length > 0 && (
                  <Polyline positions={positions} color="#3b82f6" weight={4} />
                )}
                <Marker position={currentLocation} />
              </MapContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50 text-xs text-center p-2">
                Locating...
              </div>
            )}
            {/* Recording Indicator on Map */}
            {isRecording && (
              <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse z-[400]" />
            )}
          </div>

          {/* Record Button */}
          <div className="flex-1 flex justify-center md:flex-none md:absolute md:left-1/2 md:-translate-x-1/2 md:bottom-6">
            <button
              onClick={toggleRecording}
              className={`p-4 rounded-full backdrop-blur-xl border-2 transition-all shadow-2xl flex items-center justify-center ${
                isRecording 
                  ? 'bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30' 
                  : 'bg-white/10 border-white/30 text-white hover:bg-white/20'
              }`}
            >
              {isRecording ? <Square size={32} fill="currentColor" /> : <Circle size={32} fill="currentColor" />}
            </button>
          </div>
          
          {/* Metrics Summary */}
          <div className="hidden md:flex bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex-col gap-2">
            <div className="text-white/50 text-xs uppercase tracking-wider">Points</div>
            <div className="text-xl font-mono text-white">{points.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
