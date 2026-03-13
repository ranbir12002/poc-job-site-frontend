import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Circle, Square, MapPin, Loader2, Monitor, Smartphone } from 'lucide-react';
import { Site, Point } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { MapContainer, TileLayer, Polyline, Polygon, Marker, useMap } from 'react-leaflet';
import mapStyle from '../map-style.json';
import L from 'leaflet';
import { calculateMetrics } from './MapCanvas';
import { isLocationNearSite } from '../lib/utils';

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
  existingSite?: Site;
  onBack: () => void;
  onSave: (site: Site) => void;
}

export function SiteRecorder({ existingSite, onBack, onSave }: SiteRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | undefined>();
  const [watchId, setWatchId] = useState<number | null>(null);
  const [siteName, setSiteName] = useState(existingSite ? `Recording ${new Date().toLocaleDateString()}` : 'Recorded Site');
  const [cameraError, setCameraError] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [geofenceError, setGeofenceError] = useState(false);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const gpsTrackRef = useRef<{ lat: number; lng: number; t: number }[]>([]);
  const recordingStartRef = useRef<number>(0);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
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
      // Stop Location Watch
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } else {
      // Geofence check for existing sites
      if (existingSite && existingSite.points && existingSite.points.length > 0) {
        if (!currentLocation) {
           setGeofenceError(true);
           setTimeout(() => setGeofenceError(false), 3000);
           return;
        }
        
        const isNear = isLocationNearSite(currentLocation, existingSite.points, 50, existingSite.isClosed ?? true); // 50 meters
        if (!isNear) {
           setGeofenceError(true);
           setTimeout(() => setGeofenceError(false), 3000);
           return; // Prevent recording
        }
      }

      setIsRecording(true);
      setGeofenceError(false);
      setPoints([]); // Reset points for new recording
      setVideoBlob(null);
      chunksRef.current = [];
      gpsTrackRef.current = [];
      recordingStartRef.current = Date.now();
      
      // Start MediaRecorder
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        try {
          const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunksRef.current.push(e.data);
            }
          };
          mediaRecorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            setVideoBlob(blob);
          };
          mediaRecorder.start(1000); // collect 1s chunks
          mediaRecorderRef.current = mediaRecorder;
        } catch (err) {
          console.error('Error starting media recorder:', err);
        }
      }

      // Start Location Watch
      const id = navigator.geolocation.watchPosition(
        pos => {
          const newPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation([newPoint.lat, newPoint.lng]);
          setPoints(prev => [...prev, newPoint]);
          // Store timestamped GPS for server-side frame mapping
          gpsTrackRef.current.push({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            t: (Date.now() - recordingStartRef.current) / 1000 // seconds since recording start
          });
        },
        err => console.error("Location watch error:", err),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      setWatchId(id);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    let tourNodes: any[] | undefined = undefined;
    let tourId: string | undefined = undefined;
    let customTileUrlStr = undefined;

    // If we recorded video, upload it
    if (videoBlob) {
      const formData = new FormData();
      formData.append('video', videoBlob, 'recording.webm');
      // Send timestamped GPS track so server can do location-based frame extraction
      formData.append('gpsTrack', JSON.stringify(gpsTrackRef.current));
      formData.append('orientation', orientation);
      try {
        const res = await fetch('/api/upload-video', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          tourNodes = data.nodes;
          tourId = data.tourId;
        } else {
          console.error("Video processing failed on server:", data.error);
        }
      } catch (err) {
        console.error("Failed to upload video:", err);
      }
    }

    let finalPoints = [...points];
    // If the device GPS didn't capture enough points (like on desktop), fallback to tour nodes coordinates
    if (finalPoints.length < 2 && tourNodes && tourNodes.length > 0) {
      finalPoints = tourNodes.map((n: any) => ({ lat: n.gps[1], lng: n.gps[0] }));
    }

    const newRecording = {
      id: uuidv4(),
      createdAt: Date.now(),
      name: siteName,
      tourNodes: [], // Don't persist large nodes array, use tourId for on-demand loading
      tourId: tourId,
      points: finalPoints,
      approved: false
    };

    let site: Site;
    if (existingSite) {
      site = {
        ...existingSite,
        recordings: [...(existingSite.recordings || []), newRecording]
      };
    } else {
      site = {
        id: uuidv4(),
        name: siteName,
        createdAt: Date.now(),
        // Use standard points format like the API expects
        points: finalPoints, 
        metrics: {
          ...calculateMetrics(finalPoints, false),
          tourNodes: [], // Don't persist large nodes array
          tourId
        },
        isClosed: false,
        customTileUrl: customTileUrlStr,
        approved: false,
        recordings: [newRecording]
      };
    }
    
    setIsSaving(false);
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
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-start pointer-events-auto gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-4 bg-black/50 hover:bg-black/70 text-white rounded-2xl backdrop-blur-2xl border border-white/10 transition-all shadow-2xl active:scale-95"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex-1 sm:flex-none bg-black/50 backdrop-blur-2xl border border-white/10 rounded-2xl px-4 py-3 shadow-2xl flex items-center">
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none w-full sm:w-48 text-sm"
                placeholder="Site Name"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 sm:pb-0">
            <div className="flex bg-black/50 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 shadow-2xl pointer-events-auto shrink-0">
              <button
                onClick={() => setOrientation('landscape')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  orientation === 'landscape' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/60'
                }`}
              >
                <Monitor size={16} />
                <span className="hidden xs:inline">Landscape</span>
              </button>
              <button
                onClick={() => setOrientation('portrait')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  orientation === 'portrait' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/60'
                }`}
              >
                <Smartphone size={16} />
                <span className="hidden xs:inline">Portrait</span>
              </button>
            </div>

            {!isRecording && points.length > 0 && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl backdrop-blur-2xl border border-white/10 transition-all shadow-2xl font-bold disabled:opacity-50 shrink-0 text-sm active:scale-95"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Validation/Notifications overlay */}
        {geofenceError && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border border-red-400/50 flex items-center gap-2 animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-auto">
            <MapPin size={20} />
            <span className="font-medium text-sm">You must be at the site to record an update.</span>
          </div>
        )}

        {/* Bottom Area */}
        <div className="flex flex-col-reverse sm:flex-row justify-between items-center sm:items-end pointer-events-auto gap-4">
          {/* Mini Map */}
          <div className="w-28 h-28 sm:w-48 sm:h-48 bg-black/50 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden relative self-start sm:self-auto">
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
                  <Polyline positions={positions} color="#6366f1" weight={4} />
                )}
                
                {/* Geofence Indicator */}
                {existingSite && existingSite.points && existingSite.points.length > 2 && (
                  <Polygon 
                    positions={existingSite.points.map(p => [p.lat, p.lng])} 
                    color="#10b981" 
                    fillColor="#10b981" 
                    fillOpacity={0.1} 
                    weight={2} 
                    dashArray="5, 5" 
                  />
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

          {/* Record Button Container */}
          <div className="flex flex-col items-center gap-3">
            {/* Visual Feedback Text */}
            {isRecording && (
              <div className="bg-red-500/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse border border-red-400/30">
                Recording Active
              </div>
            )}
            
            <button
              onClick={toggleRecording}
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full backdrop-blur-3xl border-4 transition-all shadow-2xl flex items-center justify-center active:scale-90 ${
                isRecording 
                  ? 'bg-red-500/20 border-red-500/80 text-red-500' 
                  : 'bg-white/10 border-white/40 text-white'
              }`}
            >
              {isRecording ? <Square size={36} fill="currentColor" /> : <Circle size={40} fill="currentColor" />}
            </button>
          </div>
          
          {/* Metrics Summary (Always visible, but compact) */}
          <div className="flex bg-black/50 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl flex-col gap-1 min-w-[80px] self-end sm:self-auto">
            <div className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Nodes</div>
            <div className="text-2xl font-mono font-bold text-white tabular-nums leading-none">{points.length}</div>
            {isRecording && (
              <div className="text-[10px] text-indigo-400 font-bold mt-1">
                Tracking...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
