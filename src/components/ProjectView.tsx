import React, { useState } from 'react';
import { ArrowLeft, Plus, MapPin, ChevronRight, Ruler, Clock, Video, Layers, Eye } from 'lucide-react';
import { Project, Site } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface ProjectViewProps {
  project: Project;
  onBack: () => void;
  onSiteSelect: (site: Site) => void;
  onStreetViewSelect: (site: Site) => void;
  onCreateSite: (site: Site) => void;
  onRecordSite: () => void;
}

export function ProjectView({ project, onBack, onSiteSelect, onStreetViewSelect, onCreateSite, onRecordSite }: ProjectViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');

  const handleCreate = () => {
    if (!newSiteName.trim()) return;
    const newSite: Site = {
      id: uuidv4(),
      name: newSiteName,
      createdAt: Date.now(),
      points: [],
      metrics: {
        perimeterMeters: 0,
        vertexCount: 0,
        estimatedWalkTimeMinutes: 0,
      },
      isClosed: true,
    };
    onCreateSite(newSite);
    setNewSiteName('');
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-md border border-white/10 transition-all shadow-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-4xl font-semibold tracking-tight text-white/90">{project.name}</h1>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <button
            onClick={onRecordSite}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full backdrop-blur-md border border-red-500/20 transition-all shadow-lg"
          >
            <Video size={20} />
            <span className="hidden sm:inline">Record Site</span>
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-md border border-white/10 transition-all shadow-lg"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">New Site</span>
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="p-6 bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-3xl shadow-2xl flex gap-4 items-center">
          <input
            autoFocus
            type="text"
            placeholder="Site Name..."
            value={newSiteName}
            onChange={(e) => setNewSiteName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <button
            onClick={handleCreate}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
          >
            Create
          </button>
          <button
            onClick={() => setIsCreating(false)}
            className="px-6 py-3 bg-transparent hover:bg-white/5 text-white/70 hover:text-white rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {project.sites.map((site) => (
          <div
            key={site.id}
            className="group p-6 bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-xl border border-white/[0.05] hover:border-white/[0.15] rounded-3xl shadow-xl transition-all duration-300 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-white/5 rounded-2xl text-white/70 group-hover:text-white group-hover:scale-110 transition-all">
                <MapPin size={28} strokeWidth={1.5} />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-medium text-white/90">{site.name}</h3>
              <div className="flex items-center gap-4 mt-3 text-white/50 text-sm">
                <div className="flex items-center gap-1.5">
                  <Ruler size={14} />
                  <span>{site.metrics.perimeterMeters.toLocaleString()} m</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} />
                  <span>{site.metrics.estimatedWalkTimeMinutes} min</span>
                </div>
              </div>
            </div>

            <div className="mt-2 flex gap-3 pt-4 border-t border-white/10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSiteSelect(site);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl transition-colors text-sm font-medium"
              >
                <Layers size={16} />
                Map View
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStreetViewSelect(site);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl transition-colors text-sm font-medium"
              >
                <Eye size={16} />
                Street View
              </button>
            </div>
          </div>
        ))}
        {project.sites.length === 0 && !isCreating && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-white/40 border-2 border-dashed border-white/10 rounded-3xl">
            <MapPin size={48} className="mb-4 opacity-50" strokeWidth={1} />
            <p className="text-lg">No sites yet.</p>
            <p className="text-sm">Create one to start drawing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
