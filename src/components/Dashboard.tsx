import React, { useState } from 'react';
import { Plus, Folder, ChevronRight, Map as MapIcon, Trash2, ClipboardList, Truck } from 'lucide-react';
import { Project } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface DashboardProps {
  projects: Project[];
  onProjectSelect: (project: Project) => void;
  onCreateProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onMaterialReconciliation: () => void;
  onFleetManagement: () => void;
}

export function Dashboard({ projects, onProjectSelect, onCreateProject, onDeleteProject, onMaterialReconciliation, onFleetManagement }: DashboardProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newProjectName.trim()) return;
    const newProject: Project = {
      id: uuidv4(),
      name: newProjectName,
      description: '',
      createdAt: Date.now(),
      sites: [],
    };
    onCreateProject(newProject);
    setNewProjectName('');
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-semibold tracking-tight text-white/90">Projects</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={onFleetManagement}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-full backdrop-blur-md border border-indigo-500/20 transition-all shadow-lg"
          >
            <Truck size={20} />
            <span className="hidden sm:inline">Fleet</span>
          </button>
          <button
            onClick={onMaterialReconciliation}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-full backdrop-blur-md border border-amber-500/20 transition-all shadow-lg"
          >
            <ClipboardList size={20} />
            <span className="hidden sm:inline">Material</span>
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-md border border-white/10 transition-all shadow-lg"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">New Project</span>
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="p-6 bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-3xl shadow-2xl flex gap-4 items-center">
          <input
            autoFocus
            type="text"
            placeholder="Project Name..."
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
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
        {projects.map((project) => (
          <div
            key={project.id}
            className="group p-6 bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-xl border border-white/[0.05] hover:border-white/[0.15] rounded-3xl shadow-xl transition-all duration-300 flex flex-col gap-4"
          >
            {confirmDeleteId === project.id ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-white/80 text-sm text-center">Delete <strong>{project.name}</strong>?<br /><span className="text-white/50">All sites will be removed.</span></p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { onDeleteProject(project.id); setConfirmDeleteId(null); }}
                    className="px-5 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-xl text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="cursor-pointer" onClick={() => onProjectSelect(project)}>
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-white/5 rounded-2xl text-white/70 group-hover:text-white group-hover:scale-110 transition-all">
                      <Folder size={28} strokeWidth={1.5} />
                    </div>
                    <ChevronRight className="text-white/30 group-hover:text-white/70 transition-colors" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-xl font-medium text-white/90">{project.name}</h3>
                    <p className="text-white/50 text-sm mt-1 flex items-center gap-2">
                      <MapIcon size={14} />
                      {project.sites.length} {project.sites.length === 1 ? 'Site' : 'Sites'}
                    </p>
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-white/10 flex justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                    className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                    title="Delete project"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {projects.length === 0 && !isCreating && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-white/40 border-2 border-dashed border-white/10 rounded-3xl">
            <Folder size={48} className="mb-4 opacity-50" strokeWidth={1} />
            <p className="text-lg">No projects yet.</p>
            <p className="text-sm">Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
