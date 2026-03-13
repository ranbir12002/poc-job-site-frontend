/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProjectView } from './components/ProjectView';
import { SiteEditor } from './components/SiteEditor';
import { SiteRecorder } from './components/SiteRecorder';
import { StreetView } from './components/StreetView';
import { SiteWalkthrough } from './components/SiteWalkthrough';
import { SignIn } from './components/SignIn';
import { PipeInventory } from './components/PipeInventory';
import { MaterialReconciliation } from './components/MaterialReconciliation';
import { FleetManagement } from './components/FleetManagement';
import { Project, Site } from './types';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentSite, setCurrentSite] = useState<Site | null>(null);
  const [currentStreetViewSite, setCurrentStreetViewSite] = useState<Site | null>(null);
  const [recordingSite, setRecordingSite] = useState<Site | 'new' | null>(null);
  const [currentProjectInventory, setCurrentProjectInventory] = useState(false);
  const [showMaterialReconciliation, setShowMaterialReconciliation] = useState(false);
  const [showFleetManagement, setShowFleetManagement] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      } else {
        // Fallback for demo if backend not connected
        console.warn('Backend not connected, using local state');
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (project: Project) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (res.ok) {
        const newProject = await res.json();
        setProjects([...projects, newProject]);
      } else {
        // Fallback
        setProjects([...projects, project]);
      }
    } catch (err) {
      setProjects([...projects, project]);
    }
  };

  const handleCreateSite = async (site: Site) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(site),
      });

      let newSite = site;
      if (res.ok) {
        newSite = await res.json();
      }

      const updatedProject = {
        ...currentProject,
        sites: [...currentProject.sites, newSite],
      };
      setProjects(projects.map((p) => (p.id === currentProject.id ? updatedProject : p)));
      setCurrentProject(updatedProject);
    } catch (err) {
      // Fallback
      const updatedProject = {
        ...currentProject,
        sites: [...currentProject.sites, site],
      };
      setProjects(projects.map((p) => (p.id === currentProject.id ? updatedProject : p)));
      setCurrentProject(updatedProject);
    }
  };

  const handleSaveSite = async (updatedSite: Site) => {
    if (!currentProject) return;
    try {
      await fetch(`/api/sites/${updatedSite.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSite),
      });
    } catch (err) {
      console.error('Failed to save site:', err);
    }

    const updatedProject = {
      ...currentProject,
      sites: currentProject.sites.map((s) => (s.id === updatedSite.id ? updatedSite : s)),
    };
    setProjects(projects.map((p) => (p.id === currentProject.id ? updatedProject : p)));
    setCurrentProject(updatedProject);
    setCurrentSite(null); // Go back to project view
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    try {
      await fetch(`/api/projects/${updatedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProject),
      });
    } catch (err) {
      console.error('Failed to update project:', err);
    }
    setProjects(projects.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
    setCurrentProject(updatedProject);
  };

  const handleApproveSite = async () => {
    if (!currentProject || !currentStreetViewSite) return;
    const approvedSite = { ...currentStreetViewSite, approved: true };
    try {
      await fetch(`/api/sites/${approvedSite.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvedSite),
      });
    } catch (err) {
      console.error('Failed to approve site:', err);
    }

    const updatedProject = {
      ...currentProject,
      sites: currentProject.sites.map((s) => (s.id === approvedSite.id ? approvedSite : s)),
    };
    setProjects(projects.map((p) => (p.id === currentProject.id ? updatedProject : p)));
    setCurrentProject(updatedProject);
    setCurrentStreetViewSite(approvedSite);
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
    setProjects(projects.filter((p) => p.id !== projectId));
    if (currentProject?.id === projectId) {
      setCurrentProject(null);
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    if (!currentProject) return;
    try {
      await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete site:', err);
    }
    const updatedProject = {
      ...currentProject,
      sites: currentProject.sites.filter((s) => s.id !== siteId),
    };
    setProjects(projects.map((p) => (p.id === currentProject.id ? updatedProject : p)));
    setCurrentProject(updatedProject);
  };

  if (!isAuthenticated) {
    return <SignIn onSignIn={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] overflow-hidden relative font-sans text-slate-100 selection:bg-white/20">
      {/* Abstract Glass Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-fuchsia-500/10 rounded-full blur-[150px]" />
        <div className="absolute top-[30%] right-[20%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[100px]" />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 h-screen w-full p-2 md:p-6 flex items-center justify-center">
        <div className="w-full max-w-[98%] xl:max-w-[95%] h-[95vh] bg-white/[0.02] backdrop-blur-3xl border border-white/[0.05] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">
          {!currentProject && !currentSite && !currentStreetViewSite && !recordingSite && !currentProjectInventory && !showMaterialReconciliation && !showFleetManagement && (
            <Dashboard
              projects={projects}
              onProjectSelect={setCurrentProject}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onMaterialReconciliation={() => setShowMaterialReconciliation(true)}
              onFleetManagement={() => setShowFleetManagement(true)}
            />
          )}

          {showFleetManagement && (
            <FleetManagement onBack={() => setShowFleetManagement(false)} />
          )}

          {showMaterialReconciliation && (
            <MaterialReconciliation onBack={() => setShowMaterialReconciliation(false)} />
          )}

          {currentProject && !currentSite && !currentStreetViewSite && !recordingSite && !currentProjectInventory && (
            <ProjectView
              project={currentProject}
              onBack={() => setCurrentProject(null)}
              onSiteSelect={setCurrentSite}
              onStreetViewSelect={setCurrentStreetViewSite}
              onCreateSite={handleCreateSite}
              onRecordSite={(site?: Site) => setRecordingSite(site || 'new')}
              onViewInventory={() => setCurrentProjectInventory(true)}
              onDeleteSite={handleDeleteSite}
              onUpdateSite={handleSaveSite}
            />
          )}

          {currentProject && currentProjectInventory && (
            <PipeInventory
              project={currentProject}
              onBack={() => setCurrentProjectInventory(false)}
              onUpdateProject={handleUpdateProject}
            />
          )}

          {currentProject && currentSite && !recordingSite && (
            <SiteEditor
              site={currentSite}
              onBack={() => setCurrentSite(null)}
              onSave={handleSaveSite}
            />
          )}

          {currentProject && currentStreetViewSite && !recordingSite && (
            currentStreetViewSite.metrics?.tourNodes && currentStreetViewSite.metrics.tourNodes.length > 0 ? (
              <SiteWalkthrough
                site={currentStreetViewSite}
                onClose={() => setCurrentStreetViewSite(null)}
                onApprove={handleApproveSite}
              />
            ) : (
              <StreetView
                site={currentStreetViewSite}
                onClose={() => setCurrentStreetViewSite(null)}
                onApprove={handleApproveSite}
              />
            )
          )}

          {currentProject && recordingSite && (
            <SiteRecorder
              existingSite={recordingSite === 'new' ? undefined : recordingSite}
              onBack={() => setRecordingSite(null)}
              onSave={(site) => {
                if (recordingSite === 'new') {
                  handleCreateSite(site);
                } else {
                  handleSaveSite(site);
                }
                setRecordingSite(null);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

