import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Undo, Check, Ruler, Clock, MapPin, Trash2, Search, ToggleLeft, ToggleRight, Eye, Layers, Settings, Activity, Plus, X, Magnet } from 'lucide-react';
import { Site, Point, DailyProgress } from '../types';
import { MapCanvas, calculateMetrics } from './MapCanvas';
import { v4 as uuidv4 } from 'uuid';

interface SiteEditorProps {
  site: Site;
  onBack: () => void;
  onSave: (site: Site) => void;
}

export function SiteEditor({ site, onBack, onSave }: SiteEditorProps) {
  const [points, setPoints] = useState<Point[]>(site.points);
  const [isDrawing, setIsDrawing] = useState(site.points.length === 0);
  const [isFinished, setIsFinished] = useState(site.points.length > 1);
  const [isClosed, setIsClosed] = useState<boolean>(site.isClosed ?? true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(
    site.points.length > 0 ? [site.points[0].lat, site.points[0].lng] : undefined
  );
  const [isSearching, setIsSearching] = useState(false);
  const [snapToPoints, setSnapToPoints] = useState(true);
  
  // Custom Tiles State
  const [customTileUrl, setCustomTileUrl] = useState(site.customTileUrl || '');
  const [showCustomTiles, setShowCustomTiles] = useState(!!site.customTileUrl);
  const [showTileSettings, setShowTileSettings] = useState(false);

  // Progress State
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  const [contractorCommitment, setContractorCommitment] = useState<number>(site.contractorCommitmentPerDay || 100);
  const [dailyProgress, setDailyProgress] = useState<DailyProgress[]>(site.dailyProgress || []);
  const [newProgressMeters, setNewProgressMeters] = useState<string>('');
  const [newProgressNotes, setNewProgressNotes] = useState<string>('');

  const metrics = calculateMetrics(points, isClosed);

  const totalCompleted = dailyProgress.reduce((sum, p) => sum + (p.status === 'approved' ? p.metersCompleted : 0), 0);
  const progressPercentage = metrics.perimeterMeters > 0 ? Math.min(100, Math.round((totalCompleted / metrics.perimeterMeters) * 100)) : 0;
  const daysRemaining = contractorCommitment > 0 ? Math.ceil(Math.max(0, metrics.perimeterMeters - totalCompleted) / contractorCommitment) : 0;

  const handleUndo = () => {
    if (points.length > 0) {
      setPoints(points.slice(0, -1));
      setIsFinished(false);
      setIsDrawing(true);
    }
  };

  const handleClear = () => {
    setPoints([]);
    setIsFinished(false);
    setIsDrawing(true);
  };

  const handleFinish = () => {
    if (points.length > 1) {
      setIsFinished(true);
      setIsDrawing(false);
    }
  };

  const handleSave = () => {
    onSave({
      ...site,
      points,
      metrics,
      isClosed,
      customTileUrl: customTileUrl || undefined,
      contractorCommitmentPerDay: contractorCommitment,
      dailyProgress,
    });
  };

  const handleAddProgress = () => {
    const meters = parseFloat(newProgressMeters);
    if (isNaN(meters) || meters <= 0) return;

    const newProgress: DailyProgress = {
      id: uuidv4(),
      date: Date.now(),
      metersCompleted: meters,
      status: 'pending',
      notes: newProgressNotes,
    };

    setDailyProgress([...dailyProgress, newProgress]);
    setNewProgressMeters('');
    setNewProgressNotes('');
  };

  const handleUpdateProgressStatus = (id: string, status: 'approved' | 'rejected') => {
    setDailyProgress(dailyProgress.map(p => p.id === id ? { ...p, status } : p));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);

    // Check if the query is a coordinate pair (e.g., "40.7128, -74.0060" or "40.7128 -74.0060")
    const coordMatch = searchQuery.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        setMapCenter([lat, lon]);
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocation = (lat: string, lon: string) => {
    setMapCenter([parseFloat(lat), parseFloat(lon)]);
    setSearchResults([]);
    setSearchQuery('');
  };

  return (
    <div className="flex h-full w-full animate-in fade-in duration-500 relative bg-black rounded-[inherit] overflow-hidden">
      {/* Map Background */}
      <div className="absolute inset-0 z-0">
        <MapCanvas
          points={points}
          onPointsChange={setPoints}
          isDrawing={isDrawing}
          isFinished={isFinished}
          isClosed={isClosed}
          center={mapCenter}
          customTileUrl={customTileUrl}
          showCustomTiles={showCustomTiles}
          snapToPoints={snapToPoints}
        />
      </div>

      {/* Progress Panel */}
      {showProgressPanel && (
        <div className="absolute top-0 right-0 bottom-0 w-full md:w-96 bg-black/90 backdrop-blur-3xl border-l border-white/10 z-40 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Progress Tracker</h2>
            <button onClick={() => setShowProgressPanel(false)} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
            {/* Metrics Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Total Length</div>
                <div className="text-2xl font-light text-white font-mono">{metrics.perimeterMeters.toLocaleString()} <span className="text-sm text-white/50">m</span></div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Completed</div>
                <div className="text-2xl font-light text-emerald-400 font-mono">{progressPercentage}%</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 col-span-2">
                <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Est. Days Remaining</div>
                <div className="text-2xl font-light text-white font-mono">{daysRemaining} <span className="text-sm text-white/50">days</span></div>
              </div>
            </div>

            {/* Settings */}
            <div className="flex flex-col gap-3">
              <label className="text-white/80 text-sm font-medium">Contractor Commitment (m/day)</label>
              <input
                type="number"
                value={contractorCommitment}
                onChange={(e) => setContractorCommitment(Number(e.target.value))}
                className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Add Progress */}
            <div className="flex flex-col gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="text-white font-medium mb-2">Log Daily Progress</h3>
              <input
                type="number"
                placeholder="Meters completed today"
                value={newProgressMeters}
                onChange={(e) => setNewProgressMeters(e.target.value)}
                className="bg-black/40 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={newProgressNotes}
                onChange={(e) => setNewProgressNotes(e.target.value)}
                className="bg-black/40 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleAddProgress}
                disabled={!newProgressMeters}
                className="mt-2 flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                <Plus size={16} />
                <span>Submit for Review</span>
              </button>
            </div>

            {/* History */}
            <div className="flex flex-col gap-4">
              <h3 className="text-white/80 font-medium">Progress History</h3>
              {dailyProgress.length === 0 ? (
                <p className="text-white/40 text-sm">No progress logged yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {dailyProgress.slice().reverse().map(p => (
                    <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-white font-medium">{p.metersCompleted} meters</div>
                          <div className="text-white/40 text-xs">{new Date(p.date).toLocaleDateString()}</div>
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full ${
                          p.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                          p.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </div>
                      </div>
                      {p.notes && <p className="text-white/60 text-sm">{p.notes}</p>}
                      
                      {p.status === 'pending' && (
                        <div className="flex gap-2 mt-2 pt-3 border-t border-white/10">
                          <button
                            onClick={() => handleUpdateProgressStatus(p.id, 'approved')}
                            className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 py-1.5 rounded-lg text-sm transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleUpdateProgressStatus(p.id, 'rejected')}
                            className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-1.5 rounded-lg text-sm transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Glass Overlay UI */}
      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6">
        {/* Top Bar */}
        <div className="flex justify-between items-start pointer-events-auto gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-3 bg-black/40 hover:bg-black/60 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all shadow-2xl"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 shadow-2xl">
              <h1 className="text-2xl font-semibold tracking-tight text-white/90">{site.name}</h1>
              <p className="text-white/50 text-sm mt-0.5">
                {isDrawing ? 'Click map to draw' : 'Drawing saved'}
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md relative hidden md:block">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 shadow-2xl"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
              )}
            </form>
            
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectLocation(result.lat, result.lon)}
                    className="w-full text-left px-4 py-3 hover:bg-white/10 text-white/80 text-sm border-b border-white/5 last:border-0 transition-colors"
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProgressPanel(true)}
              className="flex items-center gap-2 px-4 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-2xl backdrop-blur-xl border border-indigo-500/30 transition-all shadow-2xl font-medium"
              title="Track Progress"
            >
              <Activity size={18} />
              <span className="hidden sm:inline">Progress</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowTileSettings(!showTileSettings)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl backdrop-blur-xl border transition-all shadow-2xl font-medium ${
                  showCustomTiles ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
                title="Custom Drone Tiles"
              >
                <Layers size={18} />
                <span className="hidden sm:inline">Drone Layer</span>
                <Settings size={14} className="ml-1 opacity-50" />
              </button>

              {showTileSettings && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl z-50">
                  <h4 className="text-white font-medium mb-2">Custom Tile Layer</h4>
                  <p className="text-white/50 text-xs mb-4">
                    Enter the URL template for your Cloudflare R2 / S3 bucket tiles, or select a preset.
                    <br/><br/>
                    Format: <code className="bg-white/10 px-1 rounded">https://your-bucket.r2.dev/site-id/&#123;z&#125;/&#123;x&#125;/&#123;y&#125;.png</code>
                  </p>
                  
                  <div className="mb-4">
                    <button
                      onClick={() => setCustomTileUrl('https://tiles.openaerialmap.org/6997a0554555c9ccdd1be537/0/6997a0554555c9ccdd1be538/{z}/{x}/{y}')}
                      className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-white/80 transition-colors w-full text-left flex items-center justify-between"
                    >
                      <span>Use OpenAerialMap Preset</span>
                      <Layers size={12} />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={customTileUrl}
                    onChange={(e) => setCustomTileUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-black/40 border border-white/20 rounded-xl px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={showCustomTiles}
                        onChange={(e) => setShowCustomTiles(e.target.checked)}
                        disabled={!customTileUrl}
                        className="rounded border-white/20 bg-black/40 text-indigo-500 focus:ring-indigo-500/50"
                      />
                      Enable Layer
                    </label>
                    <button 
                      onClick={() => setShowTileSettings(false)}
                      className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-white transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-xl border border-white/20 transition-all shadow-2xl font-medium"
            >
              <Save size={18} />
              <span className="hidden sm:inline">Save</span>
            </button>
          </div>
        </div>

        {/* Bottom Bar / Tools */}
        <div className="flex flex-col md:flex-row justify-between items-end pointer-events-auto gap-4">
          {/* Metrics Panel */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl w-full md:w-80 flex flex-col gap-6">
            <h3 className="text-white/80 font-medium text-sm uppercase tracking-wider">Site Metrics</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-wider">
                  <Ruler size={14} />
                  <span>Length</span>
                </div>
                <span className="text-2xl font-light text-white font-mono">
                  {metrics.perimeterMeters.toLocaleString()} <span className="text-sm text-white/50">m</span>
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-wider">
                  <Clock size={14} />
                  <span>Walk Time</span>
                </div>
                <span className="text-2xl font-light text-white font-mono">
                  {metrics.estimatedWalkTimeMinutes} <span className="text-sm text-white/50">min</span>
                </span>
              </div>

              <div className="flex flex-col gap-1 col-span-2 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-wider">
                  <MapPin size={14} />
                  <span>Vertices</span>
                </div>
                <span className="text-xl font-light text-white font-mono">
                  {metrics.vertexCount}
                </span>
              </div>
            </div>
          </div>

          {/* Drawing Controls */}
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full p-2 shadow-2xl self-center md:self-end">
            <button
              onClick={() => setSnapToPoints(!snapToPoints)}
              className={`p-4 rounded-full transition-all ${snapToPoints ? 'text-indigo-400 bg-indigo-500/20' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
              title={snapToPoints ? "Disable Snapping" : "Enable Snapping"}
            >
              <Magnet size={20} />
            </button>
            <div className="w-px h-8 bg-white/10 mx-2" />
            <button
              onClick={() => setIsClosed(!isClosed)}
              className="flex items-center gap-2 px-4 py-4 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
              title={isClosed ? "Switch to Open Path" : "Switch to Closed Loop"}
            >
              {isClosed ? <ToggleRight size={24} className="text-emerald-400" /> : <ToggleLeft size={24} className="text-white/40" />}
              <span className="text-sm font-medium hidden md:inline">{isClosed ? "Closed Loop" : "Open Path"}</span>
            </button>
            <div className="w-px h-8 bg-white/10 mx-2" />
            <button
              onClick={handleUndo}
              disabled={points.length === 0 || isFinished}
              className="p-4 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all disabled:opacity-30 disabled:hover:bg-transparent"
              title="Undo last point"
            >
              <Undo size={20} />
            </button>
            <button
              onClick={handleClear}
              disabled={points.length === 0}
              className="p-4 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-full transition-all disabled:opacity-30 disabled:hover:bg-transparent"
              title="Clear all"
            >
              <Trash2 size={20} />
            </button>
            <div className="w-px h-8 bg-white/10 mx-2" />
            <button
              onClick={handleFinish}
              disabled={points.length < 2 || isFinished}
              className="flex items-center gap-2 px-6 py-4 bg-emerald-500/90 hover:bg-emerald-500 text-white rounded-full transition-all disabled:opacity-30 disabled:hover:bg-emerald-500/90 font-medium"
            >
              <Check size={20} />
              <span className="hidden sm:inline">{isClosed ? "Finish Polygon" : "Finish Path"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

