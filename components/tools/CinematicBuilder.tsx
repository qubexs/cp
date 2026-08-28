"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import AttachZone from "@/components/AttachZone";
import { advanceRotation, maskKey, nextRotationOrder, updateKeyStatus, type Account } from "@/lib/auth";
import { buildCinematicImagePrompt, buildCinematicPrompt, buildCinematicUserPrompt, CINEMATIC_IMAGE_SYSTEM_PROMPT, CINEMATIC_SYSTEM_PROMPT, DEFAULT_STATE, PIXAR_DEFAULT, STYLE_PRESETS, type CinematicMode, type CinematicState } from "@/lib/cinematic";
import { appendAttachmentParts, chatWithKeys, OpenRouterError, readAttachment } from "@/lib/openrouter";
import { MODELS, type Attachment, type ModelChoice } from "@/lib/types";

export default function CinematicBuilder({ account, refreshAccount, openKeys }: { account: Account; refreshAccount: () => void; openKeys: () => void }) {
  const [s, setS] = useState<CinematicState>(DEFAULT_STATE);
  const [mode, setMode] = useState<CinematicMode>("video");
  const [aiIdeaVideo, setAiIdeaVideo] = useState("lively Malaysian kampung weekly market with Atuk (elderly in kopiah) Atan (striped shirt) Acik (red shirt) walking to keropok lekor stall. Atuk holds orange plastic bag in RIGHT hand. Dialogue: Acik 'Sedapnya...' Penjual 'Mari dik, mari Atuk, 4 keping seringgit.' Atuk 'Haah, yang ni mesti kena beli.' Atan 'Ok Atuk, panas panas tu.' Keep spatial order Atuk-Atan-Acik-stall.");
  const [aiIdeaImage, setAiIdeaImage] = useState("Atuk, Atan and Acik at kampung pasar, standing in front of keropok lekor stall, Atuk holds orange plastic bag in RIGHT hand, spatial order Atuk-Atan-Acik-stall, warm family pose");
  const [model, setModel] = useState<ModelChoice>("google/gemini-2.5-flash");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPromptVideo, setAiPromptVideo] = useState<string | null>(null);
  const [aiPromptImage, setAiPromptImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showBuilder, setShowBuilder] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const enabledKeys = useMemo(() => account.keys.filter((k) => k.enabled), [account]);
  const nextKey = useMemo(() => nextRotationOrder(account.email)[0], [account]);
  const manualImage = useMemo(() => buildCinematicImagePrompt(s), [s]);
  const manualVideo = useMemo(() => buildCinematicPrompt(s), [s]);
  const aiPrompt = mode === "image" ? aiPromptImage : aiPromptVideo;
  const manualPrompt = mode === "image" ? manualImage : manualVideo;
  const displayPrompt = aiPrompt ?? manualPrompt;
  const wordCount = displayPrompt.trim() ? displayPrompt.trim().split(/\s+/).length : 0;
  const aiIdea = mode === "image" ? aiIdeaImage : aiIdeaVideo;
  const setAiIdea = mode === "image" ? setAiIdeaImage : setAiIdeaVideo;

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setPendingCount((c) => c + files.length);
    const out: Attachment[] = [];
    for (const f of files) {
      try { out.push(await readAttachment(f)); } catch { alert(`Could not read ${f.name}`); }
      setPendingCount((c) => c - 1);
    }
    setAttachments((prev) => [...prev, ...out]);
  }, []);

  const onUploadSceneRef = (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    update("sceneRef", f.name);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(f);
    addFiles([f]);
  };

  const generate = useCallback(async () => {
    const order = nextRotationOrder(account.email);
    if (!order.length) { setError("No enabled API keys. Add one in Key Manager."); openKeys(); return; }
    setError(null); setLoading(true);
    try {
      const fileCount = { image: attachments.filter((a) => a.kind === "image").length, video: attachments.filter((a) => a.kind === "video").length };
      const curIdea = mode === "image" ? aiIdeaImage : aiIdeaVideo;
      const userText = buildCinematicUserPrompt(curIdea + (mode === "image" ? " [TARGET: IMAGE single frame, no motion/dialogue]" : " [TARGET: VIDEO 8s locked shot]"), s, fileCount);
      const systemPrompt = mode === "image" ? CINEMATIC_IMAGE_SYSTEM_PROMPT : CINEMATIC_SYSTEM_PROMPT;
      const content: import("@/lib/providers").ContentPart[] = [{ type: "text", text: userText }];
      appendAttachmentParts(content, attachments);
      const r = await chatWithKeys({
        keys: order.map((k) => ({ id: k.id, key: k.key, label: k.label, provider: k.provider })),
        model,
        body: { messages: [{ role: "system", content: systemPrompt }, { role: "user", content }], temperature: 0.4, max_tokens: 4096 },
      });
      r.attempts?.forEach((a) => { if (a.keyId) updateKeyStatus(account.email, a.keyId, { ok: a.ok, errorMessage: a.errorMessage }); });
      advanceRotation(account.email);
      refreshAccount();
      if (mode === "image") setAiPromptImage(r.content.trim()); else setAiPromptVideo(r.content.trim());
      setShowBuilder(false);
    } catch (e) {
      if (e instanceof OpenRouterError) e.attempts?.forEach((a) => { if (a.keyId) updateKeyStatus(account.email, a.keyId, { ok: false, errorMessage: a.errorMessage }); refreshAccount(); });
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally { setLoading(false); }
  }, [account, aiIdeaImage, aiIdeaVideo, mode, s, attachments, model, refreshAccount, openKeys]);

  const update = (k: keyof CinematicState, v: string) => setS((p) => ({ ...p, [k]: v as never }));
  const copy = async () => { await navigator.clipboard.writeText(displayPrompt); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const download = () => {
    const blob = new Blob([displayPrompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = mode === "image" ? "cinematic-image-prompt.txt" : "cinematic-video-prompt.txt"; a.click(); URL.revokeObjectURL(url);
  };
  const clearAi = () => { if (mode === "image") setAiPromptImage(null); else setAiPromptVideo(null); };

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-fuchsia-500/40 bg-zinc-900/60 p-5 shadow-xl shadow-black/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-sky-500 text-lg">🎬</div>
            <div>
              <h2 className="text-sm font-bold">Cinematic Prompt Lab</h2>
              <p className="text-[11px] text-zinc-500">Forge locked identity prompts — image & video — via your own API keys (Turbopack)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden sm:flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] ${enabledKeys.length ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${enabledKeys.length ? "bg-emerald-400" : "bg-red-400"}`} />{enabledKeys.length}/{account.keys.length} keys{nextKey ? ` · next: ${nextKey.label}` : ""}
            </span>
            <button onClick={openKeys} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-fuchsia-500/60 hover:text-fuchsia-300">Keys {enabledKeys.length}/{account.keys.length}</button>
            <button onClick={() => setS({ ...DEFAULT_STATE, styleVisuals: [], scene: "", sceneRef: "", camera: "", spatialOrder: "", spatialOrderNote: "", propLock: "", action: "", performance: "", continuity: "", negativePrompt: "", characters: [], dialogues: [] })} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">+ Blank</button>
            <button onClick={() => { setS(DEFAULT_STATE); setAiPromptImage(null); setAiPromptVideo(null); setShowBuilder(true); }} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300">Load Kampung Example</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-zinc-950 p-1">
          <button onClick={() => setMode("image")} className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${mode === "image" ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}>🖼️ Image Section</button>
          <button onClick={() => setMode("video")} className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${mode === "video" ? "bg-gradient-to-r from-fuchsia-500 to-sky-500 text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}>🎬 Video Section</button>
        </div>
        <p className="mt-2 text-center text-[11px] text-zinc-600">{mode === "image" ? "Single-frame locks: style, identity, scene, camera, spatial order, prop, negative" : "Full locks: + seed, duration, motion, action, dialogue, continuity"}</p>
      </div>

      <div className="rounded-2xl border border-fuchsia-500/60 bg-zinc-900/60 p-5 shadow-xl shadow-black/30">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">✨ AI Generator — {mode === "image" ? "Image" : "Video"} — describe scene in plain words</label>
          <span className="text-[11px] text-zinc-500">{enabledKeys.length ? `next key: ${nextKey ? maskKey(nextKey.key) : "—"}` : "no keys"}</span>
        </div>
        <textarea value={aiIdea} onChange={(e) => setAiIdea(e.target.value)} rows={4} placeholder={mode === "image" ? "e.g. Atuk holds orange bag in RIGHT hand at keropok lekor stall, spatial order Atuk-Atan-Acik-stall, warm family pose, eye-level 50mm..." : "e.g. Atuk and kids walk to keropok lekor stall, Atuk holds orange bag in RIGHT hand, keep left-to-right order Atuk-Atan-Acik-stall, add dialogue..."} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm outline-none focus:border-fuchsia-500" />
        <div className="mt-3">
          <AttachZone attachments={attachments} onAddFiles={addFiles} onRemove={(id) => setAttachments((p) => p.filter((a) => a.id !== id))} onClear={() => setAttachments([])} />
          {pendingCount > 0 && <p className="mt-2 text-xs text-zinc-500">Reading {pendingCount} file(s)…</p>}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <select value={model} onChange={(e) => setModel(e.target.value as ModelChoice)} disabled={loading} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500 disabled:opacity-50">
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <button onClick={generate} disabled={loading || !enabledKeys.length} className={`rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:brightness-110 disabled:opacity-40 ${mode === "image" ? "bg-gradient-to-r from-sky-500 to-cyan-500" : "bg-gradient-to-r from-fuchsia-500 to-sky-500"}`}>
            {loading ? <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />Forging…</span> : mode === "image" ? "🖼️ AI Forge Image Prompt" : "🎬 AI Forge Video Prompt"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">{mode === "image" ? "AI expands into [Style], IDENTITY, SCENE, CAMERA, SPATIAL ORDER, PROP LOCK, POSE, NEGATIVE." : "AI expands into [Style], IDENTITY, SCENE, SEED, DURATION, CAMERA, SPATIAL ORDER, PROP LOCK, ACTION, DIALOGUE, CONTINUITY, NEGATIVE."}</p>
        {enabledKeys.length === 0 && <p className="mt-2 text-xs text-red-300">No enabled keys — open Key Manager to add OpenRouter / Google / Hugging Face key.</p>}
        {error && <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        {aiPrompt && <div className="mt-3 flex gap-2"><button onClick={clearAi} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400">Show Manual {mode} Prompt</button><button onClick={() => { setShowBuilder(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400">Edit Builder Hints</button></div>}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setShowBuilder((v) => !v)} className="text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200">{showBuilder ? "▼ Hide" : "▶ Show"} Manual Builder ({mode})</button>
        <span className="text-[11px] text-zinc-600">Manual fields feed AI as hints + build {mode} prompt without AI</span>
      </div>

      {showBuilder && (
        <>
          <StyleMultiSelect value={s.styleVisuals} onChange={(v) => setS((p) => ({ ...p, styleVisuals: v }))} />
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Locked Character Identity</label>
              <button onClick={() => setS((p) => ({ ...p, characters: [...p.characters, { id: Date.now().toString(), name: "NewChar", code: "CHAR_LP", weight: "0.95", description: "" }] }))} className="rounded-lg bg-fuchsia-500/20 px-2 py-1 text-xs text-fuchsia-300">+ Add</button>
            </div>
            <div className="mt-3 grid gap-2">
              {s.characters.map((c) => (
                <div key={c.id} className="grid grid-cols-[1fr_1fr_80px_1fr_auto] gap-2">
                  <input value={c.name} onChange={(e) => setS((p) => ({ ...p, characters: p.characters.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) }))} placeholder="Name" className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" />
                  <input value={c.code} onChange={(e) => setS((p) => ({ ...p, characters: p.characters.map((x) => (x.id === c.id ? { ...x, code: e.target.value } : x)) }))} placeholder="Code" className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" />
                  <input value={c.weight} onChange={(e) => setS((p) => ({ ...p, characters: p.characters.map((x) => (x.id === c.id ? { ...x, weight: e.target.value } : x)) }))} placeholder="0.95" className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" />
                  <input value={c.description} onChange={(e) => setS((p) => ({ ...p, characters: p.characters.map((x) => (x.id === c.id ? { ...x, description: e.target.value } : x)) }))} placeholder="description" className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" />
                  <button onClick={() => setS((p) => ({ ...p, characters: p.characters.filter((x) => x.id !== c.id) }))} className="text-xs text-red-400">✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 grid gap-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Scene {mode === "image" ? "(image)" : "(video)"}</label>
            <textarea value={s.scene} onChange={(e) => update("scene", e.target.value)} rows={2} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-fuchsia-500" />
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onUploadSceneRef(e.dataTransfer.files?.[0]); }} className="grid gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-3">
              <div className="flex gap-2">
                <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-3 text-xs font-semibold text-fuchsia-300 hover:bg-fuchsia-500/20">📤 Click to Upload Scene Reference</button>
                <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => onUploadSceneRef(e.target.files?.[0])} />
                {preview && <button onClick={() => { setPreview(null); setFileName(""); update("sceneRef", ""); }} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400">Clear</button>}
              </div>
              <p className="text-center text-[11px] text-zinc-600">or drag & drop image/video here — also added to AI references</p>
              {preview ? (
                <div className="overflow-hidden rounded-lg border border-zinc-800">
                  <img src={preview} alt={fileName} className="max-h-48 w-full object-contain bg-black" />
                  <p className="bg-zinc-900 px-2 py-1 text-center text-[11px] text-emerald-400">✓ {fileName} → {s.sceneRef} influence {s.sceneInfluence || "0.9"}</p>
                </div>
              ) : s.sceneRef ? <p className="text-center text-[11px] text-zinc-500">Selected: {s.sceneRef}</p> : null}
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <input value={s.sceneRef} onChange={(e) => update("sceneRef", e.target.value)} placeholder="filename e.g. elderly_man_tomato_bag_1.webp" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
                <input value={s.sceneInfluence} onChange={(e) => update("sceneInfluence", e.target.value)} placeholder="0.9" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
              </div>
            </div>
            {mode === "video" && (
              <div className="grid grid-cols-3 gap-2">
                <L label="SEED" value={s.seed} onChange={(v) => update("seed", v)} />
                <L label="DURATION (s)" value={s.duration} onChange={(v) => update("duration", v)} />
                <L label="MOTION" value={s.motionStrength} onChange={(v) => update("motionStrength", v)} />
              </div>
            )}
          </div>

          <Field label="Camera" value={s.camera} onChange={(v) => update("camera", v)} rows={3} />
          <Field label="Spatial Order (left → right)" value={s.spatialOrder} onChange={(v) => update("spatialOrder", v)} rows={1} />
          <Field label="Spatial Order Note" value={s.spatialOrderNote} onChange={(v) => update("spatialOrderNote", v)} rows={3} />
          <Field label="Critical Prop Lock" value={s.propLock} onChange={(v) => update("propLock", v)} rows={3} />
          {mode === "video" ? (
            <>
              <Field label="Action" value={s.action} onChange={(v) => update("action", v)} rows={3} />
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Dialogue</label>
                  <button onClick={() => setS((p) => ({ ...p, dialogues: [...p.dialogues, { id: Date.now().toString(), speaker: "", line: "", direction: "" }] }))} className="rounded-lg bg-fuchsia-500/20 px-2 py-1 text-xs text-fuchsia-300">+ Line</button>
                </div>
                <div className="mt-3 grid gap-2">
                  {s.dialogues.map((d) => (
                    <div key={d.id} className="grid grid-cols-[110px_1fr_1.2fr_auto] gap-2">
                      <input value={d.speaker} onChange={(e) => setS((p) => ({ ...p, dialogues: p.dialogues.map((x) => (x.id === d.id ? { ...x, speaker: e.target.value } : x)) }))} placeholder="Speaker" className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" />
                      <input value={d.line} onChange={(e) => setS((p) => ({ ...p, dialogues: p.dialogues.map((x) => (x.id === d.id ? { ...x, line: e.target.value } : x)) }))} placeholder="Line" className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" />
                      <input value={d.direction} onChange={(e) => setS((p) => ({ ...p, dialogues: p.dialogues.map((x) => (x.id === d.id ? { ...x, direction: e.target.value } : x)) }))} placeholder="direction" className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" />
                      <button onClick={() => setS((p) => ({ ...p, dialogues: p.dialogues.filter((x) => x.id !== d.id) }))} className="text-xs text-red-400">✕</button>
                    </div>
                  ))}
                </div>
              </div>
              <Field label="Performance" value={s.performance} onChange={(v) => update("performance", v)} rows={2} />
              <Field label="Continuity Lock" value={s.continuity} onChange={(v) => update("continuity", v)} rows={2} />
            </>
          ) : (
            <>
              <Field label="Performance / Pose" value={s.performance} onChange={(v) => update("performance", v)} rows={2} />
              <Field label="Action (Pose for image)" value={s.action} onChange={(v) => update("action", v)} rows={2} />
            </>
          )}
          <Field label="Negative Prompt" value={s.negativePrompt} onChange={(v) => update("negativePrompt", v)} rows={4} />
        </>
      )}

      <div className="rounded-2xl border border-fuchsia-500/40 bg-zinc-900/60 overflow-hidden shadow-xl shadow-black/30">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">{aiPrompt ? `✨ AI ${mode === "image" ? "Image" : "Video"} Prompt` : `🔧 Manual ${mode === "image" ? "Image" : "Video"} Prompt`}</h3>
          <div className="flex gap-2">
            {mode === "video" && <button onClick={() => { setS((p) => ({ ...p, seed: String(Math.floor(Math.random() * 99999)) })); if (mode === "video") setAiPromptVideo(null); else setAiPromptImage(null); }} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs">🎲 Random Seed</button>}
            <button onClick={copy} className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/20 px-3 py-1.5 text-xs text-fuchsia-200">{copied ? "✓ Copied" : "Copy"}</button>
            <button onClick={download} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs">Download</button>
          </div>
        </div>
        <textarea readOnly value={displayPrompt} rows={22} className="w-full resize-none bg-transparent p-4 font-mono text-xs leading-relaxed outline-none" />
        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2 text-[11px] text-zinc-600">
          <span>{wordCount} words · {displayPrompt.length} chars · {aiPrompt ? "AI" : "manual"} · {mode}</span>
          {aiPrompt && <button onClick={() => { navigator.clipboard.writeText(displayPrompt); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="text-fuchsia-400 hover:underline">Copy {mode} prompt</button>}
        </div>
      </div>
    </div>
  );
}

function StyleMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  const addCustom = () => {
    const c = custom.trim();
    if (!c) return;
    if (!value.includes(c)) onChange([...value, c]);
    setCustom("");
  };
  const presetsInView = STYLE_PRESETS;
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Style & Visuals <span className="normal-case text-zinc-600">(multi-choice)</span></label>
        <span className="text-[11px] text-zinc-500">{value.length} selected</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {value.length === 0 ? <span className="text-xs text-zinc-600">No style selected — pick from dropdown</span> : value.map((v) => {
          const preset = STYLE_PRESETS.find((p) => p.value === v);
          const label = preset ? preset.label : v.slice(0, 40) + (v.length > 40 ? "…" : "");
          return (
            <span key={v} className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/15 px-2.5 py-1 text-xs text-fuchsia-200">
              {label}
              <button onClick={() => onChange(value.filter((x) => x !== v))} className="ml-1 text-fuchsia-300 hover:text-white">✕</button>
            </span>
          );
        })}
      </div>
      {value.length > 0 && (
        <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Selection style prompts ({value.length})</p>
          <ul className="mt-2 grid gap-1.5">
            {value.map((v) => {
              const p = STYLE_PRESETS.find((x) => x.value === v);
              return (
                <li key={v} className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2">
                  <p className="text-[11px] font-medium text-fuchsia-300">{p ? p.label : "Custom"}</p>
                  <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-zinc-400">{v}</p>
                </li>
              );
            })}
          </ul>
          {value.length > 1 && <div className="mt-2 rounded-lg bg-zinc-900 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-zinc-300">[Style & Visuals] {value.join(", ")}</div>}
        </div>
      )}
      <div className="relative mt-3">
        <button onClick={() => setOpen((o) => !o)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-left text-sm text-zinc-300 hover:border-fuchsia-500/50">
          {open ? "▴ Close style list" : "▾ Choose styles — Pixar default (+ add more)"}
        </button>
        {open && (
          <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            {presetsInView.map((p) => {
              const checked = value.includes(p.value);
              return (
                <label key={p.id} className={`flex cursor-pointer items-start gap-2 px-3 py-2.5 text-xs hover:bg-zinc-800 ${checked ? "bg-fuchsia-500/10" : ""}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(p.value)} className="mt-0.5 accent-fuchsia-500" />
                  <span><span className="font-medium text-zinc-200">{p.label}</span><span className="ml-1 text-zinc-500">— {p.value.slice(0, 80)}…</span></span>
                </label>
              );
            })}
            <div className="border-t border-zinc-800 p-2">
              <div className="flex gap-2">
                <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }} placeholder="Custom style — type and press Enter" className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs outline-none focus:border-fuchsia-500" />
                <button onClick={addCustom} className="rounded-lg bg-fuchsia-500/20 px-3 py-1.5 text-xs font-medium text-fuchsia-300">+ Add</button>
              </div>
              <div className="mt-1 flex gap-2">
                <button onClick={() => onChange([PIXAR_DEFAULT])} className="text-[11px] text-zinc-500 hover:text-zinc-300">Reset to Pixar only</button>
                <button onClick={() => onChange([])} className="text-[11px] text-zinc-500 hover:text-zinc-300">Clear all</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, rows = 3, placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-fuchsia-500" />
    </div>
  );
}
function L({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
    </label>
  );
}
