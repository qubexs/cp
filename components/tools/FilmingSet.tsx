"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import ProjectBar from "@/components/tools/ProjectBar";
import {
  advanceRotation,
  nextRotationOrder,
  updateKeyStatus,
  type Account,
} from "@/lib/auth";
import { chatWithKeys, OpenRouterError } from "@/lib/openrouter";
import {
  SET_PALETTE,
  WALLPAPER_OPTIONS,
  useFilmingSets,
  type CamState,
  type EnvState,
  type FilmingSet as SetData,
  type RoomState,
  type SetObject,
  type SetObjectKind,
  type Vec3,
  type WallpaperKind,
} from "@/lib/filmingSets";
import { MODELS, type ModelChoice } from "@/lib/types";

type Tab = "object" | "camera" | "set";

interface Eng {
  build: (s: SetData) => void;
  select: (id: string | null) => void;
  orbitPose: () => { position: Vec3; target: Vec3 } | null;
  lookAtObject: (id: string) => Vec3 | null;
  dispose: () => void;
  onSelect?: (id: string | null) => void;
  onObjectMoved?: (id: string, pos: Vec3) => void;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readFileAsDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error(`Failed to read ${f.name}`));
    r.readAsDataURL(f);
  });
}

const V3 = (v: Vec3) => new THREE.Vector3(v.x, v.y, v.z);

function baseMat(color: string, emissive = false) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0.05,
    ...(emissive ? { emissive: color, emissiveIntensity: 0.25 } : {}),
  });
}

function at(item: THREE.Object3D, y: number): THREE.Object3D {
  item.position.y = y;
  return item;
}

function buildSetObject(o: SetObject): THREE.Object3D {
  const mat = baseMat(o.color);
  const m = baseMat(o.color, true);
  let g: THREE.Object3D;

  switch (o.kind) {
    case "box":
      g = at(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat), 0.5);
      break;
    case "sphere":
      g = at(new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), mat), 0.5);
      break;
    case "cylinder":
      g = at(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 32), mat), 0.5);
      break;
    case "cone":
      g = at(new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 32), mat), 0.5);
      break;
    case "capsule":
      g = at(new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.5, 12, 24), mat), 0.85);
      break;
    case "rug": {
      g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.1), mat));
      break;
    }
    case "crate":
      g = at(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat), 0.3);
      break;
    case "barrel":
      g = at(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.8, 16), mat), 0.4);
      break;
    case "pillar":
      g = at(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.4, 16), mat), 1.2);
      break;
    case "plant": {
      g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.3, 16), mat);
      pot.position.y = 0.15;
      g.add(pot);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.02, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: "#3f6212" })
      );
      stem.position.y = 0.55;
      g.add(stem);
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 12),
        new THREE.MeshStandardMaterial({ color: "#4d7c0f" })
      );
      leaf.position.y = 0.85;
      g.add(leaf);
      const leaf2 = leaf.clone();
      leaf2.position.set(0.16, 0.95, 0.1);
      leaf2.scale.setScalar(0.7);
      g.add(leaf2);
      break;
    }
    case "table": {
      g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.9), m);
      top.position.y = 0.72;
      g.add(top);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), m);
      for (const [lx, lz] of [[-0.65, -0.36], [0.65, -0.36], [-0.65, 0.36], [0.65, 0.36]]) {
        const l = leg.clone();
        l.position.set(lx, 0.35, lz);
        g.add(l);
      }
      break;
    }
    case "chair": {
      g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), m);
      seat.position.y = 0.44;
      g.add(seat);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.05), m);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        const l = leg.clone();
        l.position.set(lx, 0.22, lz);
        g.add(l);
      }
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.055), m);
      back.position.set(0, 0.72, -0.19);
      g.add(back);
      break;
    }
    case "bed": {
      g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.2), m);
      frame.position.y = 0.15;
      g.add(frame);
      const mattress = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.18, 1.1),
        new THREE.MeshStandardMaterial({ color: "#e7e5e4" })
      );
      mattress.position.y = 0.39;
      g.add(mattress);
      const pillow = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.1, 0.32),
        new THREE.MeshStandardMaterial({ color: "#fafafa" })
      );
      pillow.position.set(0.5, 0.53, -0.3);
      g.add(pillow);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.14), m);
      head.position.set(0, 0.55, -0.6);
      g.add(head);
      break;
    }
    case "sofa": {
      g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 0.8), m);
      base.position.y = 0.18;
      g.add(base);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.2), m);
      back.position.set(0, 0.62, -0.3);
      g.add(back);
      for (const ax of [-0.72, 0.72]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.8), m);
        arm.position.set(ax, 0.4, 0);
        g.add(arm);
      }
      const cushionMat = new THREE.MeshStandardMaterial({ color: "#e7e5e4" });
      for (const cx of [-0.45, 0.45]) {
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.6), cushionMat);
        cushion.position.set(cx, 0.44, 0);
        g.add(cushion);
      }
      break;
    }
    case "fridge": {
      g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.8, 0.72), m);
      body.position.y = 0.9;
      g.add(body);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.05), baseMat("#e4e4e7"));
      handle.position.set(0.3, 0.95, 0.34);
      g.add(handle);
      break;
    }
    case "shelf": {
      g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.06), m);
      for (const lx of [-0.48, 0.48]) {
        const p = post.clone();
        p.position.set(lx, 0.85, 0);
        g.add(p);
      }
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 0.42), m);
        s.position.set(0, 0.4 + i * 0.55, 0);
        g.add(s);
      }
      break;
    }
    case "sink": {
      g = new THREE.Group();
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 0.55), m);
      cab.position.y = 0.42;
      g.add(cab);
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.05, 0.62),
        new THREE.MeshStandardMaterial({ color: "#d4d4d8" })
      );
      top.position.y = 0.87;
      g.add(top);
      const basin = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.12, 0.34),
        new THREE.MeshStandardMaterial({ color: "#a1a1aa" })
      );
      basin.position.set(0.12, 0.85, 0);
      g.add(basin);
      const faucet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.25, 12),
        new THREE.MeshStandardMaterial({ color: "#71717a" })
      );
      faucet.position.set(-0.25, 1.02, 0);
      g.add(faucet);
      break;
    }
    case "stove": {
      g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.62), m);
      body.position.y = 0.45;
      g.add(body);
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 0.05, 0.64),
        new THREE.MeshStandardMaterial({ color: "#27272a" })
      );
      top.position.y = 0.92;
      g.add(top);
      const burnerMat = new THREE.MeshStandardMaterial({ color: "#3f3f46" });
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12), burnerMat);
        b.position.set(-0.2 + (i % 2) * 0.4, 0.95, -0.16 + Math.floor(i / 2) * 0.32);
        g.add(b);
      }
      break;
    }
    case "counter": {
      g = new THREE.Group();
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 0.55), m);
      cab.position.set(0, 0.4, 0);
      g.add(cab);
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.05, 0.62),
        new THREE.MeshStandardMaterial({ color: "#d4d4d8" })
      );
      top.position.set(0, 0.82, 0);
      g.add(top);
      break;
    }
    case "door": {
      g = new THREE.Group();
      const frameMat = new THREE.MeshStandardMaterial({ color: "#3f3f46" });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.12), frameMat);
      frame.position.y = 1.05;
      g.add(frame);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.95, 0.06), m);
      door.position.set(0, 1.0, 0.06);
      g.add(door);
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 12, 10),
        new THREE.MeshStandardMaterial({ color: "#fbbf24" })
      );
      knob.position.set(0.3, 1.0, 0.1);
      g.add(knob);
      break;
    }
    case "window": {
      g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.1), m);
      frame.position.y = 1.0;
      g.add(frame);
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(1.24, 1.04, 0.03),
        new THREE.MeshPhysicalMaterial({
          color: "#bae6fd",
          transparent: true,
          opacity: 0.35,
          roughness: 0.1,
        })
      );
      glass.position.set(0, 1.0, 0);
      g.add(glass);
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.04, 0.05), m);
      mull.position.set(0, 1.0, 0);
      g.add(mull);
      break;
    }
    case "stairs": {
      g = new THREE.Group();
      const stepH = 0.16;
      const stepD = 0.22;
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(1, stepH, stepD), m);
        s.position.set(0, stepH * (i + 0.5), -stepD * (i + 0.5));
        g.add(s);
      }
      break;
    }
    case "light": {
      g = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), baseMat("#71717a"));
      arm.position.y = 0.6;
      g.add(arm);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 24), m);
      head.position.y = 1.3;
      head.rotation.x = Math.PI;
      g.add(head);
      break;
    }
    case "wallseg":
      g = at(new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.12), mat), 1.2);
      break;
    case "picture": {
      g = new THREE.Group();
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.06, 1.06, 0.04),
        new THREE.MeshStandardMaterial({ color: "#3f3f46", roughness: 0.4 })
      );
      g.add(frame);
      const planeMat = o.img
        ? new THREE.MeshBasicMaterial({ map: loadImageTexture(o.img), side: THREE.DoubleSide })
        : new THREE.MeshBasicMaterial({ color: "#3f3f46", side: THREE.DoubleSide });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), planeMat);
      plane.position.z = 0.021;
      g.add(plane);
      g.rotation.x = o.orient === "floor" ? -Math.PI / 2 : 0;
      break;
    }
    case "character": {
      g = new THREE.Group();
      const skinMat = new THREE.MeshStandardMaterial({ color: "#f3c59a", roughness: 0.6 });
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.45, 8, 12), m);
      for (const lx of [-0.12, 0.12]) {
        const l = leg.clone();
        l.position.set(lx, 0.5, 0);
        g.add(l);
      }
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 8, 12), m);
      torso.position.y = 1.0;
      g.add(torso);
      for (const lx of [-0.3, 0.3]) {
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.4, 8, 12), skinMat);
        arm.position.set(lx, 1.15, 0);
        g.add(arm);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 18), skinMat);
      head.position.y = 1.42;
      g.add(head);
      break;
    }
    case "glb":
    default:
      g = at(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat), 0.4);
  }

  g.position.set(o.position.x, o.position.y, o.position.z);
  g.rotation.y = o.rotY;
  g.scale.set(o.scale.x, o.scale.y, o.scale.z);
  g.userData = { objId: o.id, selectable: true };
  g.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) c.userData = { ...c.userData, objId: o.id, selectable: true };
  });
  return g;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.max(0, Math.min(255, v + amt)));
  return `rgb(${r},${g},${b})`;
}

function wallpaperTexture(kind: WallpaperKind, tint: string): THREE.CanvasTexture | null {
  if (kind === "none") return null;
  if (typeof document === "undefined") return null;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, S, S);

  const light = shade(tint, 16);
  const dark = shade(tint, -14);

  if (kind === "plaster") {
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? shade(tint, 3 + Math.random() * 7) : shade(tint, -3 - Math.random() * 6);
      ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
  } else if (kind === "brick") {
    const bw = 64;
    const bh = 26;
    for (let row = 0; row * bh < S; row++) {
      const y = row * bh;
      ctx.fillStyle = dark;
      ctx.fillRect(0, y, S, 2);
      ctx.fillRect(row % 2 === 0 ? 0 : -bw / 2, y, 2, bh);
      for (let x = -(row % 2 ? bw / 2 : 0); x < S; x += bw) {
        ctx.fillStyle = light;
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
    }
  } else if (kind === "wood") {
    for (let y = 0; y < S; y += 32) {
      ctx.fillStyle = y % 64 === 0 ? light : dark;
      ctx.fillRect(0, y, S, 31);
      ctx.fillRect(0, y + 30, S, 2);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? shade(tint, 10) : shade(tint, -10);
        ctx.fillRect(Math.random() * S, y + Math.random() * 31, 3 + Math.random() * 6, 1);
      }
    }
  } else if (kind === "tiles") {
    const t = 64;
    for (let x = 0; x < S; x += t) {
      for (let y = 0; y < S; y += t) {
        ctx.fillStyle = (x / t + y / t) % 2 ? light : shade(tint, 6);
        ctx.fillRect(x, y, t, t);
      }
    }
    ctx.strokeStyle = shade(tint, -20);
    ctx.lineWidth = 3;
    for (let x = 0; x <= S; x += t) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, S);
      ctx.stroke();
    }
    for (let y = 0; y <= S; y += t) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(S, y);
      ctx.stroke();
    }
  } else if (kind === "stripes") {
    ctx.fillStyle = light;
    for (let x = 0; x < S; x += 48) ctx.fillRect(x, 0, 24, S);
  } else if (kind === "dotted") {
    ctx.fillStyle = light;
    for (let y = 12; y < S; y += 48) {
      for (let x = 12; x < S; x += 48) {
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(4, 3);
  return tex;
}

const gltfLoader = new GLTFLoader();
const glbCache = new Map<string, Promise<THREE.Object3D>>();

function loadGlb(url: string): Promise<THREE.Object3D> {
  let p = glbCache.get(url);
  if (!p) {
    p = gltfLoader.loadAsync(url).then((gltf) => {
      const root = gltf.scene;
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      return root;
    });
    glbCache.set(url, p);
  }
  return p;
}

const texLoader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();

function loadImageTexture(url: string): THREE.Texture {
  let t = texCache.get(url);
  if (!t) {
    t = texLoader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(url, t);
  }
  return t;
}

type WallFace = "back" | "left" | "right" | "front";

const WALL_FACES: Record<number, WallFace[]> = {
  0: [],
  1: ["back"],
  2: ["back", "left"],
  3: ["back", "left", "right"],
  4: ["back", "left", "right", "front"],
};

function clipRoom(v: Vec3, room: RoomState): Vec3 {
  const hw = Math.max(room.width / 2 - 0.2, 0.1);
  const hd = Math.max(room.depth / 2 - 0.2, 0.1);
  return {
    x: Math.min(Math.max(v.x, -hw), hw),
    y: v.y,
    z: Math.min(Math.max(v.z, -hd), hd),
  };
}

function hexColor(v: unknown, fb: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb;
}

function num(v: unknown, fb: number): number {
  return typeof v === "number" && isFinite(v) ? v : fb;
}

function parseEnvJSON(
  text: string
): { env: Partial<EnvState>; wallColor: string; wallpaper: WallpaperKind } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;

  const ambient = (d.ambient ?? {}) as Record<string, unknown>;
  const key = d.key === null ? null : ((d.key ?? {}) as Record<string, unknown>);
  const fill = d.fill === null ? null : ((d.fill ?? {}) as Record<string, unknown>);

  const wallpaper = WALLPAPER_OPTIONS.some((w) => w.id === d.wallpaper)
    ? (d.wallpaper as WallpaperKind)
    : "none";

  return {
    env: {
      sky: hexColor(d.sky, "#0f1117"),
      fog: d.fog === true,
      fogColor: hexColor(d.fogColor, "#0f1117"),
      ambient: {
        color: hexColor(ambient.color, "#8b8b9e"),
        intensity: num(ambient.intensity, 0.9),
      },
      key:
        key === null
          ? null
          : {
              color: hexColor(key.color, "#ffffff"),
              intensity: num(key.intensity, 1.4),
              x: num(key.x, 4),
              y: num(key.y, 8),
              z: num(key.z, 3),
            },
      fill:
        fill === null
          ? null
          : {
              color: hexColor(fill.color, "#9fb6ff"),
              intensity: num(fill.intensity, 0.5),
            },
    },
    wallColor: hexColor(d.wallColor, ""),
    wallpaper,
  };
}

export default function FilmingSet({
  account,
  refreshAccount,
  openKeys,
}: {
  account: Account;
  refreshAccount: () => void;
  openKeys: () => void;
}) {
  const { sets, activeSet, selectSet, createSet, renameSet, deleteSet, updateSet } =
    useFilmingSets(account.email);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const glbInputRef = useRef<HTMLInputElement | null>(null);
  const picInputRef = useRef<HTMLInputElement | null>(null);
  const engRef = useRef<Eng | null>(null);

  const [tab, setTab] = useState<Tab>("object");
  const [cameraView, setCameraView] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [envPrompt, setEnvPrompt] = useState("");
  const [envModel, setEnvModel] = useState<ModelChoice>("google/gemini-2.5-flash");
  const [envBusy, setEnvBusy] = useState(false);
  const [envMsg, setEnvMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const modeRef = useRef({ cameraView });
  const selected = activeSet?.objects.find((o) => o.id === selectedId) ?? null;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f1117");

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    const orbitCam = new THREE.PerspectiveCamera(55, 1, 0.01, 200);
    orbitCam.position.set(4.5, 3.4, 6);

    const controls = new OrbitControls(orbitCam, renderer.domElement);
    controls.target.set(0, 0.8, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    const envLights = new THREE.Group();
    scene.add(envLights);

    const floorGroup = new THREE.Group();
    const roomGroup = new THREE.Group();
    const setGroup = new THREE.Group();
    const rigGroup = new THREE.Group();
    scene.add(floorGroup, roomGroup, setGroup, rigGroup);

    const cineCam = new THREE.PerspectiveCamera(50, 1, 0.01, 200);
    const camState = { fov: 50, roll: 0, up: new THREE.Vector3(0, 1, 0) };

    const frust = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0.9 })
    );
    const camBody = new THREE.Group();
    rigGroup.add(camBody, frust);

    function setCamGui() {
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.17, 0.22), bodyMat);
      const lens = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.09, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8 })
      );
      lens.position.set(0, 0.04, -0.15);
      box.position.set(0, 0.04, 0);
      camBody.add(box, lens);
      camBody.rotation.order = "YXZ";
    }
    setCamGui();

    const targetMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 })
    );
    targetMarker.userData = { selectable: false };
    const targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.13, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      })
    );
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.userData = { selectable: false };
    scene.add(targetMarker, targetRing);

    const selBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0xf472b6 })
    );
    selBox.visible = false;
    scene.add(selBox);

    let selectedMesh: THREE.Object3D | null = null;
    let highlightDirty = false;

    function applyEnv(env: EnvState) {
      scene.background = new THREE.Color(env.sky);
      scene.fog = env.fog ? new THREE.Fog(env.fogColor, 8, 36) : null;
      envLights.clear();
      envLights.add(new THREE.HemisphereLight(env.ambient.color, "#241f2e", env.ambient.intensity));
      if (env.key) {
        const k = new THREE.DirectionalLight(env.key.color, env.key.intensity);
        k.position.set(env.key.x, env.key.y, env.key.z);
        envLights.add(k);
      }
      if (env.fill) {
        const f = new THREE.DirectionalLight(env.fill.color, env.fill.intensity);
        f.position.set(-4, 3, -5);
        envLights.add(f);
      }
    }

    function clearSet() {
      floorGroup.clear();
      roomGroup.clear();
      setGroup.clear();
      rigGroup.clear();
      camBody.remove(...camBody.children);
      setCamGui();
      selBox.visible = false;
      selectedMesh = null;
    }

    function buildRoom(room: RoomState) {
      floorGroup.clear();
      roomGroup.clear();

      const w = Math.max(room.width, 0.4);
      const d = Math.max(room.depth, 0.4);
      const h = Math.max(room.height, 0.4);

      if (room.grid) {
        const size = Math.max(w, d);
        const grid = new THREE.GridHelper(size, Math.round(size * 2), 0x3f3f46, 0x27272a);
        grid.position.y = 0.002;
        floorGroup.add(grid);
      }

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.9 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.001;
      floorGroup.add(floor);

      if (room.wallMode > 0) {
        const t = 0.14;
        const tex = wallpaperTexture(room.wallpaper, room.wallColor);
        const wallMat = new THREE.MeshStandardMaterial({
          color: tex ? 0xffffff : room.wallColor,
          side: THREE.DoubleSide,
          map: tex,
          roughness: 0.85,
        });
        const faces = WALL_FACES[room.wallMode] ?? [];
        const mk = (position: [number, number, number], size: [number, number, number]) => {
          const m2 = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), wallMat);
          m2.position.set(position[0], position[1], position[2]);
          roomGroup.add(m2);
        };
        for (const face of faces) {
          if (face === "back") mk([0, h / 2, -d / 2], [w + t * 2, h, t]);
          else if (face === "front") mk([0, h / 2, d / 2], [w + t * 2, h, t]);
          else if (face === "left") mk([-w / 2, h / 2, 0], [t, h, d + t * 2]);
          else if (face === "right") mk([w / 2, h / 2, 0], [t, h, d + t * 2]);
        }
      }

      if (room.ceiling) {
        const ceil = new THREE.Mesh(
          new THREE.PlaneGeometry(w + 0.4, d + 0.4),
          new THREE.MeshStandardMaterial({ color: 0x2d2d34, side: THREE.DoubleSide })
        );
        ceil.rotation.x = Math.PI / 2;
        ceil.position.y = h;
        roomGroup.add(ceil);
      }
    }

    function buildObjects(objects: SetObject[]) {
      setGroup.clear();
      for (const o of objects) {
        if (o.kind === "glb" && o.glb) {
          const pos = o.position;
          const ry = o.rotY;
          const sc = o.scale;
          loadGlb(o.glb).then((root) => {
            const clone = root.clone(true);
            clone.position.set(pos.x, pos.y, pos.z);
            clone.rotation.y = ry;
            clone.scale.set(sc.x, sc.y, sc.z);
            clone.userData = { objId: o.id, selectable: true };
            clone.traverse((cc) => {
              const mesh = cc as THREE.Mesh;
              if (mesh.isMesh) mesh.userData = { ...mesh.userData, objId: o.id, selectable: true };
            });
            if (!setGroup.children.some((c) => c.userData?.objId === o.id)) {
              setGroup.add(clone);
              highlightDirty = true;
            }
          });
        } else {
          setGroup.add(buildSetObject(o));
        }
      }
    }

    function applyRig(cam: CamState) {
      camState.fov = cam.fov;
      camState.roll = cam.roll;

      cineCam.fov = cam.fov;
      cineCam.position.set(cam.position.x, cam.position.y, cam.position.z);

      const pos = V3(cam.position);
      const tgt = V3(cam.target);

      const forward = new THREE.Vector3().subVectors(tgt, pos).normalize();
      if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);

      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        forward
      );
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(
        forward,
        THREE.MathUtils.degToRad(cam.roll)
      );
      quat.multiply(rollQuat);

      camBody.position.copy(pos);
      camBody.quaternion.copy(quat);

      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat).normalize();
      camState.up.copy(up);
      cineCam.up.copy(up);
      cineCam.lookAt(tgt);

      const dist = Math.max(pos.distanceTo(tgt), 0.2);
      const stretch = dist * 0.9;
      const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      const aspect = cineCam.aspect || 1;
      const halfW = tanV * stretch * aspect;
      const halfH = tanV * stretch;

      const positions = new Float32Array([
        0, 0, 0,
        halfW, halfH, -stretch,
        0, 0, 0,
        -halfW, halfH, -stretch,
        0, 0, 0,
        -halfW, -halfH, -stretch,
        0, 0, 0,
        halfW, -halfH, -stretch,
        halfW, halfH, -stretch,
        -halfW, halfH, -stretch,
        halfW, -halfH, -stretch,
        halfW, halfH, -stretch,
        -halfW, halfH, -stretch,
        -halfW, -halfH, -stretch,
      ]);
      frust.geometry.dispose();
      frust.geometry = new THREE.BufferGeometry();
      frust.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      frust.position.copy(pos);
      frust.quaternion.copy(quat);

      targetMarker.position.copy(tgt);
      targetRing.position.copy(tgt);
    }

    function applySelection() {
      if (!selectedMesh) {
        selBox.visible = false;
        return;
      }
      selBox.visible = true;
      const box = new THREE.Box3().setFromObject(selectedMesh);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      selBox.scale.set(size.x || 0.05, size.y || 0.05, size.z || 0.05);
      selBox.position.copy(center);
    }

    function pickMesh(clientX: number, clientY: number): THREE.Object3D | null {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, cameraView ? cineCam : orbitCam);
      const hits = ray.intersectObjects(setGroup.children, true);
      for (const h of hits) {
        let node: THREE.Object3D | null = h.object;
        while (node && node.parent !== setGroup) node = node.parent;
        if (node && node.userData?.selectable) return node;
      }
      return null;
    }

    function select(id: string | null) {
      selectedMesh = id ? (setGroup.children.find((c) => c.userData.objId === id) ?? null) : null;
      highlightDirty = true;
      engRef.current?.onSelect?.(id);
    }

    let dragging: { obj: THREE.Object3D; planeY: number; moved: boolean } | null = null;
    let downPos: { x: number; y: number } | null = null;

    const onDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
      const mesh = pickMesh(e.clientX, e.clientY);
      if (mesh) {
        select(mesh.userData.objId);
        controls.enabled = false;
        dragging = { obj: mesh, planeY: mesh.position.y, moved: false };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      if (Math.abs(e.clientX - downPos!.x) + Math.abs(e.clientY - downPos!.y) > 4) {
        dragging.moved = true;
      }
      if (!dragging.moved) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, cameraView ? cineCam : orbitCam);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -dragging.planeY);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, hit)) {
        dragging.obj.position.x = hit.x;
        dragging.obj.position.z = hit.z;
        highlightDirty = true;
      }
    };

    const onUp = () => {
      if (dragging) {
        controls.enabled = true;
        if (dragging.moved) {
          const obj = dragging.obj;
          const id = obj.userData.objId;
          const raw = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
          const room = roomCache;
          engRef.current?.onObjectMoved?.(
            id,
            room ? clipRoom(raw, room) : raw
          );
        }
        dragging = null;
      }
      downPos = null;
    };

    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.style.touchAction = "none";

    let roomCache: RoomState | null = null;

    function build(s: SetData) {
      const prevSel = selectedMesh ? selectedMesh.userData.objId : null;
      clearSet();
      applyEnv(s.environment);
      buildRoom(s.room);
      buildObjects(s.objects);
      applyRig(s.camera);
      roomCache = { ...s.room };
      selectedMesh = prevSel
        ? (setGroup.children.find((c) => c.userData.objId === prevSel) ?? null)
        : null;
      highlightDirty = true;
    }

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      orbitCam.aspect = w / h;
      orbitCam.updateProjectionMatrix();
      cineCam.aspect = w / h;
      cineCam.updateProjectionMatrix();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);
      if (controls.enabled) controls.update();
      if (highlightDirty) {
        applySelection();
        highlightDirty = false;
      }
      renderer.render(scene, modeRef.current.cameraView ? cineCam : orbitCam);
    };
    render();

    engRef.current = {
      build,
      select: (id) => select(id),
      orbitPose() {
        return {
          position: { x: orbitCam.position.x, y: orbitCam.position.y, z: orbitCam.position.z },
          target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
        };
      },
      lookAtObject(id) {
        const mesh = setGroup.children.find((c) => c.userData.objId === id);
        if (!mesh) return null;
        const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
        return { x: c.x, y: c.y, z: c.z };
      },
      dispose() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        dom.removeEventListener("pointerdown", onDown);
        dom.removeEventListener("pointermove", onMove);
        dom.removeEventListener("pointerup", onUp);
        controls.dispose();
        frust.geometry.dispose();
        renderer.dispose();
        if (renderer.domElement.parentElement === mount) {
          mount.removeChild(renderer.domElement);
        }
      },
    };

    return () => {
      engRef.current?.dispose();
      engRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeSet && engRef.current) {
      engRef.current.build(activeSet);
    }
  }, [activeSet]);

  const commitObjects = useCallback(
    (objects: SetObject[]) => {
      updateSet({ objects });
      if (objects.length === 0) setSelectedId(null);
    },
    [updateSet]
  );

  const addObject = (kind: SetObjectKind) => {
    if (!activeSet) return;
    const o: SetObject = {
      id: uid(),
      kind,
      color: "#f59e0b",
      position: { x: 0, y: 0, z: 0 },
      rotY: 0,
      scale: { x: 1, y: 1, z: 1 },
      name: `${kind} ${activeSet.objects.filter((x) => x.kind === kind).length + 1}`,
    };
    commitObjects([...activeSet.objects, o]);
    setSelectedId(o.id);
  };

  const updateObject = (id: string, patch: Partial<SetObject>) => {
    if (!activeSet) return;
    commitObjects(activeSet.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const onUploadGlb = async (f: File | undefined) => {
    if (!f) return;
    if (!activeSet) return;
    if (f.size > 2.5 * 1024 * 1024) {
      setError("GLB too large — keep it under 2.5 MB so it can be saved to localStorage.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(f);
      const o: SetObject = {
        id: uid(),
        kind: "glb",
        color: "#e879f9",
        position: { x: 0, y: 0, z: 0 },
        rotY: 0,
        scale: { x: 1, y: 1, z: 1 },
        name: f.name.replace(/\.glb$/i, ""),
        glb: dataUrl,
      };
      commitObjects([...activeSet.objects, o]);
      setSelectedId(o.id);
    } catch {
      setError("Could not read that GLB file.");
    }
  };

  const onUploadPicture = async (f: File | undefined) => {
    if (!f || !selected) return;
    try {
      const dataUrl = await readFileAsDataUrl(f);
      updateObject(selected.id, { img: dataUrl });
    } catch {
      setError("Could not read that image.");
    }
  };

  const attachPicture = (target: WallFace | "floor") => {
    if (!activeSet || !selected || selected.kind !== "picture") return;
    const room = activeSet.room;
    const hw = room.width / 2;
    const hd = room.depth / 2;
    const h = room.height;
    const y = Math.min(1.45, Math.max(0.75, h * 0.55));
    const patch: Partial<SetObject> = {
      orient: target === "floor" ? "floor" : "wall",
      rotY: 0,
    };
    if (target === "back") {
      patch.position = { x: 0, y, z: -(hd - 0.08) };
    } else if (target === "front") {
      patch.rotY = 180;
      patch.position = { x: 0, y, z: hd - 0.08 };
    } else if (target === "left") {
      patch.rotY = 90;
      patch.position = { x: -(hw - 0.08), y, z: 0 };
    } else if (target === "right") {
      patch.rotY = -90;
      patch.position = { x: hw - 0.08, y, z: 0 };
    } else {
      patch.position = { x: selected.position.x, y: 0.01, z: selected.position.z };
    }
    updateObject(selected.id, patch);
  };

  useEffect(() => {
    const eng = engRef.current;
    if (!eng) return;
    modeRef.current.cameraView = cameraView;
    eng.onSelect = (id) => setSelectedId(id);
    eng.onObjectMoved = (id, pos) => updateObject(id, { position: pos });
  });

  const updateCamera = (patch: Partial<CamState>) => {
    if (!activeSet) return;
    updateSet({ camera: { ...activeSet.camera, ...patch } });
  };

  const updateRoom = (patch: Partial<RoomState>) => {
    if (!activeSet) return;
    updateSet({ room: { ...activeSet.room, ...patch } });
  };

  const updateEnv = (patch: Partial<EnvState>) => {
    if (!activeSet) return;
    updateSet({ environment: { ...activeSet.environment, ...patch } });
  };

  const generateEnv = async () => {
    setError(null);
    setEnvMsg(null);
    if (!activeSet) return;
    if (!envPrompt.trim()) {
      setEnvMsg({ ok: false, text: "Describe the environment + lighting first, then generate." });
      return;
    }

    const order = nextRotationOrder(account.email);
    if (order.length === 0) {
      setError("No enabled API keys. Add one in the Key Manager.");
      openKeys();
      return;
    }

    setEnvBusy(true);
    try {
      const system =
        `You are a 3D filming-set lighting director. Translate the user's description of a location into a lighting + environment spec for a 3D set editor (props already exist in the scene). Return ONLY strict JSON with this exact shape:\n` +
        `{"sky":"#hex","fog":true|false,"fogColor":"#hex","ambient":{"color":"#hex","intensity":0..2},"key":{"color":"#hex","intensity":0..3,"x":-6..6,"y":0.5..8,"z":-6..6},"fill":{"color":"#hex","intensity":0..2},"wallColor":"#hex","wallpaper":"none"|"plaster"|"brick"|"wood"|"tiles"|"stripes"|"dotted"}\n` +
        `Guidelines: pick a believable color grade for the described mood/time of day; key light is the main motivated light (window/sun/practical) and its x/y/z is the direction it comes FROM; fill is a soft bounce; ambient is the base bounce. Choose the wallpaper that fits the location.`;

      const user = envPrompt.trim();

      const r = await chatWithKeys({
        keys: order.map((k) => ({ id: k.id, key: k.key, label: k.label, provider: k.provider })),
        model: envModel,
        body: {
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
          max_tokens: 900,
        },
      });

      r.attempts?.forEach((a) => {
        if (a.keyId) updateKeyStatus(account.email, a.keyId, { ok: a.ok, errorMessage: a.errorMessage });
      });
      advanceRotation(account.email);
      refreshAccount();

      const parsed = parseEnvJSON(r.content);
      if (!parsed) {
        throw new Error("The model did not return a valid JSON spec — try again.");
      }

      updateSet({
        environment: { ...activeSet.environment, ...parsed.env, prompt: envPrompt.trim() },
        room: {
          ...activeSet.room,
          wallColor: parsed.wallColor || activeSet.room.wallColor,
          wallpaper: parsed.wallpaper,
        },
      });
      setEnvMsg({ ok: true, text: "Environment + lighting applied from the prompt." });
    } catch (e) {
      if (e instanceof OpenRouterError) {
        e.attempts?.forEach((a) => {
          if (a.keyId) updateKeyStatus(account.email, a.keyId, { ok: false, errorMessage: a.errorMessage });
        });
        refreshAccount();
      }
      setError(e instanceof Error ? e.message : "Something went wrong generating the environment.");
    } finally {
      setEnvBusy(false);
    }
  };

  const numberRow = (label: string, value: { x: number; y: number; z: number }, onChange: (axis: "x" | "y" | "z", v: number) => void) => (
    <div className="grid grid-cols-[3.5rem_1fr_1fr_1fr] items-center gap-1.5">
      <span className="text-[11px] text-zinc-500">{label}</span>
      {(["x", "y", "z"] as const).map((axis) => (
        <input
          key={axis}
          type="number"
          step={0.1}
          value={Math.round(value[axis] * 100) / 100}
          onChange={(e) => onChange(axis, Number(e.target.value))}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-right font-mono text-xs text-zinc-100 outline-none focus:border-fuchsia-500"
        />
      ))}
    </div>
  );

  const enabledTotal = account.keys.filter((k) => k.enabled).length;

  return (
    <div className="grid gap-6">
      <ProjectBar
        projects={sets}
        active={activeSet}
        onSelect={selectSet}
        onCreate={createSet}
        onRename={renameSet}
        onDelete={deleteSet}
        subtitle={(s) => `${s.objects.length} props · env lighting ${s.environment.prompt ? "· prompted" : ""}`}
      />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-xl shadow-black/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-sky-500/10 text-xl ring-1 ring-fuchsia-500/40">
              🎥
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Filming Set — 3D view</h2>
              <p className="text-xs text-zinc-400">
                A set is a named location (e.g. “dapur atuk”). Place props, characters and GLB models,
                dress the walls, and light it from a prompt.
              </p>
              <p className="mt-1 text-[11px] text-zinc-600">
                {sets.length} set(s) · {activeSet ? `${activeSet.objects.length} props in “${activeSet.name}”` : "no set"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition-colors hover:border-zinc-500">
              <input
                type="checkbox"
                checked={cameraView}
                onChange={(e) => setCameraView(e.target.checked)}
                className="h-3.5 w-3.5 accent-fuchsia-500"
              />
              Camera view
            </label>
            <button
              onClick={() => {
                setTab("camera");
                setCameraView(true);
              }}
              className="rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/10 px-3 py-2 text-xs font-medium text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20"
            >
              Frame with camera
            </button>
          </div>
        </div>

        <div className="mt-4 lg:flex lg:gap-4">
          <div
            ref={mountRef}
            className="relative min-h-[360px] flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-black lg:min-h-[540px]"
          >
            <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-black/50 px-2.5 py-1.5 text-[11px] text-zinc-400 backdrop-blur">
              Left-drag: orbit · Right-drag: pan · Wheel: zoom
              <br />
              Click prop: select &amp; drag to move · Roll / pan the mouse like a 3D viewer
            </div>
            {cameraView && (
              <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-lg bg-fuchsia-500/15 px-2.5 py-1.5 text-[11px] font-medium text-fuchsia-300 ring-1 ring-fuchsia-500/40">
                🎥 camera view — locked to the rig
              </div>
            )}
          </div>

          <aside className="mt-4 w-full lg:mt-0 lg:w-[24rem] lg:flex-shrink-0">
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
              {(
                [
                  ["object", "Props"],
                  ["camera", "Camera"],
                  ["set", "Set / Env"],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                    tab === id
                      ? "bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-500/40"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="max-h-[80vh] space-y-4 overflow-y-auto pr-1">
              {tab === "object" && (
                <>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Add prop / model
                    </p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {SET_PALETTE.map((p) => (
                        <button
                          key={p.kind}
                          onClick={() => addObject(p.kind)}
                          title={p.label}
                          className="flex flex-col items-center gap-0.5 rounded-lg border border-zinc-700/70 bg-zinc-900 px-1 py-2 text-[10px] text-zinc-300 transition-colors hover:border-fuchsia-500/60 hover:text-fuchsia-200"
                        >
                          <span className="text-base leading-none">{p.icon}</span>
                          <span className="truncate">{p.label}</span>
                        </button>
                      ))}
                    </div>
                    <input
                      ref={glbInputRef}
                      type="file"
                      accept=".glb,model/gltf-binary"
                      className="hidden"
                      onChange={(e) => {
                        onUploadGlb(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={() => glbInputRef.current?.click()}
                      className="mt-2 w-full rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
                    >
                      ⬆ Upload .glb model (character / prop)
                    </button>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Props in set
                    </p>
                    {activeSet && activeSet.objects.length === 0 ? (
                      <p className="text-xs text-zinc-600">No props yet — add some.</p>
                    ) : (
                      <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
                        {activeSet?.objects.map((o) => (
                          <li key={o.id}>
                            <button
                              onClick={() => setSelectedId(o.id)}
                              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                                o.id === selectedId
                                  ? "border-fuchsia-500/50 bg-fuchsia-500/10 text-zinc-100"
                                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                              }`}
                            >
                              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: o.color }} />
                              <span className="truncate">{o.name}</span>
                              {o.kind === "glb" && (
                                <span className="flex-shrink-0 rounded border border-purple-500/40 bg-purple-500/10 px-1 text-[9px] font-medium text-purple-300">
                                  GLB
                                </span>
                              )}
                              <span className="ml-auto font-mono text-[10px] text-zinc-600">
                                {Math.round(o.position.x)}, {Math.round(o.position.y)}, {Math.round(o.position.z)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {selected && (
                    <div className="rounded-2xl border border-fuchsia-500/30 bg-zinc-950 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                          Selected prop
                        </p>
                        <button
                          onClick={() => setSelectedId(null)}
                          className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
                        >
                          deselect
                        </button>
                      </div>
                      <div className="mb-3 flex items-center gap-2">
                        <input
                          value={selected.name}
                          onChange={(e) => updateObject(selected.id, { name: e.target.value })}
                          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-fuchsia-500"
                        />
                        <input
                          type="color"
                          value={selected.color}
                          onChange={(e) => updateObject(selected.id, { color: e.target.value })}
                          title="Color"
                          className="h-8 w-10 cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        {numberRow("Position", selected.position, (axis, v) =>
                          updateObject(selected.id, {
                            position: { ...selected.position, [axis]: v },
                          })
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="w-14 text-[11px] text-zinc-500">Rotate Y</span>
                          <input
                            type="number"
                            step={5}
                            value={Math.round(selected.rotY)}
                            onChange={(e) => updateObject(selected.id, { rotY: Number(e.target.value) })}
                            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-right font-mono text-xs text-zinc-100 outline-none focus:border-fuchsia-500"
                          />
                          <button
                            onClick={() => updateObject(selected.id, { rotY: selected.rotY + 45 })}
                            className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:border-fuchsia-500/60 hover:text-fuchsia-200"
                            title="Rotate 45°"
                          >
                            +45°
                          </button>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-1.5 py-1.5">
                          <p className="mb-1 px-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
                            Scale · {Math.round(selected.scale.x * 100) / 100}
                          </p>
                          <input
                            type="range"
                            min={0.2}
                            max={3}
                            step={0.05}
                            value={selected.scale.x}
                            onChange={(e) => {
                              const s = Number(e.target.value);
                              updateObject(selected.id, { scale: { x: s, y: s, z: s } });
                            }}
                            className="w-full accent-fuchsia-500"
                          />
                        </div>
                        {selected.kind === "picture" && (
                          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
                            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-600">
                              Picture
                            </p>
                            <input
                              ref={picInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                onUploadPicture(e.target.files?.[0]);
                                e.target.value = "";
                              }}
                            />
                            <button
                              onClick={() => picInputRef.current?.click()}
                              className="w-full rounded-lg border border-purple-500/40 bg-purple-500/10 px-2 py-1.5 text-[11px] font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
                            >
                              🖼 Attach image
                            </button>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-600">Orient</span>
                              {(["wall", "floor"] as const).map((o) => (
                                <button
                                  key={o}
                                  onClick={() => updateObject(selected.id, { orient: o })}
                                  className={`flex-1 rounded-md border px-1 py-1 text-[10px] transition-colors ${
                                    (selected.orient ?? "wall") === o
                                      ? "border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-300"
                                      : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
                                  }`}
                                >
                                  {o === "wall" ? "Wall" : "Floor"}
                                </button>
                              ))}
                            </div>
                            <div className="mt-1.5 grid grid-cols-4 gap-1">
                              {(
                                [
                                  ["back", "Back"],
                                  ["left", "Left"],
                                  ["right", "Right"],
                                  ["floor", "Floor"],
                                ] as [WallFace | "floor", string][]
                              ).map(([target, label]) => (
                                <button
                                  key={target}
                                  onClick={() => attachPicture(target)}
                                  className="rounded-md border border-zinc-700 px-1 py-1 text-[10px] text-zinc-400 transition-colors hover:border-sky-500/60 hover:text-sky-200"
                                >
                                  ↦ {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <textarea
                          value={selected.notes ?? ""}
                          onChange={(e) => updateObject(selected.id, { notes: e.target.value })}
                          rows={3}
                          placeholder={`Describe this prop / character in a prompt…\ne.g. Old cracked wooden table, claw feet, single drawer, warm patina.`}
                          className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
                        />
                        <button
                          onClick={() => {
                            const c = engRef.current?.lookAtObject(selectedId!);
                            if (c) updateCamera({ target: c });
                          }}
                          className="w-full rounded-lg border border-sky-500/40 bg-sky-500/10 px-2 py-1.5 text-[11px] font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
                        >
                          🎯 Aim camera at this prop
                        </button>
                        <button
                          onClick={() => {
                            commitObjects((activeSet?.objects ?? []).filter((o) => o.id !== selected.id));
                            setSelectedId(null);
                          }}
                          className="w-full rounded-lg border border-zinc-700 px-2 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-300"
                        >
                          Delete prop
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {tab === "camera" && activeSet && (
                <div className="rounded-2xl border border-sky-500/30 bg-zinc-950 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Virtual camera
                  </p>
                  <p className="mb-3 text-[11px] text-zinc-600">
                    Position the studio camera in 3D. It is drawn as a rig with a view cone; the cone
                    shows its frame.
                  </p>
                  <div className="space-y-1.5">
                    {numberRow("Pos.", activeSet.camera.position, (axis, v) =>
                      updateCamera({
                        position: { ...activeSet.camera.position, [axis]: v },
                      })
                    )}
                    {numberRow("Look", activeSet.camera.target, (axis, v) =>
                      updateCamera({ target: { ...activeSet.camera.target, [axis]: v } })
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="w-14 text-[11px] text-zinc-500">FOV</span>
                      <input
                        type="range"
                        min={20}
                        max={90}
                        step={1}
                        value={activeSet.camera.fov}
                        onChange={(e) => updateCamera({ fov: Number(e.target.value) })}
                        className="flex-1 accent-sky-500"
                      />
                      <span className="w-9 text-right font-mono text-xs text-zinc-300">
                        {activeSet.camera.fov}°
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-14 text-[11px] text-zinc-500">Roll</span>
                      <input
                        type="range"
                        min={-90}
                        max={90}
                        step={1}
                        value={activeSet.camera.roll}
                        onChange={(e) => updateCamera({ roll: Number(e.target.value) })}
                        className="flex-1 accent-sky-500"
                      />
                      <span className="w-9 text-right font-mono text-xs text-zinc-300">
                        {activeSet.camera.roll}°
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-1.5">
                    <button
                      onClick={() => {
                        const pose = engRef.current?.orbitPose();
                        if (pose) {
                          updateCamera({ position: pose.position, target: pose.target });
                          setCameraView(true);
                        }
                      }}
                      className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2 py-1.5 text-[11px] font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
                    >
                      📸 Use current view here (frame like a camera, then save)
                    </button>
                    <button
                      onClick={() => setCameraView((v) => !v)}
                      className="rounded-lg border border-zinc-700 px-2 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-sky-500/60 hover:text-sky-200"
                    >
                      {cameraView ? "Exit camera view" : "Preview camera view"}
                    </button>
                  </div>
                </div>
              )}

              {tab === "set" && activeSet && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-fuchsia-500/30 bg-zinc-950 p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Environment + lighting from prompt
                    </p>
                    <p className="mb-2 text-[11px] text-zinc-600">
                      Describe the location, mood and lights — AI sets sky, fog, key/fill/ambient
                      lights and the wall wallpaper.
                    </p>
                    <textarea
                      value={envPrompt}
                      onChange={(e) => setEnvPrompt(e.target.value)}
                      rows={3}
                      placeholder={`e.g. Dapur atuk at dusk — warm wooden kitchen, a kerosene lamp on the counter, soft orange light through the west window, long shadows toward the east wall, faint blue moonlight filling the doorway.`}
                      className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        value={envModel}
                        onChange={(e) => setEnvModel(e.target.value as ModelChoice)}
                        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-zinc-100 outline-none focus:border-fuchsia-500"
                      >
                        {MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={generateEnv}
                        disabled={envBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/10 px-3 py-2 text-xs font-medium text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {envBusy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                        {envBusy ? "Generating…" : "Generate"}
                      </button>
                    </div>
                    {envMsg && (
                      <p className={`mt-2 text-xs ${envMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {envMsg.text}
                      </p>
                    )}
                    {activeSet.environment.prompt && (
                      <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-[11px] text-zinc-500">
                        <span className="text-zinc-400">Applied prompt:</span> “{activeSet.environment.prompt}”
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Walls
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeSet.room.wallColor}
                        onChange={(e) => updateRoom({ wallColor: e.target.value })}
                        className="h-8 w-10 cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900"
                        title="Wall color"
                      />
                      <span className="text-xs text-zinc-400">Wall color</span>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      {WALLPAPER_OPTIONS.map((w) => (
                        <button
                          key={w.id}
                          onClick={() => updateRoom({ wallpaper: w.id })}
                          className={`rounded-lg border px-1.5 py-1.5 text-[10px] transition-colors ${
                            activeSet.room.wallpaper === w.id
                              ? "border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-300"
                              : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Room
                    </p>
                    <div className="space-y-1.5">
                      {(
                        [
                          ["Width", "width"],
                          ["Depth", "depth"],
                          ["Height", "height"],
                        ] as [string, keyof Pick<RoomState, "width" | "depth" | "height">][]
                      ).map(([label, key]) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className="w-14 text-[11px] text-zinc-500">{label}</span>
                          <input
                            type="range"
                            min={1}
                            max={12}
                            step={0.1}
                            value={activeSet.room[key]}
                            onChange={(e) => updateRoom({ [key]: Number(e.target.value) } as Partial<RoomState>)}
                            className="flex-1 accent-fuchsia-500"
                          />
                          <span className="w-10 text-right font-mono text-xs text-zinc-300">
                            {Math.round(activeSet.room[key] * 10) / 10}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-[11px] text-zinc-500">Wall count</span>
                        <div className="grid flex-1 grid-cols-5 gap-1">
                          {([0, 1, 2, 3, 4] as const).map((n) => (
                            <button
                              key={n}
                              onClick={() => updateRoom({ wallMode: n })}
                              title={
                                n === 0
                                  ? "Open stage"
                                  : n === 1
                                    ? "Back wall only"
                                    : n === 2
                                      ? "Back + left wall"
                                      : n === 3
                                        ? "Box set — open front"
                                        : "Full room"
                              }
                              className={`rounded-md border px-1 py-1.5 text-[11px] font-medium transition-colors ${
                                activeSet.room.wallMode === n
                                  ? "border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-300"
                                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                              }`}
                            >
                              {n === 0 ? "—" : n}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(
                        [
                          ["ceiling", "Ceiling"],
                          ["grid", "Floor grid"],
                        ] as [keyof Pick<RoomState, "ceiling" | "grid">, string][]
                      ).map(([key, label]) => (
                        <label key={key} className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={activeSet.room[key]}
                            onChange={(e) => updateRoom({ [key]: e.target.checked } as Partial<RoomState>)}
                            className="h-3.5 w-3.5 accent-fuchsia-500"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Lighting (manual)
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-24 text-[11px] text-zinc-500">Sky</span>
                        <input
                          type="color"
                          value={activeSet.environment.sky}
                          onChange={(e) => updateEnv({ sky: e.target.value })}
                          className="h-7 w-9 cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900"
                        />
                        <label className="ml-1 flex items-center gap-1.5 text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={activeSet.environment.fog}
                            onChange={(e) => updateEnv({ fog: e.target.checked })}
                            className="h-3.5 w-3.5 accent-sky-500"
                          />
                          Fog
                        </label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-24 text-[11px] text-zinc-500">Ambient</span>
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.05}
                          value={activeSet.environment.ambient.intensity}
                          onChange={(e) =>
                            updateEnv({
                              ambient: { ...activeSet.environment.ambient, intensity: Number(e.target.value) },
                            })
                          }
                          className="flex-1 accent-sky-500"
                        />
                        <span className="w-9 text-right font-mono text-xs text-zinc-300">
                          {Math.round(activeSet.environment.ambient.intensity * 100) / 100}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-24 text-[11px] text-zinc-500">Key light</span>
                        <input
                          type="checkbox"
                          checked={activeSet.environment.key !== null}
                          onChange={(e) =>
                            updateEnv({
                              key: e.target.checked
                                ? { color: "#ffffff", intensity: 1.4, x: 4, y: 8, z: 3 }
                                : null,
                            })
                          }
                          className="h-3.5 w-3.5 accent-sky-500"
                        />
                        <input
                          type="range"
                          min={0}
                          max={4}
                          step={0.1}
                          disabled={activeSet.environment.key === null}
                          value={activeSet.environment.key?.intensity ?? 0}
                          onChange={(e) =>
                            activeSet.environment.key &&
                            updateEnv({
                              key: { ...activeSet.environment.key, intensity: Number(e.target.value) },
                            })
                          }
                          className="flex-1 accent-sky-500 disabled:opacity-40"
                        />
                        <span className="w-9 text-right font-mono text-xs text-zinc-300">
                          {activeSet.environment.key ? Math.round(activeSet.environment.key.intensity * 10) / 10 : "off"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-24 text-[11px] text-zinc-500">Fill light</span>
                        <input
                          type="checkbox"
                          checked={activeSet.environment.fill !== null}
                          onChange={(e) =>
                            updateEnv({
                              fill: e.target.checked ? { color: "#9fb6ff", intensity: 0.5 } : null,
                            })
                          }
                          className="h-3.5 w-3.5 accent-sky-500"
                        />
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.05}
                          disabled={activeSet.environment.fill === null}
                          value={activeSet.environment.fill?.intensity ?? 0}
                          onChange={(e) =>
                            activeSet.environment.fill &&
                            updateEnv({
                              fill: { ...activeSet.environment.fill, intensity: Number(e.target.value) },
                            })
                          }
                          className="flex-1 accent-sky-500 disabled:opacity-40"
                        />
                        <span className="w-9 text-right font-mono text-xs text-zinc-300">
                          {activeSet.environment.fill ? Math.round(activeSet.environment.fill.intensity * 100) / 100 : "off"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="font-semibold">Error: </span>
          {error}
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-600">
        The filming set is stored per account — switch sets with the project bar. {enabledTotal} key(s)
        enabled. Add a set like “dapur atuk”, dress it with props, and generate lighting from a prompt.
      </p>
    </div>
  );
}