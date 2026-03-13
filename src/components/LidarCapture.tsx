import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Upload, Smartphone, Check, AlertTriangle, Scan, Info, ChevronRight } from 'lucide-react';

interface LidarCaptureProps {
  onScanReady: (scan: any) => void;
  onCancel: () => void;
}

// Detect iPhone Pro models that have LiDAR
function detectLidarDevice(): { hasLidar: boolean; deviceName: string } {
  const ua = navigator.userAgent;
  
  // Check if it's an iPhone
  if (!/iPhone/.test(ua)) {
    return { hasLidar: false, deviceName: 'Non-iPhone Device' };
  }
  
  // iPhone Pro models with LiDAR (12 Pro+, 13 Pro+, 14 Pro+, 15 Pro+, 16 Pro+)
  // We can't get exact model from UA, but we can check screen dimensions and pixel ratio
  const screenHeight = window.screen.height;
  const screenWidth = window.screen.width;
  const pixelRatio = window.devicePixelRatio;
  
  // Pro model screen dimensions (in CSS pixels)
  const proScreens = [
    // iPhone 12 Pro / 13 Pro
    { w: 390, h: 844 },
    // iPhone 12 Pro Max / 13 Pro Max
    { w: 428, h: 926 },
    // iPhone 14 Pro
    { w: 393, h: 852 },
    // iPhone 14 Pro Max
    { w: 430, h: 932 },
    // iPhone 15 Pro
    { w: 393, h: 852 },
    // iPhone 15 Pro Max
    { w: 430, h: 932 },
    // iPhone 16 Pro
    { w: 402, h: 874 },
    // iPhone 16 Pro Max
    { w: 440, h: 956 },
  ];
  
  const isPro = proScreens.some(s => 
    (screenWidth === s.w && screenHeight === s.h) || (screenWidth === s.h && screenHeight === s.w)
  );
  
  if (isPro && pixelRatio >= 3) {
    return { hasLidar: true, deviceName: 'iPhone Pro (LiDAR)' };
  }
  
  return { hasLidar: false, deviceName: 'iPhone (No LiDAR)' };
}

export function LidarCapture({ onScanReady, onCancel }: LidarCaptureProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { hasLidar, deviceName } = detectLidarDevice();
  
  const handleUpload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['ply', 'obj', 'glb', 'usdz'].includes(ext || '')) {
      setError('Please upload a PLY, OBJ, GLB, or USDZ file.');
      return;
    }
    
    setUploading(true);
    setError('');
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('scan', file);
    
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload-scan');
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      
      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          if (data.success) {
            onScanReady(data.scan);
          } else {
            setError(data.error || 'Upload failed.');
          }
        } else {
          setError('Upload failed. Please try again.');
        }
        setUploading(false);
      };
      
      xhr.onerror = () => {
        setError('Network error. Please try again.');
        setUploading(false);
      };
      
      xhr.send(formData);
    } catch (e) {
      setError('Upload failed. Please try again.');
      setUploading(false);
    }
  }, [onScanReady]);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const steps = [
    {
      title: 'Open a LiDAR Scanner App',
      description: 'Use "3D Scanner App" (free) or "Polycam" on your iPhone Pro.',
      icon: '📱',
    },
    {
      title: 'Scan Your Site',
      description: 'Walk around the excavation or construction area. Hold your phone steady while scanning.',
      icon: '📡',
    },
    {
      title: 'Export as PLY or OBJ',
      description: 'In the app, export your scan as a PLY or OBJ file. Save to Files or share.',
      icon: '📤',
    },
    {
      title: 'Upload Here',
      description: 'Upload the exported file below to view the 3D scan with metric depth.',
      icon: '☁️',
    },
  ];

  return (
    <div className="absolute inset-0 z-50 bg-black animate-in fade-in duration-500 rounded-[inherit] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <button
          onClick={onCancel}
          className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Scan size={20} className="text-indigo-400" />
          LiDAR 3D Scan
        </h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Device Detection Badge */}
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
          hasLidar 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className={`p-2 rounded-xl ${hasLidar ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
            {hasLidar ? <Check size={20} className="text-emerald-400" /> : <AlertTriangle size={20} className="text-amber-400" />}
          </div>
          <div>
            <p className={`text-sm font-semibold ${hasLidar ? 'text-emerald-300' : 'text-amber-300'}`}>
              {hasLidar ? 'LiDAR Sensor Detected' : 'LiDAR Not Detected'}
            </p>
            <p className="text-xs text-white/50">{deviceName}</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
          <Info size={18} className="text-indigo-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-white/70 leading-relaxed">
            iPhone Pro models include a LiDAR scanner that creates precise 3D depth maps. 
            Use a free scanning app to capture your site, then upload the scan file here for 
            <strong className="text-white"> real metric depth measurements</strong>.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">How to Scan</h3>
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/8 transition-colors">
              <div className="text-2xl flex-shrink-0 mt-0.5">{step.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full">Step {i + 1}</span>
                </div>
                <p className="text-sm font-medium text-white mt-1">{step.title}</p>
                <p className="text-xs text-white/50 mt-0.5">{step.description}</p>
              </div>
              {i < steps.length - 1 && <ChevronRight size={16} className="text-white/20 mt-2" />}
            </div>
          ))}
        </div>

        {/* Upload Area */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Upload Scan</h3>
          
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
              dragOver 
                ? 'border-indigo-400 bg-indigo-500/20 scale-[1.02]' 
                : uploading 
                  ? 'border-white/20 bg-white/5' 
                  : 'border-white/15 bg-white/5 hover:border-indigo-400/50 hover:bg-indigo-500/5'
            }`}
          >
            {uploading ? (
              <>
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin mb-4" />
                <p className="text-sm font-medium text-white">Processing scan...</p>
                <div className="w-48 h-2 bg-white/10 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-white/40 mt-2">{uploadProgress}%</p>
              </>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
                  <Upload size={28} className="text-indigo-400" />
                </div>
                <p className="text-sm font-medium text-white">Drop your scan file here</p>
                <p className="text-xs text-white/40 mt-1">PLY, OBJ, GLB, or USDZ • up to 200MB</p>
              </>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".ply,.obj,.glb,.usdz"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={16} className="text-red-400" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}
        </div>

        {/* Recommended Apps */}
        <div className="space-y-3 pb-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Recommended Apps</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: '3D Scanner App', desc: 'Free • Best for large sites', color: 'from-blue-500/20 to-indigo-500/20' },
              { name: 'Polycam', desc: 'Free tier • High detail', color: 'from-purple-500/20 to-pink-500/20' },
            ].map((app) => (
              <div key={app.name} className={`p-4 rounded-2xl bg-gradient-to-br ${app.color} border border-white/5`}>
                <Smartphone size={18} className="text-white/60 mb-2" />
                <p className="text-sm font-medium text-white">{app.name}</p>
                <p className="text-xs text-white/40">{app.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
