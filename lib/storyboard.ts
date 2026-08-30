"use client";
import { useCallback, useMemo, useState } from "react";
import type { CinematicState } from "@/lib/cinematic";
import { DEFAULT_STATE } from "@/lib/cinematic";
export interface StoryboardScene {
  id: string;
  idx: number;
  sceneText: string;
  cinematicState: CinematicState;
  imagePrompt: string;
  videoPrompt: string;
  imageRef?: string;
  imageUrl?: string;
  imageName?: string;
  videoUrl?: string;
  videoName?: string;
}
export interface StoryboardProject {
  id: string;
  title: string;
  storyText: string;
  scenes: StoryboardScene[];
  createdAt: number;
  splitDone?: boolean;
  lastBatchSize?: number;
}
const hasWindow = typeof window !== "undefined";
function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function sk(email: string) {
  return `promptforge_storyboards_${email}`;
}
function ak(email: string) {
  return `promptforge_activeStoryboard_${email}`;
}
function load(email: string): StoryboardProject[] {
  if (!hasWindow) return [];
  try {
    const raw = localStorage.getItem(sk(email));
    return raw ? (JSON.parse(raw) as StoryboardProject[]) : [];
  } catch {
    return [];
  }
}
function persist(email: string, list: StoryboardProject[]) {
  if (!hasWindow) return;
  try {
    localStorage.setItem(sk(email), JSON.stringify(list));
  } catch {}
}
function saveActive(email: string, id: string | null) {
  if (!hasWindow) return;
  if (id === null) localStorage.removeItem(ak(email));
  else localStorage.setItem(ak(email), id);
}
export function makeStoryboardScene(idx: number, sceneText: string, template: CinematicState): StoryboardScene {
  return {
    id: uid(),
    idx,
    sceneText,
    cinematicState: { ...template, scene: sceneText, sceneRef: template.sceneRef, sceneInfluence: template.sceneInfluence },
    imagePrompt: "",
    videoPrompt: "",
  };
}
export function makeStoryboardProject(title: string): StoryboardProject {
  return {
    id: uid(),
    title: title.trim() || "Untitled Storyboard",
    storyText: "",
    scenes: [],
    createdAt: Date.now(),
  };
}
export const STORY_SPLIT_SYSTEM_PROMPT = `You are a storyboard assistant. Split the user's full story into ordered cinematic scenes.
Rules:
- Output ONLY a JSON array of strings, each string is one scene description (2-4 sentences, vivid, includes characters, location, action, mood).
- Keep characters consistent, preserve order of narrative.
- No numbering prefix, no extra keys, no markdown fences, just JSON: ["scene 1 text","scene 2 text",...]
- Each scene must be self-contained but flow to next, suitable for image then video prompt generation.`;
export function buildSplitPrompt(storyText: string, batchSize: number, alreadyCount: number, previousScenes: string[]): string {
  if (alreadyCount === 0) return `FULL STORY:\n${storyText}\n\nSplit into FIRST ${batchSize} scenes only (scenes 1-${batchSize}). Output JSON array of ${batchSize} strings. If story ends before ${batchSize}, output fewer.`;
  return `FULL STORY:\n${storyText}\n\nAlready generated ${alreadyCount} scenes:\n${previousScenes.map((s, i) => `${i + 1}. ${s.slice(0, 120)}...`).join("\n")}\n\nGenerate NEXT ${batchSize} scenes continuing immediately after scene ${alreadyCount} (scenes ${alreadyCount + 1}-${alreadyCount + batchSize}). Do NOT repeat already covered plot. Continue narrative until story end. If story ends before ${batchSize} scenes, output only remaining scenes. Output JSON array only.`;
}
export function estimateBatches(storyText: string, batchSize: number): number {
  const words = storyText.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 120));
}
export function parseSplitResult(text: string): string[] {
  const t = text.trim();
  try {
    const arr = JSON.parse(t);
    if (Array.isArray(arr)) return arr.map((s) => String(s).trim()).filter(Boolean);
  } catch {}
  const fence = t.match(/\[([\s\S]*)\]/);
  if (fence) {
    try {
      const arr = JSON.parse(fence[0]);
      if (Array.isArray(arr)) return arr.map((s) => String(s).trim()).filter(Boolean);
    } catch {}
  }
  return t
    .split(/\n+/)
    .map((s) => s.replace(/^\s*(scene\s*\d+[:.-]\s*|\d+[\).]\s*)/i, "").trim())
    .filter((s) => s.length > 20);
}
export interface StoryboardApi {
  projects: StoryboardProject[];
  activeProject: StoryboardProject | null;
  selectProject: (id: string) => void;
  createProject: (title: string) => StoryboardProject;
  duplicateProject: (id: string) => void;
  renameProject: (title: string) => void;
  deleteProject: (id: string) => void;
  setStoryText: (text: string) => void;
  setScenes: (updater: (prev: StoryboardScene[]) => StoryboardScene[]) => void;
  updateScene: (sceneId: string, patch: Partial<StoryboardScene>) => void;
  setSplitDone: (done: boolean, batchSize?: number) => void;
  setEnvironment: (preset: import("@/lib/cinematic").EnvPreset) => void;
}
export function useStoryboardProjects(email: string): StoryboardApi {
  const [version, setVersion] = useState(0);
  const projects = useMemo<StoryboardProject[]>(() => {
    if (!hasWindow) return [];
    const list = load(email);
    if (list.length === 0) {
      const fresh = [makeStoryboardProject("My Storyboard")];
      persist(email, fresh);
      return fresh;
    }
    return list;
  }, [email, version]);
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (!hasWindow) return null;
    const list = load(email);
    if (list.length === 0) return null;
    const saved = localStorage.getItem(ak(email));
    if (saved && list.some((p) => p.id === saved)) return saved;
    return list[0]?.id ?? null;
  });
  const activeProject = useMemo(() => projects.find((p) => p.id === activeId) ?? projects[0] ?? null, [projects, activeId]);
  const bump = useCallback(
    (next: StoryboardProject[]) => {
      persist(email, next);
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
    (title: string) => {
      const p = makeStoryboardProject(title);
      bump([...projects, p]);
      setActiveId(p.id);
      saveActive(email, p.id);
      return p;
    },
    [projects, bump, email]
  );
  const renameProject = useCallback(
    (title: string) => {
      if (!activeProject || !title.trim()) return;
      bump(projects.map((p) => (p.id === activeProject.id ? { ...p, title: title.trim() } : p)));
    },
    [activeProject, projects, bump]
  );
  const deleteProject = useCallback(
    (id: string) => {
      let next = projects.filter((p) => p.id !== id);
      if (next.length === 0) next = [makeStoryboardProject("My Storyboard")];
      bump(next);
      if (activeId === id) {
        setActiveId(next[0].id);
        saveActive(email, next[0].id);
      }
    },
    [projects, activeId, bump, email]
  );
  const setStoryText = useCallback(
    (text: string) => {
      if (!activeProject) return;
      bump(projects.map((p) => (p.id === activeProject.id ? { ...p, storyText: text } : p)));
    },
    [activeProject, projects, bump]
  );
  const setScenes = useCallback(
    (updater: (prev: StoryboardScene[]) => StoryboardScene[]) => {
      if (!activeProject) return;
      bump(projects.map((p) => (p.id === activeProject.id ? { ...p, scenes: updater(p.scenes) } : p)));
    },
    [activeProject, projects, bump]
  );
  const updateScene = useCallback(
    (sceneId: string, patch: Partial<StoryboardScene>) => {
      if (!activeProject) return;
      bump(
        projects.map((p) =>
          p.id === activeProject.id ? { ...p, scenes: p.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)) } : p
        )
      );
    },
    [activeProject, projects, bump]
  );
  const setSplitDone = useCallback(
    (done: boolean, batchSize?: number) => {
      if (!activeProject) return;
      bump(projects.map((p) => (p.id === activeProject.id ? { ...p, splitDone: done, lastBatchSize: batchSize ?? p.lastBatchSize } : p)));
    },
    [activeProject, projects, bump]
  );
  const duplicateProject = useCallback(
    (id: string) => {
      const src = projects.find((p) => p.id === id);
      if (!src) return;
      const copy: StoryboardProject = {
        ...src,
        id: uid(),
        title: `Copy of ${src.title}`,
        createdAt: Date.now(),
        scenes: src.scenes.map((s, idx) => ({ ...s, id: uid(), idx })),
      };
      bump([...projects, copy]);
      setActiveId(copy.id);
      saveActive(email, copy.id);
    },
    [projects, bump, email]
  );
  const setEnvironment = useCallback(
    (preset: import("@/lib/cinematic").EnvPreset) => {
      if (!activeProject) return;
      bump(
        projects.map((p) =>
          p.id === activeProject.id
            ? {
                ...p,
                scenes: p.scenes.map((s) => ({
                  ...s,
                  cinematicState: { ...s.cinematicState, timeOfDay: preset.timeOfDay, colorTemp: preset.colorTemp, shadows: preset.shadows, vibe: preset.vibe },
                })),
              }
            : p
        )
      );
    },
    [activeProject, projects, bump]
  );
  return { projects, activeProject, selectProject, createProject, duplicateProject, renameProject, deleteProject, setStoryText, setScenes, updateScene, setSplitDone, setEnvironment };
}
