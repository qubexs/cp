"use client";

import { useRef, useState } from "react";
import ProjectBar from "@/components/tools/ProjectBar";
import ReportPanel from "@/components/ReportPanel";
import {
  advanceRotation,
  nextRotationOrder,
  updateKeyStatus,
  type Account,
} from "@/lib/auth";
import {
  chatWithKeys,
  OpenRouterError,
  readAttachment,
  type ContentPart,
} from "@/lib/openrouter";
import { PRODUCTION_GUARD } from "@/lib/scan";
import {
  newSceneRow,
  sceneLabel,
  useProjects,
  type ProjectScene,
} from "@/lib/projects";
import {
  MODELS,
  type ChatResult,
  type ModelChoice,
} from "@/lib/types";

type Focus = "analyze" | "object" | "env";

const FOCUS_CONFIG: Record<
  Focus,
  { label: string; icon: string; title: string; system: string }
> = {
  analyze: {
    label: "Analyze",
    icon: "🔎",
    title: "Continuity Analysis",
    system: `You are a continuity supervisor sequencing a storyboard. Scene N must be a seamless continuation of the previous scene(s). Reference the attached images in order: CURRENT SCENE N first, then earlier scenes.

Produce a CONTINUITY VERDICT for Scene N vs the previous scene(s) with exactly these sections:
- [SCENE N SNAPSHOT]: what Scene N establishes (character, action, location, time, camera).
- [CONTINUITY CHECK]: for each area (character identity & proportions / character scale vs environment / wardrobe & props / background geometry & object placement / lighting direction / color grade) a verdict of LOCKED, DRIFTED, or UNCERTAIN versus the previous scene, with a one-line reason each.
- [ISSUES]: numbered list of every continuity break; each with severity (LOW/MEDIUM/HIGH) and the precise fix to re-lock to the previous scene.
- [SCALE & ENV LOCK]: confirm the strict character-scale and environment-lock rules hold across the cut.
- [VERDICT]: PASS / PASS WITH WARNINGS / FAIL on continuing from the previous scene.

Output ONLY the report.`,
  },
  object: {
    label: "Object",
    icon: "🧱",
    title: "Object Continuity",
    system: `You are an object/prop continuity specialist. Scene N must keep every prop and object consistent with the previous scene(s) — identity, count, placement, scale relative to the character and environment, state (lit/closed/torn/held), and motion.

Reference the attached images in order: CURRENT SCENE N first, then earlier scenes.

Produce an OBJECT CONTINUITY REPORT with exactly these sections:
- [OBJECT INVENTORY]: every object visible in Scene N, each with its placement and state.
- [OBJECT COMPARISON]: for each object, compare with the previous scene(s) — same / changed / missing / newly added, and whether its position, size, and orientation stayed locked.
- [SCALE LOCK]: each object's size relative to character & environment must match the reference; flag any object that scaled up/down, morphed, or shifted.
- [ISSUES]: numbered list, each with severity and the exact fix.
- [VERDICT]: PASS / PASS WITH WARNINGS / FAIL on object continuity.

Output ONLY the report.`,
  },
  env: {
    label: "Environment",
    icon: "🌄",
    title: "Environment Continuity",
    system: `You are an environment/background continuity specialist. Scene N must keep the world identical to the previous scene(s): background geometry, architecture, doors, windows, walls, furniture, floor, vehicles, foliage, distance layers, perspective, and global light state.

Reference the attached images in order: CURRENT SCENE N first, then earlier scenes. Every visible background element is locked geometry.

Produce an ENVIRONMENT CONTINUITY REPORT with exactly these sections:
- [ENV INVENTORY]: the environment elements established in the previous scene(s).
- [ENV COMPARISON]: for each element, same / changed / missing / newly added vs previous; flag any element that moved, resealed, morphed, rotated, or changed scale.
- [DEPTH & PERSPECTIVE]: confirm distance layers, vanishing perspective, and character-to-environment scale stayed locked; flag any scale drift.
- [LIGHTING]: flag any unmotivated direction/color shift of the environment's lighting.
- [ISSUES]: numbered list, each with severity and the exact fix.
- [VERDICT]: PASS / PASS WITH WARNINGS / FAIL on environment continuity.

Output ONLY the report.`,
  },
};

export default function SceneStage({
  account,
  refreshAccount,
  openKeys,
}: {
  account: Account;
  refreshAccount: () => void;
  openKeys: () => void;
}) {
  const {
    projects,
    activeProject,
    selectProject,
    createProject,
    renameProject,
    deleteProject,
    setScenes,
  } = useProjects(account.email);

  const [model, setModel] = useState<ModelChoice>("google/gemini-2.5-flash");
  const [running, setRunning] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, ChatResult>>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const reportRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scenes: ProjectScene[] = activeProject?.scenes ?? [];

  const updateScene = (id: string, patch: Partial<ProjectScene>) =>
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const removeScene = (id: string) =>
    setScenes((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));

  const moveScene = (id: string, dir: -1 | 1) =>
    setScenes((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const addScene = () => setScenes((prev) => [...prev, newSceneRow()]);

  const onPickFile = async (rowId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (f.size > 40 * 1024 * 1024) {
      alert("File exceeds 40 MB — use a smaller reference.");
      return;
    }
    const a = await readAttachment(f);
    if (a.kind === "image" || a.kind === "video") {
      updateScene(rowId, { imageUrl: a.dataUrl, imageName: a.name });
    } else {
      alert("Scene images should be an image or video file.");
    }
  };

  const runFocus = async (rowId: string, focus: Focus) => {
    if (!activeProject) return;
    const idx = scenes.findIndex((s) => s.id === rowId);
    if (idx < 0) return;
    const row = scenes[idx];

    setError(null);
    const hasVisual = Boolean(row.imageUrl);
    const promptText = row.prompt.trim();

    if (!hasVisual) {
      setError(`${sceneLabel(idx)} has no image — add the scene image for a visual continuity check.`);
      return;
    }

    const order = nextRotationOrder(account.email);
    if (order.length === 0) {
      setError("No enabled API keys. Add one in the Key Manager.");
      openKeys();
      return;
    }

    const key = `${rowId}|${focus}`;
    setRunning(key);

    const prevLabels =
      scenes
        .slice(0, idx)
        .map((_, i) => sceneLabel(i))
        .join(", ") || "this is the first/establishing scene — establish the locked baseline";

    const instructions = [
      `TASK: ${FOCUS_CONFIG[focus].title} for Scene ${idx + 1} in a sequence of ${scenes.length} scene(s), checked for continuity against the previous scene(s) (${prevLabels}).`,
      `CURRENT SCENE PROMPT (Scene ${idx + 1}):`,
      promptText ? `"${promptText}"` : "(no prompt text provided — rely on the current image and the previous scenes)",
      "",
      "IMAGE ORDER — the first image below belongs to the CURRENT scene; the following images are the previous scenes (closest previous first). Use them as the continuity references.",
      "",
      'OUTPUT REQUIREMENT: Reply with ONLY the report described in the system message. No surrounding text, no labels like "report:", no explanation.',
    ];

    const content: ContentPart[] = [{ type: "text", text: instructions.join("\n") }];
    if (row.imageUrl) content.push({ type: "image_url", image_url: { url: row.imageUrl } });
    const prevScenes = scenes.slice(0, idx).slice(-3);
    for (const prev of [...prevScenes].reverse()) {
      if (prev.imageUrl) content.push({ type: "image_url", image_url: { url: prev.imageUrl } });
    }

    try {
      const r = await chatWithKeys({
        keys: order.map((k) => ({ id: k.id, key: k.key, label: k.label, provider: k.provider })),
        model,
        body: {
          messages: [
            { role: "system", content: PRODUCTION_GUARD + "\n\n" + FOCUS_CONFIG[focus].system },
            { role: "user", content },
          ],
          temperature: 0.2,
          max_tokens: 4096,
        },
      });
      r.attempts?.forEach((a) => {
        if (a.keyId) updateKeyStatus(account.email, a.keyId, { ok: a.ok, errorMessage: a.errorMessage });
      });
      advanceRotation(account.email);
      refreshAccount();
      setReports((prev) => ({ ...prev, [key]: r }));
      setTimeout(
        () => reportRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" }),
        60
      );
    } catch (e) {
      if (e instanceof OpenRouterError) {
        e.attempts?.forEach((a) => {
          if (a.keyId) updateKeyStatus(account.email, a.keyId, { ok: false, errorMessage: a.errorMessage });
        });
        refreshAccount();
      }
      setError(e instanceof Error ? e.message : "Something went wrong while contacting OpenRouter.");
    } finally {
      setRunning(null);
    }
  };

  const enabledCount = account.keys.filter((k) => k.enabled).length;

  return (
    <div className="grid gap-6">
      <ProjectBar
        projects={projects}
        active={activeProject}
        onSelect={selectProject}
        onCreate={createProject}
        onRename={renameProject}
        onDelete={deleteProject}
        subtitle={(p) => `${p.scenes.length} scenes · ${p.videos.length} video stages`}
      />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl shadow-black/30">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-sky-500/10 text-xl ring-1 ring-fuchsia-500/40">
            🎬
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">Scene Stage</h2>
            <p className="text-xs text-zinc-400">
              Storyboard rows: scene image + editable prompt, checked for continuity to the previous scene.
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              {enabledCount} key(s) enabled with rotation + failover. Each video stage row below mirrors
              into the Scene Video Stage tool.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Analysis model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ModelChoice)}
            disabled={running !== null}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-fuchsia-500 disabled:opacity-50 sm:w-72"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {scenes.map((row, i) => (
          <div
            key={row.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-xl shadow-black/30"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-gradient-to-r from-fuchsia-500/20 to-sky-500/10 px-2.5 py-1 text-xs font-bold text-fuchsia-200 ring-1 ring-fuchsia-500/40">
                  {sceneLabel(i)}
                </span>
                <span className="text-[11px] text-zinc-600">
                  {i === 0 ? "establishing scene (baseline)" : `continuity checked against ${sceneLabel(i - 1)}`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveScene(row.id, -1)}
                  disabled={i === 0}
                  title="Move up"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveScene(row.id, 1)}
                  disabled={i === scenes.length - 1}
                  title="Move down"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeScene(row.id)}
                  disabled={scenes.length <= 1}
                  title="Delete scene"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[12rem_1fr]">
              <div>
                <input
                  ref={(el) => {
                    fileInputs.current[row.id] = el;
                  }}
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/mpeg"
                  className="hidden"
                  onChange={(e) => {
                    onPickFile(row.id, e.target.files);
                    e.target.value = "";
                  }}
                />
                {row.imageUrl ? (
                  <div className="relative">
                    <button
                      onClick={() => fileInputs.current[row.id]?.click()}
                      title="Replace image"
                      className="group block w-full overflow-hidden rounded-xl border border-zinc-700"
                    >
                      {row.imageUrl.startsWith("data:video") ? (
                        <video src={row.imageUrl} muted className="aspect-video w-full bg-black object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.imageUrl}
                          alt={row.imageName ?? sceneLabel(i)}
                          className="aspect-video w-full bg-black object-cover transition-transform group-hover:scale-105"
                        />
                      )}
                    </button>
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        onClick={() => fileInputs.current[row.id]?.click()}
                        className="flex-1 rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => updateScene(row.id, { imageUrl: undefined, imageName: undefined })}
                        className="flex-1 rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="mt-1 truncate text-[10px] text-zinc-600">{row.imageName}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputs.current[row.id]?.click()}
                    className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-700 text-zinc-500 transition-colors hover:border-fuchsia-500/60 hover:text-fuchsia-300"
                  >
                    <span className="text-xl">🖼</span>
                    <span className="px-2 text-center text-[11px]">Upload scene image / video</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col">
                <textarea
                  value={row.prompt}
                  onChange={(e) => updateScene(row.id, { prompt: e.target.value })}
                  rows={4}
                  placeholder={`Scene prompt for ${sceneLabel(i)}… e.g. The knight steps out of the rain and pushes the village gate open, same armor as the previous scene.`}
                  className="w-full flex-1 resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(Object.keys(FOCUS_CONFIG) as Focus[]).map((f) => {
                    const cfg = FOCUS_CONFIG[f];
                    const busy = running === `${row.id}|${f}`;
                    const hasReport = Boolean(reports[`${row.id}|${f}`]);
                    return (
                      <button
                        key={f}
                        onClick={() => runFocus(row.id, f)}
                        disabled={running !== null}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          hasReport
                            ? "border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-200"
                            : "border-zinc-700 text-zinc-300 hover:border-fuchsia-500/60 hover:text-fuchsia-200"
                        }`}
                      >
                        {busy ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <span>{cfg.icon}</span>
                        )}
                        {cfg.label}
                        {hasReport && <span className="text-[10px] text-fuchsia-400">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {(["analyze", "object", "env"] as Focus[]).map((f) =>
              reports[`${row.id}|${f}`] ? (
                <div key={f} className="mt-4">
                  <ReportPanel
                    result={reports[`${row.id}|${f}`]}
                    title={`${sceneLabel(i)} · ${FOCUS_CONFIG[f].title}`}
                    loading={running === `${row.id}|${f}`}
                    onRegenerate={() => runFocus(row.id, f)}
                  />
                </div>
              ) : null
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addScene}
        className="rounded-2xl border-2 border-dashed border-zinc-700 py-4 text-sm text-zinc-400 transition-colors hover:border-fuchsia-500/60 hover:text-fuchsia-300"
      >
        + Add scene
      </button>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="font-semibold">Error: </span>
          {error}
        </div>
      )}
    </div>
  );
}