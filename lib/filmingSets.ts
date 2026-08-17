"use client";

import { useCallback, useMemo, useState } from "react";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type SetObjectKind =
  | "box"
  | "sphere"
  | "cylinder"
  | "cone"
  | "capsule"
  | "rug"
  | "table"
  | "chair"
  | "fridge"
  | "shelf"
  | "light"
  | "crate"
  | "barrel"
  | "pillar"
  | "plant"
  | "bed"
  | "sofa"
  | "sink"
  | "stove"
  | "counter"
  | "door"
  | "window"
  | "stairs"
  | "character"
  | "wallseg"
  | "picture"
  | "glb";

export interface SetObject {
  id: string;
  kind: SetObjectKind;
  color: string;
  position: Vec3;
  rotY: number;
  scale: {
    x: number;
    y: number;
    z: number;
  };
  name: string;
  glb?: string;
  img?: string;
  orient?: "wall" | "floor";
  notes?: string;
}

export interface CamState {
  position: Vec3;
  target: Vec3;
  fov: number;
  roll: number;
}

export type WallpaperKind =
  | "none"
  | "plaster"
  | "brick"
  | "wood"
  | "tiles"
  | "stripes"
  | "dotted";

export type WallMode = 0 | 1 | 2 | 3 | 4;

export interface RoomState {
  width: number;
  depth: number;
  height: number;
  wallMode: WallMode;
  ceiling: boolean;
  grid: boolean;
  wallColor: string;
  wallpaper: WallpaperKind;
}

export interface KeyLight {
  color: string;
  intensity: number;
  x: number;
  y: number;
  z: number;
}

export interface EnvState {
  sky: string;
  fog: boolean;
  fogColor: string;
  ambient: { color: string; intensity: number };
  key: KeyLight | null;
  fill: { color: string; intensity: number } | null;
  prompt?: string;
}

export interface FilmingSet {
  id: string;
  name: string;
  createdAt: number;
  objects: SetObject[];
  camera: CamState;
  room: RoomState;
  environment: EnvState;
}

const PALETTE_ENTRIES: { kind: SetObjectKind; label: string; icon: string }[] = [
  { kind: "box", label: "Box", icon: "📦" },
  { kind: "sphere", label: "Sphere", icon: "🔮" },
  { kind: "cylinder", label: "Cylinder", icon: "🥫" },
  { kind: "cone", label: "Cone", icon: "📐" },
  { kind: "capsule", label: "Capsule", icon: "💊" },
  { kind: "crate", label: "Crate", icon: "🪵" },
  { kind: "barrel", label: "Barrel", icon: "🛢️" },
  { kind: "pillar", label: "Pillar", icon: "🏛️" },
  { kind: "plant", label: "Plant", icon: "🪴" },
  { kind: "rug", label: "Rug", icon: "🧺" },
  { kind: "table", label: "Table", icon: "🛋️" },
  { kind: "chair", label: "Chair", icon: "🪑" },
  { kind: "bed", label: "Bed", icon: "🛏️" },
  { kind: "sofa", label: "Sofa", icon: "🛋️" },
  { kind: "fridge", label: "Fridge", icon: "🧊" },
  { kind: "shelf", label: "Shelf", icon: "🗄️" },
  { kind: "sink", label: "Sink", icon: "🚰" },
  { kind: "stove", label: "Stove", icon: "🔥" },
  { kind: "counter", label: "Counter", icon: "🍳" },
  { kind: "door", label: "Door", icon: "🚪" },
  { kind: "window", label: "Window", icon: "🪟" },
  { kind: "stairs", label: "Stairs", icon: "🪜" },
  { kind: "light", label: "Light rig", icon: "💡" },
  { kind: "wallseg", label: "Wall panel", icon: "🧱" },
  { kind: "picture", label: "Picture", icon: "🖼️" },
  { kind: "character", label: "Character", icon: "🧍" },
];

export const SET_PALETTE = PALETTE_ENTRIES;

const DEFAULTS: Record<SetObjectKind, { color: string; name: string }> = {
  box: { color: "#a16207", name: "Box" },
  sphere: { color: "#7c3aed", name: "Ball" },
  cylinder: { color: "#0ea5e9", name: "Cylinder" },
  cone: { color: "#db2777", name: "Cone" },
  capsule: { color: "#10b981", name: "Capsule" },
  rug: { color: "#8b5cf6", name: "Rug" },
  table: { color: "#b45309", name: "Table" },
  chair: { color: "#dc2626", name: "Chair" },
  fridge: { color: "#64748b", name: "Fridge" },
  shelf: { color: "#92400e", name: "Shelf" },
  light: { color: "#fbbf24", name: "Light rig" },
  crate: { color: "#a16207", name: "Crate" },
  barrel: { color: "#92400e", name: "Barrel" },
  pillar: { color: "#a8a29e", name: "Pillar" },
  plant: { color: "#4d7c0f", name: "Plant" },
  bed: { color: "#7c3aed", name: "Bed" },
  sofa: { color: "#b91c1c", name: "Sofa" },
  sink: { color: "#94a3b8", name: "Sink" },
  stove: { color: "#57534e", name: "Stove" },
  counter: { color: "#a8a29e", name: "Counter" },
  door: { color: "#854d0e", name: "Door" },
  window: { color: "#3b82f6", name: "Window" },
  stairs: { color: "#78716c", name: "Stairs" },
  character: { color: "#eab308", name: "Character" },
  wallseg: { color: "#9ca3af", name: "Wall panel" },
  picture: { color: "#c4b5fd", name: "Picture" },
  glb: { color: "#e879f9", name: "GLB model" },
};

export const SET_SEED_COLORS = [
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#84cc16",
  "#fbbf24",
];

export const WALLPAPER_OPTIONS: { id: WallpaperKind; label: string }[] = [
  { id: "none", label: "Plain" },
  { id: "plaster", label: "Plaster" },
  { id: "brick", label: "Brick" },
  { id: "wood", label: "Wood planks" },
  { id: "tiles", label: "Tiles" },
  { id: "stripes", label: "Stripes" },
  { id: "dotted", label: "Dots" },
];

const DEFAULT_ROOM: RoomState = {
  width: 5,
  depth: 4,
  height: 2.6,
  wallMode: 4,
  ceiling: false,
  grid: true,
  wallColor: "#52525b",
  wallpaper: "none",
};

const DEFAULT_CAMERA: CamState = {
  position: { x: 0, y: 1.5, z: 3.4 },
  target: { x: 0, y: 1, z: 0 },
  fov: 50,
  roll: 0,
};

const DEFAULT_ENV: EnvState = {
  sky: "#0f1117",
  fog: false,
  fogColor: "#0f1117",
  ambient: { color: "#8b8b9e", intensity: 0.9 },
  key: { color: "#ffffff", intensity: 1.4, x: 4, y: 8, z: 3 },
  fill: { color: "#9fb6ff", intensity: 0.5 },
};

const hasWindow = typeof window !== "undefined";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function storageKey(email: string): string {
  return `promptforge_filmsets_${email}`;
}

function activeKey(email: string): string {
  return `promptforge_activefilmset_${email}`;
}

function newObject(kind: SetObjectKind, index: number): SetObject {
  const def = DEFAULTS[kind];
  return {
    id: uid(),
    kind,
    color: SET_SEED_COLORS[index % SET_SEED_COLORS.length],
    position: { x: 0, y: 0, z: 0 },
    rotY: 0,
    scale: { x: 1, y: 1, z: 1 },
    name: `${def.name} ${index + 1}`,
  };
}

export function makeFilmingSet(name: string): FilmingSet {
  const table = newObject("table", 0);
  table.position = { x: -1.2, y: 0, z: 0.6 };
  const chair = newObject("chair", 1);
  chair.position = { x: -1.2, y: 0, z: 1.6 };
  const character = newObject("character", 2);
  character.position = { x: 0.4, y: 0, z: -0.3 };
  const light = newObject("light", 3);
  light.position = { x: 0, y: 0, z: -0.2 };

  return {
    id: uid(),
    name: name.trim() || "Untitled filming set",
    createdAt: Date.now(),
    objects: [table, chair, character, light],
    camera: { ...DEFAULT_CAMERA },
    room: { ...DEFAULT_ROOM },
    environment: { ...DEFAULT_ENV },
  };
}

function normalizeRoom(src?: (Partial<RoomState> & { walls?: boolean }) | null): RoomState {
  const base: RoomState = { ...DEFAULT_ROOM, ...src };
  if (src && "walls" in src) {
    base.wallMode = src.walls ? 4 : 0;
  }
  return base;
}

function normalizeEnv(e?: Partial<EnvState>): EnvState {
  const base = {
    sky: e?.sky ?? DEFAULT_ENV.sky,
    fog: e?.fog ?? DEFAULT_ENV.fog,
    fogColor: e?.fogColor ?? DEFAULT_ENV.fogColor,
    ambient: { ...DEFAULT_ENV.ambient, ...(e?.ambient ?? {}) },
    key: e?.key === undefined ? { ...(DEFAULT_ENV.key as KeyLight) } : e.key,
    fill: e?.fill === undefined ? { ...(DEFAULT_ENV.fill as { color: string; intensity: number }) } : e.fill,
  };
  if (e?.prompt !== undefined) (base as EnvState).prompt = e.prompt;
  return base as EnvState;
}

function loadSets(email: string): FilmingSet[] {
  if (!hasWindow) return [];
  try {
    const raw = localStorage.getItem(storageKey(email));
    const list = raw ? (JSON.parse(raw) as FilmingSet[]) : [];
    return list.map((s) => ({
      ...s,
      objects: s.objects ?? [],
      camera: { ...DEFAULT_CAMERA, ...(s.camera ?? {}) },
      room: normalizeRoom(s.room),
      environment: normalizeEnv(s.environment),
    }));
  } catch {
    return [];
  }
}

function persistSets(email: string, sets: FilmingSet[]) {
  if (!hasWindow) return;
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(sets));
  } catch {
    /* storage full or blocked */
  }
}

function saveActive(email: string, id: string | null) {
  if (!hasWindow) return;
  if (id === null) localStorage.removeItem(activeKey(email));
  else localStorage.setItem(activeKey(email), id);
}

export interface FilmingSetsApi {
  sets: FilmingSet[];
  activeSet: FilmingSet | null;
  selectSet: (id: string) => void;
  createSet: (name: string) => FilmingSet;
  renameSet: (name: string) => void;
  deleteSet: (id: string) => void;
  updateSet: (patch: Partial<FilmingSet>) => void;
}

export function useFilmingSets(email: string): FilmingSetsApi {
  const [version, setVersion] = useState(0);

  const sets = useMemo<FilmingSet[]>(() => {
    if (!hasWindow) return [];
    const list = loadSets(email);
    if (list.length === 0) {
      const fresh = [makeFilmingSet("dapur atuk")];
      persistSets(email, fresh);
      return fresh;
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, version]);

  const [activeId, setActiveId] = useState<string | null>(() => {
    if (!hasWindow) return null;
    const list = loadSets(email);
    if (list.length === 0) return null;
    const saved = localStorage.getItem(activeKey(email));
    if (saved && list.some((s) => s.id === saved)) return saved;
    return list[0].id;
  });

  const activeSet = useMemo(
    () => sets.find((s) => s.id === activeId) ?? sets[0] ?? null,
    [sets, activeId]
  );

  const persist = useCallback(
    (next: FilmingSet[]) => {
      persistSets(email, next);
      setVersion((v) => v + 1);
    },
    [email]
  );

  const selectSet = useCallback(
    (id: string) => {
      setActiveId(id);
      saveActive(email, id);
    },
    [email]
  );

  const createSet = useCallback(
    (name: string): FilmingSet => {
      const s = makeFilmingSet(name);
      const next = [...sets, s];
      persist(next);
      setActiveId(s.id);
      saveActive(email, s.id);
      return s;
    },
    [sets, persist, email]
  );

  const renameSet = useCallback(
    (name: string) => {
      if (!activeSet) return;
      if (!name.trim()) return;
      persist(
        sets.map((s) => (s.id === activeSet.id ? { ...s, name: name.trim() } : s))
      );
    },
    [activeSet, sets, persist]
  );

  const deleteSet = useCallback(
    (id: string) => {
      let next = sets.filter((s) => s.id !== id);
      if (next.length === 0) next = [makeFilmingSet("dapur atuk")];
      persist(next);
      if (activeId === id) {
        setActiveId(next[0].id);
        saveActive(email, next[0].id);
      }
    },
    [sets, activeId, persist, email]
  );

  const updateSet = useCallback(
    (patch: Partial<FilmingSet>) => {
      if (!activeSet) return;
      persist(
        sets.map((s) => (s.id === activeSet.id ? { ...s, ...patch } : s))
      );
    },
    [activeSet, sets, persist]
  );

  return {
    sets,
    activeSet,
    selectSet,
    createSet,
    renameSet,
    deleteSet,
    updateSet,
  };
}