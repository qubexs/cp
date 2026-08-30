"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { advanceRotation, nextRotationOrderFromAccount, updateKeyStatus, type Account } from "@/lib/auth";
import { DEFAULT_STATE, ENV_PRESETS, buildCinematicImagePrompt, buildCinematicPrompt, buildCinematicUserPrompt, CINEMATIC_IMAGE_SYSTEM_PROMPT, CINEMATIC_SYSTEM_PROMPT } from "@/lib/cinematic";
import type { ToolId } from "@/components/Sidebar";
import { appendAttachmentParts, chatWithKeys, OpenRouterError } from "@/lib/openrouter";
import { MODELS, type ModelChoice } from "@/lib/types";
import { buildSplitPrompt, estimateBatches, makeStoryboardScene, parseSplitResult, STORY_SPLIT_SYSTEM_PROMPT, useStoryboardProjects } from "@/lib/storyboard";
export type PendingTransfer = { sceneText: string; cinematicState: import("@/lib/cinematic").CinematicState; imagePrompt?: string; videoPrompt?: string; sourceSceneId: string };
export default function StoryboardBoard({ account, refreshAccount, openKeys, onSend }: { account: Account; refreshAccount: () => void; openKeys: () => void; onSend?: (target: ToolId, payload: PendingTransfer) => void }) {
  const sb = useStoryboardProjects(account.email);
  const active = sb.activeProject;
  const [view, setView] = useState<"list" | "grid">("grid");
  const [newTitle, setNewTitle] = useState("");
  const [model, setModel] = useState<ModelChoice>("google/gemini-2.5-flash");
  const [batchSize, setBatchSize] = useState<10 | 15 | 20>(15);
  const [splitting, setSplitting] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const showDone = isDone || !!active?.splitDone;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "needImage" | "needVideo" | "done">("all");
  const [sendOpen, setSendOpen] = useState<string | null>(null);
  const [storyEnv, setStoryEnv] = useState(ENV_PRESETS[0].id);
  const [storyCharacters, setStoryCharacters] = useState(() => DEFAULT_STATE.characters.map((c) => ({ ...c, avatarUrl: undefined as string | undefined })));
  const [promptMenuOpen, setPromptMenuOpen] = useState<string | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rename, setRename] = useState("");
  const enabled = useMemo(() => account.keys.filter((k) => k.enabled), [account]);
  const doCopy = useCallback(async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
    setCopiedId(id); setTimeout(() => setCopiedId(null), 1500);
  }, []);
  const [uploading, setUploading] = useState<{ id: string; type: "image" | "video"; progress: number } | null>(null);
  const handleAttach = useCallback((sceneId: string, type: "image" | "video", file: File | undefined) => {
    if (!file) return;
    if (type === "video" && file.size > 40 * 1024 * 1024) { setError("Video too large (40MB max)"); return; }
    const id = sceneId + (type === "image" ? ":imgUp" : ":vidUp");
    setUploading({ id, type, progress: 0 });
    if (type === "video") {
      const url = URL.createObjectURL(file);
      let p = 0;
      const iv = setInterval(() => {
        p += 25;
        if (p >= 100) { clearInterval(iv); sb.updateScene(sceneId, { videoUrl: url, videoName: file.name }); setUploading(null); }
        else setUploading({ id, type, progress: p });
      }, 120);
      return;
    }
    const reader = new FileReader();
    reader.onprogress = (e) => { if (e.lengthComputable) setUploading({ id, type, progress: Math.round((e.loaded / e.total) * 100) }); };
    reader.onload = () => {
      const url = String(reader.result);
      sb.updateScene(sceneId, { imageUrl: url, imageName: file.name });
      setUploading(null);
    };
    reader.onerror = () => { setError("Failed to read file"); setUploading(null); };
    reader.readAsDataURL(file);
  }, [sb]);
  const doSplit = useCallback(async (mode: "fresh" | "next") => {
    if (!active || !active.storyText.trim()) { setError("Enter story text first."); return; }
    const order = nextRotationOrderFromAccount(account);
    if (!order.length) { setError("No enabled API keys."); openKeys(); return; }
    setError(null); setSplitting(true);
    try {
      const already = mode === "next" ? active.scenes : [];
      const userPrompt = buildSplitPrompt(active.storyText, batchSize, already.length, already.map((s) => s.sceneText));
      const r = await chatWithKeys({ keys: order.map((k) => ({ id: k.id, key: k.key, label: k.label, provider: k.provider })), model, body: { messages: [{ role: "system", content: STORY_SPLIT_SYSTEM_PROMPT }, { role: "user", content: userPrompt }], temperature: 0.4, max_tokens: 4096 } });
      r.attempts?.forEach((a) => a.keyId && updateKeyStatus(account.email, a.keyId, { ok: a.ok, errorMessage: a.errorMessage }));
      advanceRotation(account.email); refreshAccount();
      const scenes = parseSplitResult(r.content);
      if (!scenes.length) { sb.setSplitDone(true, batchSize); setIsDone(true); throw new Error("No more scenes — story complete."); }
      const template = DEFAULT_STATE;
      const totalAfter = mode === "next" ? already.length + scenes.length : scenes.length;
      const estimatedNeeded = Math.max(1, Math.ceil(active.storyText.trim().split(/\s+/).length / 35));
      const done = scenes.length < batchSize || totalAfter >= estimatedNeeded;
      if (mode === "next") {
        const startIdx = already.length;
        sb.setScenes((prev) => [...prev, ...scenes.map((t, i) => makeStoryboardScene(startIdx + i, t, template))]);
      } else {
        sb.setScenes(() => scenes.map((t, i) => makeStoryboardScene(i, t, template)));
      }
      sb.setSplitDone(done, batchSize);
      setIsDone(done);
    } catch (e) {
      if (e instanceof OpenRouterError) e.attempts?.forEach((a) => a.keyId && updateKeyStatus(account.email, a.keyId, { ok: false, errorMessage: a.errorMessage }));
      setError(e instanceof Error ? e.message : "Split failed");
    } finally { setSplitting(false); }
  }, [active, account, model, batchSize, refreshAccount, openKeys, sb]);
  const splitStory = useCallback(() => { sb.setSplitDone(false); setIsDone(false); doSplit("fresh"); }, [doSplit, sb]);
  const splitNext = useCallback(() => doSplit("next"), [doSplit]);
  const genImage = useCallback(async (sceneId: string) => {
    if (!active) return;
    const scene = active.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const idx = active.scenes.findIndex((x) => x.id === sceneId);
    const isFirst = idx === 0;
    if (!isFirst) {
      const prev = active.scenes[idx - 1];
      if (!prev.imageUrl && !prev.cinematicState.sceneRef) { setError(`Scene ${idx} needs reference image first (for continuity)`); return; }
    }
    const order = nextRotationOrderFromAccount(account);
    if (!order.length) { setError("No enabled API keys."); openKeys(); return; }
    setGenerating(sceneId + ":img"); setError(null);
    try {
      const st = scene.cinematicState;
      const prev = idx > 0 ? active.scenes[idx - 1] : null;
      const prevRef = !isFirst && prev?.imageUrl ? ` Previous scene image reference available for continuity (scene ${idx}).` : !isFirst && prev?.cinematicState.sceneRef ? ` Previous scene reference ${prev.cinematicState.sceneRef}.` : "";
      const userText = buildCinematicUserPrompt(scene.sceneText + ` [TARGET: IMAGE single frame]` + prevRef, st, { image: prev?.imageUrl ? 1 : 0, video: 0 });
      const content: import("@/lib/providers").ContentPart[] = [{ type: "text", text: userText }];
      if (prev?.imageUrl) content.push({ type: "image_url", image_url: { url: prev.imageUrl } } as any);
      const r = await chatWithKeys({ keys: order.map((k) => ({ id: k.id, key: k.key, label: k.label, provider: k.provider })), model, body: { messages: [{ role: "system", content: CINEMATIC_IMAGE_SYSTEM_PROMPT }, { role: "user", content }], temperature: 0.4, max_tokens: 4096 } });
      r.attempts?.forEach((a) => a.keyId && updateKeyStatus(account.email, a.keyId, { ok: a.ok, errorMessage: a.errorMessage }));
      advanceRotation(account.email); refreshAccount();
      const prompt = r.content.trim() || buildCinematicImagePrompt(st);
      sb.updateScene(sceneId, { imagePrompt: prompt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image prompt failed");
    } finally { setGenerating(null); }
  }, [active, account, model, refreshAccount, openKeys, sb]);
  const genVideo = useCallback(async (sceneId: string) => {
    if (!active) return;
    const scene = active.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const idx = active.scenes.findIndex((x) => x.id === sceneId);
    const isFirst = idx === 0;
    if (!isFirst) {
      const prev = active.scenes[idx - 1];
      if (!prev.imageUrl && !prev.cinematicState.sceneRef) { setError(`Scene ${idx} needs reference image first (for continuity)`); return; }
    }
    const order = nextRotationOrderFromAccount(account);
    if (!order.length) { setError("No enabled API keys."); openKeys(); return; }
    setGenerating(sceneId + ":vid"); setError(null);
    try {
      const st = scene.cinematicState;
      const prev = idx > 0 ? active.scenes[idx - 1] : null;
      const prevRef = !isFirst && prev?.imageUrl ? ` Previous scene image reference for continuity (scene ${idx}).` : !isFirst && prev?.cinematicState.sceneRef ? ` Previous scene reference ${prev.cinematicState.sceneRef}.` : "";
      const userText = buildCinematicUserPrompt(scene.sceneText + ` [TARGET: VIDEO 8s locked shot]` + prevRef, st, { image: prev?.imageUrl ? 1 : 0, video: 0 });
      const content: import("@/lib/providers").ContentPart[] = [{ type: "text", text: userText }];
      if (prev?.imageUrl) content.push({ type: "image_url", image_url: { url: prev.imageUrl } } as any);
      const r = await chatWithKeys({ keys: order.map((k) => ({ id: k.id, key: k.key, label: k.label, provider: k.provider })), model, body: { messages: [{ role: "system", content: CINEMATIC_SYSTEM_PROMPT }, { role: "user", content }], temperature: 0.4, max_tokens: 4096 } });
      r.attempts?.forEach((a) => a.keyId && updateKeyStatus(account.email, a.keyId, { ok: a.ok, errorMessage: a.errorMessage }));
      advanceRotation(account.email); refreshAccount();
      const prompt = r.content.trim() || buildCinematicPrompt(st);
      sb.updateScene(sceneId, { videoPrompt: prompt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Video prompt failed");
    } finally { setGenerating(null); }
  }, [active, account, model, refreshAccount, openKeys, sb]);
  const genAll = useCallback(async (kind: "image" | "video") => {
    if (!active) return;
    setBulk(true);
    for (const s of active.scenes) {
      if (kind === "image" && s.imagePrompt) continue;
      if (kind === "video" && s.videoPrompt) continue;
      if (kind === "image") await genImage(s.id);
      else await genVideo(s.id);
    }
    setBulk(false);
  }, [active, genImage, genVideo]);
  const filteredScenes = useMemo(() => {
    if (!active) return [];
    if (filter === "needImage") return active.scenes.filter((s) => !s.imagePrompt);
    if (filter === "needVideo") return active.scenes.filter((s) => !s.videoPrompt);
    if (filter === "done") return active.scenes.filter((s) => s.imagePrompt && s.videoPrompt);
    return active.scenes;
  }, [active, filter]);
  const imgCount = active ? active.scenes.filter((s) => s.imagePrompt).length : 0;
  const vidCount = active ? active.scenes.filter((s) => s.videoPrompt).length : 0;
  const total = active ? active.scenes.length : 0;
  const pctImg = total ? Math.round((imgCount / total) * 100) : 0;
  const pctVid = total ? Math.round((vidCount / total) * 100) : 0;
  const selected = active?.scenes.find((s) => s.id === selectedId) ?? null;
  const sceneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  if (!active) return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">No storyboard.</div>;
  return (
    <div className="grid gap-6 w-full max-w-none lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] items-start">
      <div className="grid gap-6 min-w-0">
        <div className="rounded-2xl border border-fuchsia-500/40 bg-zinc-900/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-sky-500 text-lg">📚</div>
              <div><h2 className="text-sm font-bold">Storyboard</h2><p className="text-[11px] text-zinc-500">Story → scene list → cinematic image → cinematic video (each via Cinematic Lab)</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setView(view === "grid" ? "list" : "grid")} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs">{view === "grid" ? "▦ List" : "⊞ Grid"}</button>
              <select value={model} onChange={(e) => setModel(e.target.value as ModelChoice)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs">
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <button onClick={openKeys} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs">Keys {enabled.length}/{account.keys.length}</button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <select value={active.id} onChange={(e) => sb.selectProject(e.target.value)} className="min-w-48 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs">
              {sb.projects.map((p) => <option key={p.id} value={p.id}>{p.title} — {p.scenes.length} scenes</option>)}
            </select>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New title" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs" />
            <button onClick={() => { if (newTitle.trim()) sb.createProject(newTitle); setNewTitle(""); }} className="rounded-lg bg-fuchsia-500/20 px-3 py-1.5 text-xs text-fuchsia-200">+ New</button>
            <input value={rename} onChange={(e) => setRename(e.target.value)} placeholder="Rename" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs" />
            <button onClick={() => { sb.renameProject(rename); setRename(""); }} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs">Rename</button>
            <button onClick={() => sb.deleteProject(active.id)} className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300">Delete</button>
          </div>
        </div>
        {view === "grid" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {sb.projects.map((p) => (
              <div key={p.id} className={`relative rounded-xl border p-4 ${p.id === active.id ? "border-fuchsia-500/50 bg-fuchsia-500/10" : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"}`}>
                <button onClick={() => sb.selectProject(p.id)} className="w-full text-left">
                  <p className="pr-6 text-sm font-medium">{p.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">{p.scenes.length} scenes · {p.scenes.filter((s) => s.imagePrompt).length} images · {p.scenes.filter((s) => s.videoPrompt).length} videos</p>
                  <p className="mt-2 line-clamp-3 text-xs text-zinc-600">{p.storyText || "No story yet"}</p>
                </button>
                <div className="absolute right-2 top-2">
                  <button onClick={(e) => { e.stopPropagation(); setProjectMenuOpen(projectMenuOpen === p.id ? null : p.id); }} className="rounded-lg border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs hover:bg-zinc-800">⋮</button>
                  {projectMenuOpen === p.id && (
                    <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
                      <div className="relative">
                        <button
                          onClick={() => {
                            const cur = p.scenes[0]?.cinematicState;
                            const curId = cur ? ENV_PRESETS.find((x) => x.timeOfDay === cur.timeOfDay)?.id : null;
                            const next = ENV_PRESETS.find((x) => x.id !== curId && x.id !== "custom") ?? ENV_PRESETS[0];
                            sb.setEnvironment(next);
                            setProjectMenuOpen(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800"
                        >
                          🌅 Environment
                        </button>
                        <div className="mx-2 border-t border-zinc-800" />
                        <button onClick={() => { sb.duplicateProject(p.id); setProjectMenuOpen(null); }} className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800">⧉ Duplicate</button>
                        <div className="mx-2 border-t border-zinc-800" />
                        <button onClick={() => { if (confirm(`Delete "${p.title}"?`)) sb.deleteProject(p.id); setProjectMenuOpen(null); }} className="w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-red-500/10">🗑️ Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {sb.projects.map((p) => (
              <button key={p.id} onClick={() => sb.selectProject(p.id)} className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${p.id === active.id ? "bg-fuchsia-500/10 text-white" : "bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900"}`}>
                <span>{p.title}</span><span className="text-xs text-zinc-500">{p.scenes.length} scenes</span>
              </button>
            ))}
          </div>
        )}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Story — whole narrative (paste full story, characters, journey)</label>
          <textarea value={active.storyText} onChange={(e) => sb.setStoryText(e.target.value)} rows={8} placeholder="Once upon a time... Atuk, Atan and Acik discover the giant bean tree in the village square. The tree bursts through the square, villagers gather... Keep spatial order Atuk-Atan-Acik-Tree. Atuk holds glowing bean basket in RIGHT hand..." className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm outline-none focus:border-fuchsia-500" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-600">{active.storyText.length} chars · {active.storyText.trim() ? active.storyText.trim().split(/\s+/).length : 0} words · ~{estimateBatches(active.storyText, batchSize)} batches · {active.scenes.length} scenes</span>
            <div className="flex items-center gap-2">
              <select value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value) as 10 | 15 | 20)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs">
                <option value={10}>10 / batch</option>
                <option value={15}>15 / batch</option>
                <option value={20}>20 / batch</option>
              </select>
              <button onClick={splitStory} disabled={splitting || !active.storyText.trim()} className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-sky-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {splitting ? "✂️ Splitting…" : `✂️ Split First ${batchSize}`}
              </button>
              {active.scenes.length > 0 && (
                showDone ? (
                  <span className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-2 text-sm font-semibold text-emerald-300">✓ Done — all scenes</span>
                ) : (
                  <button onClick={splitNext} disabled={splitting || !active.storyText.trim()} className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/15 px-5 py-2 text-sm font-semibold text-fuchsia-200 disabled:opacity-40">
                    {splitting ? "…" : `➡️ Next ${batchSize}`}
                  </button>
                )
              )}
            </div>
          </div>
          {error && <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <select value={storyEnv} onChange={(e) => { const id = e.target.value; setStoryEnv(id); const preset = ENV_PRESETS.find((x) => x.id === id); if (preset && preset.id !== "custom") sb.setEnvironment(preset); }} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs">
              {ENV_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {storyCharacters.slice(0, 8).map((char) => (
              <div key={char.id} className="flex flex-col items-center gap-1">
                <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-900 hover:border-fuchsia-500/50">
                  {(char as any).avatarUrl ? <img src={(char as any).avatarUrl} alt={char.name} className="h-full w-full object-cover" /> : <span className="text-[8px] text-zinc-500">Up</span>}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const base = f.name.replace(/\.[^/.]+$/, ""); const name = base.charAt(0).toUpperCase() + base.slice(1); const r = new FileReader(); r.onload = () => setStoryCharacters((prev) => prev.map((x) => x.id === char.id ? { ...x, name, avatarUrl: String(r.result) } as any : x)); r.readAsDataURL(f); }} />
                </label>
                <input value={char.name} onChange={(e) => setStoryCharacters((prev) => prev.map((x) => x.id === char.id ? { ...x, name: e.target.value } : x))} className="w-9 truncate rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-center text-[10px] outline-none focus:border-fuchsia-500" placeholder="Name" />
              </div>
            ))}
            {storyCharacters.length > 8 ? (
              <span className="text-[10px] text-zinc-500">… +{storyCharacters.length - 8} more</span>
            ) : (
              <button onClick={() => setStoryCharacters((prev) => [...prev, { id: Date.now().toString(), name: "New", code: "NEW_LP", weight: "0.95", description: "", avatarUrl: undefined } as any])} className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-zinc-700 text-[11px] text-zinc-500 hover:border-fuchsia-500/50">+</button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => genAll("image")} disabled={bulk || !active.scenes.length} className="rounded-xl bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-200 disabled:opacity-40">🎨 Generate All Image Prompts ({imgCount}/{total})</button>
          <button onClick={() => genAll("video")} disabled={bulk || !active.scenes.length} className="rounded-xl bg-fuchsia-500/20 px-4 py-2 text-xs font-semibold text-fuchsia-200 disabled:opacity-40">🎬 Generate All Video Prompts ({vidCount}/{total})</button>
          <button onClick={() => sb.setScenes(() => [])} className="rounded-xl border border-zinc-700 px-4 py-2 text-xs">Clear scenes</button>
          <button onClick={() => sb.setScenes((prev) => [...prev, makeStoryboardScene(prev.length, "New scene description...", DEFAULT_STATE)])} className="rounded-xl border border-zinc-700 px-4 py-2 text-xs">+ Add scene</button>
        </div>
        <div className="grid gap-4">
          {filteredScenes.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-600">{active.scenes.length === 0 ? "No scenes yet — paste story and Split into Scenes" : "No scenes match filter"}</p> : filteredScenes.map((scene) => {
            const i = active.scenes.findIndex((x) => x.id === scene.id);
            const sendPayload: PendingTransfer = { sceneText: scene.sceneText, cinematicState: scene.cinematicState, imagePrompt: scene.imagePrompt || undefined, videoPrompt: scene.videoPrompt || undefined, sourceSceneId: scene.id };
            return (
              <div key={scene.id} ref={(el) => { sceneRefs.current[scene.id] = el; }} onClick={() => setSelectedId(scene.id)} className={`rounded-2xl border p-4 cursor-pointer transition-colors ${selectedId === scene.id ? "border-fuchsia-500/50 bg-fuchsia-500/5" : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Scene {i + 1} {scene.imagePrompt && scene.videoPrompt ? "✓" : scene.imagePrompt || scene.videoPrompt ? "◐" : "○"}</h3>
                  <div className="flex gap-1">
                    <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); sb.setScenes((prev) => { const idx = prev.findIndex((x) => x.id === scene.id); if (idx <= 0) return prev; const a = [...prev]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a.map((s, ii) => ({ ...s, idx: ii })); }); }} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-30">↑</button>
                    <button disabled={i === total - 1} onClick={(e) => { e.stopPropagation(); sb.setScenes((prev) => { const idx = prev.findIndex((x) => x.id === scene.id); if (idx < 0 || idx >= prev.length - 1) return prev; const a = [...prev]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; return a.map((s, ii) => ({ ...s, idx: ii })); }); }} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-30">↓</button>
                    <button onClick={(e) => { e.stopPropagation(); sb.setScenes((prev) => prev.filter((s) => s.id !== scene.id).map((s, ii) => ({ ...s, idx: ii }))); }} className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">✕</button>
                  </div>
                </div>
                <label className="mt-2 block text-[11px] uppercase tracking-wider text-zinc-500">Scene text (editable, flows to cinematic scene)</label>
                <textarea value={scene.sceneText} onChange={(e) => sb.updateScene(scene.id, { sceneText: e.target.value, cinematicState: { ...scene.cinematicState, scene: e.target.value } })} onClick={(e) => e.stopPropagation()} rows={3} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-fuchsia-500" />
                <div className="mt-2 grid gap-2">
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); genImage(scene.id); }} disabled={!!generating} title={(() => { const idx = active.scenes.findIndex((x) => x.id === scene.id); if (idx > 0) { const prev = active.scenes[idx - 1]; if (!prev.imageUrl && !prev.cinematicState.sceneRef) return `Scene ${idx} needs image first`; } return undefined; })()} className="flex-1 rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{generating === scene.id + ":img" ? "Forging…" : "🖼️ To Image Prompt"}</button>
                    <button onClick={(e) => { e.stopPropagation(); genVideo(scene.id); }} disabled={!!generating} title={(() => { const idx = active.scenes.findIndex((x) => x.id === scene.id); if (idx > 0) { const prev = active.scenes[idx - 1]; if (!prev.imageUrl && !prev.cinematicState.sceneRef) return `Scene ${idx} needs image first`; } return undefined; })()} className="flex-1 rounded-xl bg-fuchsia-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{generating === scene.id + ":vid" ? "Forging…" : "🎬 To Video Prompt"}</button>
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setSendOpen(sendOpen === scene.id ? null : scene.id); }} className="rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-2 text-xs hover:bg-zinc-700">⋮</button>
                      {sendOpen === scene.id && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
                          {[
                            { id: "forge", label: "⚡ Prompt Forge" },
                            { id: "cinematic", label: "🎞️ Cinematic Lab" },
                            { id: "stage", label: "🎬 Scene Stage" },
                            { id: "stagevideo", label: "📽️ Scene Video Stage" },
                            { id: "filmset", label: "🎥 Filming Set 3D" },
                            { id: "analyze", label: "🔍 Analyze" },
                            { id: "sceneflow", label: "🎞️ Scene Flow" },
                            { id: "continuity", label: "🧩 Continuity" },
                            { id: "drift", label: "📐 Drift Detect" },
                            { id: "defect", label: "🔬 Defect Scan" },
                          ].map((t) => (
                            <button key={t.id} onClick={() => { onSend?.(t.id as ToolId, sendPayload); setSendOpen(null); }} className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800">
                              {t.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {scene.imagePrompt && (
                    <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                      <div className={`rounded-xl border bg-zinc-950 p-3 cursor-pointer ${editingId === scene.id + ":img" ? "border-sky-400 ring-1 ring-sky-500/40" : "border-sky-500/30"} ${selectedId === scene.id ? "ring-1 ring-sky-500/20" : ""}`} onClick={() => setSelectedId(scene.id)}>
                        <div className="flex items-center justify-between"><p className="text-xs font-semibold text-sky-300">Image prompt</p><div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}><button onClick={() => doCopy(scene.imagePrompt, scene.id + ":img")} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">{copiedId === scene.id + ":img" ? "✓ Copied" : "Copy"}</button><button onClick={() => { setEditingId(scene.id + ":img"); setEditValue(scene.imagePrompt); }} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">Edit</button><div className="relative"><button onClick={() => setPromptMenuOpen(promptMenuOpen === scene.id + ":img" ? null : scene.id + ":img")} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">⋮</button>{promptMenuOpen === scene.id + ":img" && (<div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">{[{ id: "forge", label: "⚡ Prompt Forge" },{ id: "cinematic", label: "🎞️ Cinematic Lab" },{ id: "stage", label: "🎬 Scene Stage" },{ id: "stagevideo", label: "📽️ Scene Video Stage" },{ id: "filmset", label: "🎥 Filming Set 3D" },{ id: "analyze", label: "🔍 Analyze" },{ id: "sceneflow", label: "🎞️ Scene Flow" },{ id: "continuity", label: "🧩 Continuity" },{ id: "drift", label: "📐 Drift Detect" },{ id: "defect", label: "🔬 Defect Scan" }].map((t) => (<button key={t.id} onClick={() => { onSend?.(t.id as ToolId, { sceneText: scene.imagePrompt, cinematicState: scene.cinematicState, imagePrompt: scene.imagePrompt, videoPrompt: scene.videoPrompt || undefined, sourceSceneId: scene.id }); setPromptMenuOpen(null); }} className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800">{t.label}</button>))}</div>)}</div></div></div>
                        {editingId === scene.id + ":img" ? (
                          <div className="mt-2 grid gap-2">
                            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={8} className="w-full rounded-lg border border-sky-500/50 bg-zinc-900 px-3 py-2 font-mono text-xs outline-none" />
                            <div className="flex gap-2">
                              <button onClick={() => { sb.updateScene(scene.id, { imagePrompt: editValue }); setEditingId(null); }} className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white">Save</button>
                              <button onClick={() => setEditingId(null)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-300">{scene.imagePrompt}</pre>
                            <button onClick={() => { const b = new Blob([scene.imagePrompt], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `scene-${i + 1}-image.txt`; a.click(); URL.revokeObjectURL(u); }} className="mt-2 text-xs text-sky-400 hover:underline">Download .txt</button>
                          </>
                        )}
                      </div>
                      <div className="rounded-xl border border-sky-500/30 bg-zinc-950 p-3" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleAttach(scene.id, "image", e.dataTransfer.files?.[0]); }}>
                        <div className="flex items-center justify-between"><p className="text-xs font-semibold text-sky-300">Image preview</p><div className="flex items-center gap-1"><label className="cursor-pointer rounded-lg border border-sky-500/30 bg-sky-500/15 px-2 py-1 text-xs text-sky-200 hover:bg-sky-500/25">Attach Image<input type="file" accept="image/*" className="hidden" onChange={(e) => handleAttach(scene.id, "image", e.target.files?.[0])} /></label><div className="relative"><button onClick={() => setPromptMenuOpen(promptMenuOpen === scene.id + ":imgAttach" ? null : scene.id + ":imgAttach")} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">⋮</button>{promptMenuOpen === scene.id + ":imgAttach" && (<div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">{[{ id: "forge", label: "⚡ Prompt Forge" },{ id: "cinematic", label: "🎞️ Cinematic Lab" },{ id: "stage", label: "🎬 Scene Stage" },{ id: "stagevideo", label: "📽️ Scene Video Stage" },{ id: "filmset", label: "🎥 Filming Set 3D" },{ id: "analyze", label: "🔍 Analyze" },{ id: "sceneflow", label: "🎞️ Scene Flow" },{ id: "continuity", label: "🧩 Continuity" },{ id: "drift", label: "📐 Drift Detect" },{ id: "defect", label: "🔬 Defect Scan" }].map((t) => (<button key={t.id} onClick={() => { onSend?.(t.id as ToolId, { sceneText: scene.imagePrompt || scene.sceneText, cinematicState: scene.cinematicState, imagePrompt: scene.imagePrompt, videoPrompt: scene.videoPrompt || undefined, sourceSceneId: scene.id }); setPromptMenuOpen(null); }} className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800">{t.label}</button>))}</div>)}</div></div></div>
                        {uploading?.id === scene.id + ":imgUp" ? (
                          <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                            <div className="flex justify-between text-xs"><span className="text-zinc-400">Uploading image…</span><span className="text-sky-300">{uploading.progress}%</span></div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-sky-500 transition-all" style={{ width: `${uploading.progress}%` }} /></div>
                          </div>
                        ) : scene.imageUrl ? (
                          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
                            <img src={scene.imageUrl} alt={scene.imageName ?? "image"} className="max-h-48 w-full object-contain bg-black" />
                            <div className="flex items-center justify-between bg-zinc-900 px-2 py-1">
                              <span className="truncate text-[11px] text-emerald-400">✓ {scene.imageName}</span>
                              <button onClick={() => sb.updateScene(scene.id, { imageUrl: undefined, imageName: undefined })} className="text-[11px] text-red-400 hover:underline">Remove</button>
                            </div>
                          </div>
                        ) : (
                          <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleAttach(scene.id, "image", e.dataTransfer.files?.[0]); }} className="mt-2 flex h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900 text-xs text-zinc-500 hover:border-sky-500/50 hover:text-sky-300">
                            <span className="text-lg">🖼️</span><span>Attach image</span><span className="text-[10px] text-zinc-600">or drag & drop</span><input type="file" accept="image/*" className="hidden" onChange={(e) => handleAttach(scene.id, "image", e.target.files?.[0])} />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                  {scene.videoPrompt && (
                    <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                      <div className={`rounded-xl border bg-zinc-950 p-3 cursor-pointer ${editingId === scene.id + ":vid" ? "border-fuchsia-400 ring-1 ring-fuchsia-500/40" : "border-fuchsia-500/30"} ${selectedId === scene.id ? "ring-1 ring-fuchsia-500/20" : ""}`} onClick={() => setSelectedId(scene.id)}>
                        <div className="flex items-center justify-between"><p className="text-xs font-semibold text-fuchsia-300">Video prompt</p><div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}><button onClick={() => doCopy(scene.videoPrompt, scene.id + ":vid")} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">{copiedId === scene.id + ":vid" ? "✓ Copied" : "Copy"}</button><button onClick={() => { setEditingId(scene.id + ":vid"); setEditValue(scene.videoPrompt); }} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">Edit</button><div className="relative"><button onClick={() => setPromptMenuOpen(promptMenuOpen === scene.id + ":vid" ? null : scene.id + ":vid")} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">⋮</button>{promptMenuOpen === scene.id + ":vid" && (<div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">{[{ id: "forge", label: "⚡ Prompt Forge" },{ id: "cinematic", label: "🎞️ Cinematic Lab" },{ id: "stage", label: "🎬 Scene Stage" },{ id: "stagevideo", label: "📽️ Scene Video Stage" },{ id: "filmset", label: "🎥 Filming Set 3D" },{ id: "analyze", label: "🔍 Analyze" },{ id: "sceneflow", label: "🎞️ Scene Flow" },{ id: "continuity", label: "🧩 Continuity" },{ id: "drift", label: "📐 Drift Detect" },{ id: "defect", label: "🔬 Defect Scan" }].map((t) => (<button key={t.id} onClick={() => { onSend?.(t.id as ToolId, { sceneText: scene.videoPrompt, cinematicState: scene.cinematicState, imagePrompt: scene.imagePrompt || undefined, videoPrompt: scene.videoPrompt, sourceSceneId: scene.id }); setPromptMenuOpen(null); }} className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800">{t.label}</button>))}</div>)}</div></div></div>
                        {editingId === scene.id + ":vid" ? (
                          <div className="mt-2 grid gap-2">
                            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={8} className="w-full rounded-lg border border-fuchsia-500/50 bg-zinc-900 px-3 py-2 font-mono text-xs outline-none" />
                            <div className="flex gap-2">
                              <button onClick={() => { sb.updateScene(scene.id, { videoPrompt: editValue }); setEditingId(null); }} className="rounded-lg bg-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white">Save</button>
                              <button onClick={() => setEditingId(null)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-300">{scene.videoPrompt}</pre>
                            <button onClick={() => { const b = new Blob([scene.videoPrompt], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `scene-${i + 1}-video.txt`; a.click(); URL.revokeObjectURL(u); }} className="mt-2 text-xs text-fuchsia-400 hover:underline">Download .txt</button>
                          </>
                        )}
                      </div>
                      <div className="rounded-xl border border-fuchsia-500/30 bg-zinc-950 p-3" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleAttach(scene.id, "video", e.dataTransfer.files?.[0]); }}>
                        <div className="flex items-center justify-between"><p className="text-xs font-semibold text-fuchsia-300">Video preview</p><div className="flex items-center gap-1"><label className="cursor-pointer rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/15 px-2 py-1 text-xs text-fuchsia-200 hover:bg-fuchsia-500/25">Attach Video<input type="file" accept="video/*" className="hidden" onChange={(e) => handleAttach(scene.id, "video", e.target.files?.[0])} /></label><div className="relative"><button onClick={() => setPromptMenuOpen(promptMenuOpen === scene.id + ":vidAttach" ? null : scene.id + ":vidAttach")} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">⋮</button>{promptMenuOpen === scene.id + ":vidAttach" && (<div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">{[{ id: "forge", label: "⚡ Prompt Forge" },{ id: "cinematic", label: "🎞️ Cinematic Lab" },{ id: "stage", label: "🎬 Scene Stage" },{ id: "stagevideo", label: "📽️ Scene Video Stage" },{ id: "filmset", label: "🎥 Filming Set 3D" },{ id: "analyze", label: "🔍 Analyze" },{ id: "sceneflow", label: "🎞️ Scene Flow" },{ id: "continuity", label: "🧩 Continuity" },{ id: "drift", label: "📐 Drift Detect" },{ id: "defect", label: "🔬 Defect Scan" }].map((t) => (<button key={t.id} onClick={() => { onSend?.(t.id as ToolId, { sceneText: scene.videoPrompt || scene.sceneText, cinematicState: scene.cinematicState, imagePrompt: scene.imagePrompt || undefined, videoPrompt: scene.videoPrompt, sourceSceneId: scene.id }); setPromptMenuOpen(null); }} className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800">{t.label}</button>))}</div>)}</div></div></div>
                        {uploading?.id === scene.id + ":vidUp" ? (
                          <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                            <div className="flex justify-between text-xs"><span className="text-zinc-400">Uploading video…</span><span className="text-fuchsia-300">{uploading.progress}%</span></div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${uploading.progress}%` }} /></div>
                          </div>
                        ) : scene.videoUrl ? (
                          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleAttach(scene.id, "video", e.dataTransfer.files?.[0]); }} className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
                            <div className="relative group">
                              <video src={scene.videoUrl} controls playsInline className="max-h-48 w-full bg-black" />
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"><span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-black">▶ Play</span></div>
                            </div>
                            <div className="flex items-center justify-between bg-zinc-900 px-2 py-1">
                              <span className="truncate text-[11px] text-emerald-400">✓ {scene.videoName}</span>
                              <button onClick={() => sb.updateScene(scene.id, { videoUrl: undefined, videoName: undefined })} className="text-[11px] text-red-400 hover:underline">Remove</button>
                            </div>
                          </div>
                        ) : (
                          <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleAttach(scene.id, "video", e.dataTransfer.files?.[0]); }} className="mt-2 flex h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900 text-xs text-zinc-500 hover:border-fuchsia-500/50 hover:text-fuchsia-300">
                            <span className="text-lg">🎬</span><span>Attach video</span><span className="text-[10px] text-zinc-600">or drag & drop</span><input type="file" accept="video/*" className="hidden" onChange={(e) => handleAttach(scene.id, "video", e.target.files?.[0])} />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                  {!scene.imagePrompt && !scene.videoPrompt && <p className="text-center text-xs text-zinc-600">No prompts yet — generate image then video (reuses Cinematic Lab locks)</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <aside className="grid gap-4 lg:sticky lg:top-6 self-start">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Progress</h3>
          <div className="mt-3 grid gap-3">
            <div>
              <div className="flex justify-between text-xs"><span className="text-zinc-500">Images</span><span className="text-sky-300">{imgCount}/{total} {imgCount === total && total ? "✓" : ""}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-sky-500 transition-all" style={{ width: `${pctImg}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-xs"><span className="text-zinc-500">Videos</span><span className="text-fuchsia-300">{vidCount}/{total} {vidCount === total && total ? "✓" : ""}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${pctVid}%` }} /></div>
            </div>
            <div className="flex gap-1.5 pt-1">
              {(["all", "needImage", "needVideo", "done"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-2.5 py-1 text-xs ${filter === f ? "bg-fuchsia-500/20 text-fuchsia-200 ring-1 ring-fuchsia-500/40" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                  {f === "all" ? `All ${total}` : f === "needImage" ? `Need Img ${total - imgCount}` : f === "needVideo" ? `Need Vid ${total - vidCount}` : `Done ${active.scenes.filter((s) => s.imagePrompt && s.videoPrompt).length}`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Scenes</h3>
          <div className="mt-2 max-h-[40vh] overflow-auto divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {active.scenes.map((s, idx) => (
              <button key={s.id} onClick={() => { setSelectedId(s.id); sceneRefs.current[s.id]?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${selectedId === s.id ? "bg-fuchsia-500/10 text-white" : "hover:bg-zinc-800 text-zinc-300"}`}>
                <span className="w-6 font-mono text-zinc-500">{idx + 1}.</span>
                <span className="flex-1 truncate">{s.sceneText.slice(0, 48)}</span>
                <span className="flex gap-1">
                  <span className={`h-2 w-2 rounded-full ${s.imagePrompt ? "bg-sky-400" : "bg-zinc-700"}`} title={s.imagePrompt ? "image done" : "no image"} />
                  <span className={`h-2 w-2 rounded-full ${s.videoPrompt ? "bg-fuchsia-400" : "bg-zinc-700"}`} title={s.videoPrompt ? "video done" : "no video"} />
                </span>
                <span className="text-[11px]">{s.imagePrompt && s.videoPrompt ? "✓" : s.imagePrompt || s.videoPrompt ? "◐" : "○"}</span>
              </button>
            ))}
            {!total && <p className="p-3 text-center text-xs text-zinc-600">No scenes</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}
