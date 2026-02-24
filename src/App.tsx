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
import { SignIn } from './components/SignIn';
import { Project, Site } from './types';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentSite, setCurrentSite] = useState<Site | null>(null);
  const [currentStreetViewSite, setCurrentStreetViewSite] = useState<Site | null>(null);
  const [isRecordingSite, setIsRecordingSite] = useState(false);
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
      <main className="relative z-10 h-screen w-full p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-7xl h-full bg-white/[0.02] backdrop-blur-3xl border border-white/[0.05] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">
          {!currentProject && !currentSite && !currentStreetViewSite && !isRecordingSite && (
            <Dashboard
              projects={projects}
              onProjectSelect={setCurrentProject}
              onCreateProject={handleCreateProject}
            />
          )}

          {currentProject && !currentSite && !currentStreetViewSite && !isRecordingSite && (
            <ProjectView
              project={currentProject}
              onBack={() => setCurrentProject(null)}
              onSiteSelect={setCurrentSite}
              onStreetViewSelect={setCurrentStreetViewSite}
              onCreateSite={handleCreateSite}
              onRecordSite={() => setIsRecordingSite(true)}
            />
          )}

          {currentProject && currentSite && !isRecordingSite && (
            <SiteEditor
              site={currentSite}
              onBack={() => setCurrentSite(null)}
              onSave={handleSaveSite}
            />
          )}

          {currentProject && currentStreetViewSite && !isRecordingSite && (
            <StreetView
              site={currentStreetViewSite}
              onClose={() => setCurrentStreetViewSite(null)}
            />
          )}

          {currentProject && isRecordingSite && (
            <SiteRecorder
              onBack={() => setIsRecordingSite(false)}
              onSave={(site) => {
                handleCreateSite(site);
                setIsRecordingSite(false);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

