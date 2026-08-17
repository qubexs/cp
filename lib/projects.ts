"use client";

import { useCallback, useMemo, useState } from "react";

export interface ProjectScene {
  id: string;
  imageUrl?: string;
  imageName?: string;
  prompt: string;
}

export interface ProjectVideo {
  key: string;
  imageUrl?: string;
  imageName?: string;
  prompt: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  scenes: ProjectScene[];
  videos: ProjectVideo[];
}

const hasWindow = typeof window !== "undefined";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newSceneRow(): ProjectScene {
  return { id: uid(), prompt: "" };
}

export function newVideoRow(srcId: string, dstId: string): ProjectVideo {
  return { key: `${srcId}->${dstId}`, prompt: "" };
}

export function sceneLabel(index: number): string {
  return `Scene ${index + 1}`;
}

export function videoLabel(index: number): string {
  return `Scene Video Stage ${index + 1}`;
}

function storageKey(email: string): string {
  return `promptforge_projects_${email}`;
}

function activeKey(email: string): string {
  return `promptforge_activeproject_${email}`;
}

function loadProjects(email: string): Project[] {
  if (!hasWindow) return [];
  try {
    const raw = localStorage.getItem(storageKey(email));
    const list = raw ? (JSON.parse(raw) as Project[]) : [];
    return list.map((p) => ({ ...p, scenes: p.scenes ?? [], videos: p.videos ?? [] }));
  } catch {
    return [];
  }
}

function persistProjects(email: string, projects: Project[]) {
  if (!hasWindow) return;
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(projects));
  } catch {
    /* storage full or blocked */
  }
}

function saveActive(email: string, id: string | null) {
  if (!hasWindow) return;
  if (id === null) localStorage.removeItem(activeKey(email));
  else localStorage.setItem(activeKey(email), id);
}

export function makeProject(name: string): Project {
  const a = newSceneRow();
  const b = newSceneRow();
  return {
    id: uid(),
    name: name.trim() || "Untitled project",
    createdAt: Date.now(),
    scenes: [a, b],
    videos: [newVideoRow(a.id, b.id)],
  };
}

export function pruneVideosForScenes(
  scenes: ProjectScene[],
  videos: ProjectVideo[]
): ProjectVideo[] {
  const keys = new Set<string>();
  for (let i = 0; i < scenes.length - 1; i++) {
    keys.add(`${scenes[i].id}->${scenes[i + 1].id}`);
  }
  return videos.filter((v) => keys.has(v.key));
}

export interface ProjectsApi {
  projects: Project[];
  activeProject: Project | null;
  selectProject: (id: string) => void;
  createProject: (name: string) => Project;
  renameProject: (name: string) => void;
  deleteProject: (id: string) => void;
  setScenes: (updater: (prev: ProjectScene[]) => ProjectScene[]) => void;
  setVideos: (updater: (prev: ProjectVideo[]) => ProjectVideo[]) => void;
}

export function useProjects(email: string): ProjectsApi {
  const [version, setVersion] = useState(0);

  const projects = useMemo<Project[]>(() => {
    if (!hasWindow) return [];
    const list = loadProjects(email);
    if (list.length === 0) {
      const fresh = [makeProject("Project 1")];
      persistProjects(email, fresh);
      return fresh;
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, version]);

  const [activeId, setActiveId] = useState<string | null>(() => {
    if (!hasWindow) return null;
    const list = loadProjects(email);
    if (list.length === 0) return null;
    const saved = localStorage.getItem(activeKey(email));
    if (saved && list.some((p) => p.id === saved)) return saved;
    return list[0].id;
  });

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeId) ?? projects[0] ?? null,
    [projects, activeId]
  );

  const persist = useCallback(
    (next: Project[]) => {
      persistProjects(email, next);
      setVersion((v) => v + 1);
    },
    [email]
  );

  const selectProject = useCallback(
    (id: string) => {
      setActiveId(id);
      saveActive(email, id);
    },
    [email]
  );

  const createProject = useCallback(
    (name: string): Project => {
      const p = makeProject(name);
      persist([...projects, p]);
      setActiveId(p.id);
      saveActive(email, p.id);
      return p;
    },
    [projects, persist, email]
  );

  const renameProject = useCallback(
    (name: string) => {
      if (!activeProject) return;
      if (!name.trim()) return;
      persist(
        projects.map((p) => (p.id === activeProject.id ? { ...p, name: name.trim() } : p))
      );
    },
    [activeProject, projects, persist]
  );

  const deleteProject = useCallback(
    (id: string) => {
      let next = projects.filter((p) => p.id !== id);
      if (next.length === 0) {
        next = [makeProject("Project 1")];
      }
      persist(next);
      if (activeId === id) {
        setActiveId(next[0].id);
        saveActive(email, next[0].id);
      }
    },
    [projects, activeId, persist, email]
  );

  const updateActive = useCallback(
    (patch: Partial<Project>) => {
      if (!activeProject) return;
      persist(
        projects.map((p) =>
          p.id === activeProject.id ? { ...p, ...patch } : p
        )
      );
    },
    [activeProject, projects, persist]
  );

  const setScenes = useCallback(
    (updater: (prev: ProjectScene[]) => ProjectScene[]) => {
      if (!activeProject) return;
      const scenes = updater(activeProject.scenes);
      updateActive({
        scenes,
        videos: pruneVideosForScenes(scenes, activeProject.videos),
      });
    },
    [activeProject, updateActive]
  );

  const setVideos = useCallback(
    (updater: (prev: ProjectVideo[]) => ProjectVideo[]) => {
      if (!activeProject) return;
      updateActive({ videos: updater(activeProject.videos) });
    },
    [activeProject, updateActive]
  );

  return {
    projects,
    activeProject,
    selectProject,
    createProject,
    renameProject,
    deleteProject,
    setScenes,
    setVideos,
  };
}