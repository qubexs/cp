"use client";

import { useEffect, useRef, useState } from "react";
import ProjectBar from "@/components/tools/ProjectBar";
import ReportPanel from "@/components/ReportPanel";
import {
  advanceRotation,
  nextRotationOrderFromAccount,
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
  sceneLabel,
  useProjects,
  videoLabel,
  type ProjectScene,
  type ProjectVideo,
} from "@/lib/projects";
import {
  MODELS,
  type ChatResult,
  type ModelChoice,
} from "@/lib/types";

type Focus = "analyze" | "object" | "env";

const FOCUS_CONFIG: Record<Focus, { label: string; icon: string; title: string; system: string }> = {
  analyze: {
    label: "Analyze",
    icon: "🔎",
    title: "Transition Continuity Analysis",
    system: `You are a transition supervisor. A Scene Video Stage is the footage that connects two consecutive scenes: it must START with the visual state of the SOURCE scene and END on the visual state of the TARGET scene, with locked continuity throughout.

Image order: CURRENT scene video stage media first, then the TARGET scene image, then the SOURCE scene image.

Produce a TRANSITION VERDICT with exactly these sections:
- [TRANSITION MAP]: how the stage moves from source scene state to target scene state (action, camera, blocking, passage of time).
- [START CHECK]: verify the stage starts consistent with the SOURCE scene (character, wardrobe, props, environment, scale).
- [END CHECK]: verify the stage ends consistent with the TARGET scene.
- [MID CONTRAST]: flag any moment the character/scale/proportions/wardrobe/environment drift mid-footage, with approx % and severity (LOW/MEDIUM/HIGH).
- [SCALE & ENV LOCK]: confirm the strict character-scale and environment-lock rules hold in every frame of the transition.
- [VERDICT]: PASS / PASS WITH WARNINGS / FAIL + the fix for the strongest issue.

Output ONLY the report.`,
  },
  object: {
    label: "Object",
    icon: "🧱",
    title: "Object Continuity (Transition)",
    system: `You are an object/prop continuity specialist for a Scene Video Stage (the footage connecting two scenes). Every prop must carry over consistently from the SOURCE state to the TARGET state — same identity, count, placement, scale relative to character/environment, state changes only where the scene intends them.

Image order: CURRENT stage media first, then TARGET scene image, then SOURCE scene image.

Produce an OBJECT CONTINUITY REPORT with exactly these sections:
- [OBJECT INVENTORY]: every object or prop in the stage footage with placement and state.
- [SOURCE→TARGET MATCH]: for each object, does it match what the SOURCE scene establishes and what the TARGET scene needs? same / changed / missing / newly added / morphed.
- [SCALE LOCK]: flag any object whose size or position flickers, scales up/down, or shifts relative to character/environment.
- [ISSUES]: numbered list, each with severity and the exact fix.
- [VERDICT]: PASS / PASS WITH WARNINGS / FAIL on object continuity across the transition.

Output ONLY the report.`,
  },
  env: {
    label: "Environment",
    icon: "🌄",
    title: "Environment Continuity (Transition)",
    system: `You are an environment/background continuity specialist for a Scene Video Stage (the footage connecting two scenes). The world geometry must remain locked through the transition and must land exactly on the TARGET scene's environment.

Image order: CURRENT stage media first, then TARGET scene image, then SOURCE scene image. Every visible background element is locked geometry.

Produce an ENVIRONMENT CONTINUITY REPORT with exactly these sections:
- [ENV INVENTORY]: environment elements visible during the transition.
- [SOURCE→TARGET MATCH]: for each element, same / changed / missing / newly added vs the source and target scenes; flag any morphing, reshifting, rescaling, or rotating element.
- [DEPTH & PERSPECTIVE]: confirm distance layers and character-to-environment scale stayed locked; flag any drift.
- [LIGHTING]: flag unmotivated light direction/color shifts during the transition.
- [ISSUES]: numbered list, each with severity and the exact fix.
- [VERDICT]: PASS / PASS WITH WARNINGS / FAIL on environment continuity across the transition.

Output ONLY the report.`,
  },
};

type Pair = {
  key: string;
  index: number;
  src: ProjectScene;
  dst: ProjectScene;
};

function emptyVideo(key: string): ProjectVideo {
  return { key, prompt: "" };
}

type Incoming = { sceneText: string; cinematicState?: unknown; imagePrompt?: string; videoPrompt?: string; sourceSceneId: string };
export default function SceneVideoStage({
  account,
  refreshAccount,
  openKeys,
  incoming,
  onConsumed,
}: {
  account: Account;
  refreshAccount: () => void;
  openKeys: () => void;
  incoming?: Incoming;
  onConsumed?: () => void;
}) {
  const {
    projects,
    activeProject,
    selectProject,
    createProject,
    renameProject,
    deleteProject,
    setVideos,
  } = useProjects(account.email);

  const [model, setModel] = useState<ModelChoice>("google/gemini-2.5-flash");
  const [running, setRunning] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, ChatResult>>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const reportRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scenes: ProjectScene[] = activeProject?.scenes ?? [];
  const videos: ProjectVideo[] = activeProject?.videos ?? [];

  const pairs: Pair[] = scenes
    .slice(0, -1)
    .map((src, i) => ({ key: `${src.id}->${scenes[i + 1].id}`, index: i, src, dst: scenes[i + 1] }));

  const effective = (pair: Pair): ProjectVideo =>
    videos.find((v) => v.key === pair.key) ?? emptyVideo(pair.key);

  useEffect(() => {
    if (!incoming) return;
    const prompt = incoming.sceneText || incoming.videoPrompt || incoming.imagePrompt || "";
    if (prompt) {
      if (pairs.length > 0) {
        const lastPair = pairs[pairs.length - 1];
        setVideos((prev) => {
          const exists = prev.some((v) => v.key === lastPair.key);
          return exists ? prev.map((v) => (v.key === lastPair.key ? { ...v, prompt } : v)) : [...prev, { ...emptyVideo(lastPair.key), prompt }];
        });
      }
    }
    onConsumed?.();
  }, [incoming, onConsumed, pairs, setVideos]);

  const updatePair = (pair: Pair, patch: Partial<ProjectVideo>) =>
    setVideos((prev) => {
      const exists = prev.some((v) => v.key === pair.key);
      return exists
        ? prev.map((v) => (v.key === pair.key ? { ...v, ...patch } : v))
        : [...prev, { ...emptyVideo(pair.key), ...patch }];
    });

  const onPickFile = async (pair: Pair, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (f.size > 40 * 1024 * 1024) {
      alert("File exceeds 40 MB — use a smaller reference.");
      return;
    }
    const a = await readAttachment(f);
    if (a.kind === "image" || a.kind === "video") {
      updatePair(pair, { imageUrl: a.dataUrl, imageName: a.name });
    } else {
      alert("Scene video stage media should be an image or video file.");
    }
  };

  const runFocus = async (pair: Pair, focus: Focus) => {
    const row = effective(pair);
    setError(null);

    if (!row.imageUrl) {
      setError(`${videoLabel(pair.index)} has no media — upload the transition video or a keyframe.`);
      return;
    }

    const order = nextRotationOrderFromAccount(account);
    if (order.length === 0) {
      setError("No enabled API keys. Add one in the Key Manager.");
      openKeys();
      return;
    }

    const key = `${pair.key}|${focus}`;
    setRunning(key);

    const instructions = [
      `TASK: ${FOCUS_CONFIG[focus].title} for ${videoLabel(pair.index)} — the footage connecting ${sceneLabel(pair.index)} → ${sceneLabel(pair.index + 1)}.`,
      `SOURCE SCENE (${sceneLabel(pair.index)}) PROMPT:`,
      pair.src.prompt.trim() ? `"${pair.src.prompt.trim()}"` : "(no prompt text)",
      `TARGET SCENE (${sceneLabel(pair.index + 1)}) PROMPT:`,
      pair.dst.prompt.trim() ? `"${pair.dst.prompt.trim()}"` : "(no prompt text)",
      `THIS STAGE PROMPT:`,
      row.prompt.trim() ? `"${row.prompt.trim()}"` : "(no prompt text — infer the transition from media)",
      "",
      "IMAGE ORDER — first media = THIS scene video stage (current transition), then the TARGET scene image, then the SOURCE scene image. Use them as locked references.",
      "",
      'OUTPUT REQUIREMENT: Reply with ONLY the report described in the system message. No surrounding text, no labels like "report:", no explanation.',
    ];

    const content: ContentPart[] = [{ type: "text", text: instructions.join("\n") }];
    if (row.imageUrl) {
      if (row.imageUrl.startsWith("data:video")) {
        content.push({ type: "video_url", video_url: { url: row.imageUrl } });
      } else {
        content.push({ type: "image_url", image_url: { url: row.imageUrl } });
      }
    }
    for (const sc of [pair.dst, pair.src]) {
      if (sc.imageUrl) {
        if (sc.imageUrl.startsWith("data:video")) {
          content.push({ type: "video_url", video_url: { url: sc.imageUrl } });
        } else {
          content.push({ type: "image_url", image_url: { url: sc.imageUrl } });
        }
      }
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
    <div className="grid gap-6 w-full max-w-none">
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
            📽️
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">Scene Video Stage</h2>
            <p className="text-xs text-zinc-400">
              Transition footage between consecutive Scene Stages. Scene Video Stage N connects Scene N
              → Scene N+1.
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              One row for every scene-to-scene transition in the current project. {enabledCount} key(s)
              enabled with rotation + failover.
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

      {scenes.length < 2 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          Add at least two scenes in the Scene Stage tool to create video transitions.
        </div>
      ) : (
        <div className="space-y-4">
          {pairs.map((pair) => {
            const row = effective(pair);
            return (
              <div
                key={pair.key}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-xl shadow-black/30"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-gradient-to-r from-fuchsia-500/20 to-sky-500/10 px-2.5 py-1 text-xs font-bold text-fuchsia-200 ring-1 ring-fuchsia-500/40">
                      {videoLabel(pair.index)}
                    </span>
                    <span className="text-[11px] text-zinc-600">
                      footage from {sceneLabel(pair.index)} → {sceneLabel(pair.index + 1)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
                  <div>
                    <div className="grid grid-cols-[1fr_1.15fr_1fr] items-center gap-2">
                      <div className="overflow-hidden rounded-lg border border-zinc-800">
                        {pair.src.imageUrl ? (
                          pair.src.imageUrl.startsWith("data:video") ? (
                            <video src={pair.src.imageUrl} muted className="aspect-video w-full bg-black object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pair.src.imageUrl} alt={sceneLabel(pair.index)} className="aspect-video w-full bg-black object-cover" />
                          )
                        ) : (
                          <div className="flex aspect-video w-full items-center justify-center bg-zinc-950 text-[10px] text-zinc-600">
                            {sceneLabel(pair.index)}
                          </div>
                        )}
                      </div>

                      <div>
                        <input
                          ref={(el) => {
                            fileInputs.current[pair.key] = el;
                          }}
                          type="file"
                          accept="image/*,video/mp4,video/webm,video/quicktime,video/mpeg"
                          className="hidden"
                          onChange={(e) => {
                            onPickFile(pair, e.target.files);
                            e.target.value = "";
                          }}
                        />
                        {row.imageUrl ? (
                          <div className="relative">
                            <button
                              onClick={() => fileInputs.current[pair.key]?.click()}
                              title="Replace transition media"
                              className="block w-full overflow-hidden rounded-lg border-2 border-fuchsia-500/60"
                            >
                              {row.imageUrl.startsWith("data:video") ? (
                                <video src={row.imageUrl} muted className="aspect-video w-full bg-black object-cover" />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={row.imageUrl} alt={videoLabel(pair.index)} className="aspect-video w-full bg-black object-cover" />
                              )}
                            </button>
                            <div className="mt-1 flex gap-1.5">
                              <button
                                onClick={() => fileInputs.current[pair.key]?.click()}
                                className="flex-1 rounded-lg border border-zinc-700 px-1.5 py-1 text-[10px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
                              >
                                Replace
                              </button>
                              <button
                                onClick={() => updatePair(pair, { imageUrl: undefined, imageName: undefined })}
                                className="flex-1 rounded-lg border border-zinc-700 px-1.5 py-1 text-[10px] text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-400"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => fileInputs.current[pair.key]?.click()}
                            className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-fuchsia-500/50 text-fuchsia-400/80 transition-colors hover:border-fuchsia-500/80 hover:text-fuchsia-300"
                          >
                            <span className="text-xl">▶</span>
                            <span className="px-2 text-center text-[10px]">Upload transition video / keyframe</span>
                          </button>
                        )}
                        <p className="mt-1 truncate text-center text-[10px] text-zinc-600">{row.imageName}</p>
                      </div>

                      <div className="overflow-hidden rounded-lg border border-zinc-800">
                        {pair.dst.imageUrl ? (
                          pair.dst.imageUrl.startsWith("data:video") ? (
                            <video src={pair.dst.imageUrl} muted className="aspect-video w-full bg-black object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pair.dst.imageUrl} alt={sceneLabel(pair.index + 1)} className="aspect-video w-full bg-black object-cover" />
                          )
                        ) : (
                          <div className="flex aspect-video w-full items-center justify-center bg-zinc-950 text-[10px] text-zinc-600">
                            {sceneLabel(pair.index + 1)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px] text-zinc-600">
                      <span>{sceneLabel(pair.index)}</span>
                      <span className="text-fuchsia-500">stage</span>
                      <span>{sceneLabel(pair.index + 1)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <textarea
                      value={row.prompt}
                      onChange={(e) => updatePair(pair, { prompt: e.target.value })}
                      rows={4}
                      placeholder={`Transition prompt… e.g. Camera follows the knight through the gate as rain eases off; the hall behind him must be the same stone hall as the previous scene. Ends exactly on Scene ${pair.index + 2}'s framing.`}
                      className="w-full flex-1 resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(Object.keys(FOCUS_CONFIG) as Focus[]).map((f) => {
                        const cfg = FOCUS_CONFIG[f];
                        const busy = running === `${pair.key}|${f}`;
                        const hasReport = Boolean(reports[`${pair.key}|${f}`]);
                        return (
                          <button
                            key={f}
                            onClick={() => runFocus(pair, f)}
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
                  reports[`${pair.key}|${f}`] ? (
                    <div key={f} className="mt-4">
                      <ReportPanel
                        result={reports[`${pair.key}|${f}`]}
                        title={`${videoLabel(pair.index)} · ${FOCUS_CONFIG[f].title}`}
                        loading={running === `${pair.key}|${f}`}
                        onRegenerate={() => runFocus(pair, f)}
                      />
                    </div>
                  ) : null
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-600">
        Video stages are derived from your Scene Stage board — add/reorder/delete scenes there and this
        tool updates automatically. Switch scenes back and forth in the Scene Stage tool to preview.
      </p>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="font-semibold">Error: </span>
          {error}
        </div>
      )}
    </div>
  );
}