"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AttachZone from "@/components/AttachZone";
import ResultPanel from "@/components/ResultPanel";
import {
  advanceRotation,
  maskKey,
  nextRotationOrderFromAccount,
  updateKeyStatus,
  type Account,
} from "@/lib/auth";
import { analyzeAndBuildPrompt, OpenRouterError, readAttachment } from "@/lib/openrouter";
import {
  BORDER_COLORS,
  BG_COLORS,
  MODELS,
  OUTPUT_LABELS,
  type Attachment,
  type ChatResult,
  type ModelChoice,
  type OutputTarget,
} from "@/lib/types";

const HISTORY_STORAGE = "promptforge_history";

type Tab = { id: OutputTarget; label: string; glyph: string };

const TABS: Tab[] = [
  { id: "text", label: "AI Text", glyph: "✍️" },
  { id: "image", label: "AI Image", glyph: "🖼️" },
  { id: "video", label: "AI Video", glyph: "🎬" },
];

const TARGET_TIPS: Record<OutputTarget, string> = {
  text: "Builds a structured prompt for ChatGPT / Claude / Gemini.",
  image: "Builds a dense image prompt (Gemini Nano Banana/Meta.ai) with negatives.",
  video: "Builds a shot-by-shot video prompt (Google Omni Flash/ Veo / Kling/ Ltx /Wan) with scale-lock & continuity rules.",
};

const FEATURE_BADGES: Record<OutputTarget, string[]> = {
  text: ["ROLE", "CONTEXT", "TASK", "FORMAT", "CONSTRAINTS"],
  image: ["Positive", "Negative", "Style", "Locked details"],
  video: ["Master", "Shot-by-shot", "Motion", "Continuity"],
};

type Incoming = { sceneText: string; cinematicState?: unknown; imagePrompt?: string; videoPrompt?: string; sourceSceneId: string };
export default function PromptForge({
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
  const [target, setTarget] = useState<OutputTarget>("image");
  const [model, setModel] = useState<ModelChoice>("google/gemini-2.5-flash");
  const [sceneDirection, setSceneDirection] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatResult | null>(null);
  const [history, setHistory] = useState<ChatResult[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(HISTORY_STORAGE) ?? "[]");
    } catch {
      return [];
    }
  });
  const [pendingCount, setPendingCount] = useState(0);
  const resultSectionRef = useRef<HTMLDivElement>(null);

  const modelNeedsVideo = useMemo(() => {
    const m = MODELS.find((x) => x.id === model);
    return m ? m.video : true;
  }, [model]);

  const hasVideo = useMemo(
    () => attachments.some((a) => a.kind === "video"),
    [attachments]
  );

  const enabledKeys = useMemo(
    () => account.keys.filter((k) => k.enabled),
    [account]
  );
  const nextKey = useMemo(() => nextRotationOrderFromAccount(account)[0], [account]);

  useEffect(() => {
    if (!incoming) return;
    setSceneDirection(incoming.sceneText || incoming.imagePrompt || incoming.videoPrompt || "");
    onConsumed?.();
  }, [incoming, onConsumed]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE, JSON.stringify(history.slice(0, 12)));
    } catch {
      /* ignore */
    }
  }, [history]);

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setPendingCount((c) => c + files.length);
    const out: Attachment[] = [];
    for (const f of files) {
      try {
        out.push(await readAttachment(f));
      } catch {
        alert(`Could not read ${f.name}.`);
      }
      setPendingCount((c) => c - 1);
    }
    setAttachments((prev) => [...prev, ...out]);
  }, []);

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const clearAttachments = () => setAttachments([]);

  const generate = useCallback(
    async (overTarget?: OutputTarget) => {
      const t = overTarget ?? target;
      const order = nextRotationOrderFromAccount(account);
      if (order.length === 0) {
        setError("No enabled API keys. Add one in the Key Manager.");
        openKeys();
        return;
      }

      setError(null);
      setLoading(true);
      try {
        const r = await analyzeAndBuildPrompt({
          keys: order.map((k) => ({ id: k.id, key: k.key, label: k.label, provider: k.provider })),
          model,
          target: t,
          attachments,
          sceneDirection,
        });
        r.attempts?.forEach((a) => {
          if (a.keyId) updateKeyStatus(account.email, a.keyId, { ok: a.ok, errorMessage: a.errorMessage });
        });
        advanceRotation(account.email);
        setResult(r);
        setHistory((prev) => [r, ...prev].slice(0, 12));
        refreshAccount();
        setTimeout(
          () => resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
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
        setLoading(false);
      }
    },
    [account, model, target, attachments, sceneDirection, refreshAccount, openKeys]
  );

  const canGenerate = enabledKeys.length > 0 && !loading && (!hasVideo || modelNeedsVideo);
  const usedKeyLabel = result?.usedKeyId
    ? account.keys.find((k) => k.id === result.usedKeyId)?.label
    : result?.usedKey ?? undefined;

  return (
    <div className="grid gap-6 w-full max-w-none">
      <div className={`rounded-2xl border ${BORDER_COLORS[target]} bg-zinc-900/60 p-5 shadow-xl shadow-black/30`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                {enabledKeys.length > 0 ? "Keys ready" : "No keys enabled"}
                {enabledKeys.length > 0 && nextKey ? (
                  <span className="ml-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia-300">
                    next: {nextKey.label} ({maskKey(nextKey.key)})
                  </span>
                ) : null}
              </p>
              <p className="text-[11px] text-zinc-500">
                {enabledKeys.length} of {account.keys.length} enabled · rotating automatically with failover
                {result?.usedKey ? ` · last used: ${usedKeyLabel ?? result.usedKey}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={openKeys}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition-colors hover:border-fuchsia-500/60 hover:text-fuchsia-300"
          >
            Manage keys
          </button>
        </div>
      </div>

      <div className={`rounded-2xl border ${BORDER_COLORS[target]} bg-zinc-900/60 p-5 shadow-xl shadow-black/30`}>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Output target
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTarget(t.id);
                setError(null);
              }}
              className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm font-medium transition-all ${
                target === t.id
                  ? `${BORDER_COLORS[t.id]} ${BG_COLORS[t.id]} text-white`
                  : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              <span className="text-xl">{t.glyph}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-400">{TARGET_TIPS[target]}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FEATURE_BADGES[target].map((b) => (
            <span
              key={b}
              className={`rounded-full border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-[10px] font-medium ${BG_COLORS[target]} border-zinc-700`}
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl border ${BORDER_COLORS[target]} bg-zinc-900/60 p-5 shadow-xl shadow-black/30`}>
        <label htmlFor="scene" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Scene direction <span className="normal-case font-normal text-zinc-600">(optional — what do you want to create?)</span>
        </label>
        <textarea
          id="scene"
          value={sceneDirection}
          onChange={(e) => setSceneDirection(e.target.value)}
          rows={3}
          placeholder={
            target === "video"
              ? "e.g. The knight walks to the village gate in rain. Camera slowly orbits. Same clothing as reference. Roughly 10 seconds."
              : target === "image"
                ? "e.g. Same character now standing in the rain outside the village gate, dramatic key lighting, film grain."
                : "e.g. Write an opening scene based on my script: the knight arrives at the gate after the rain."
          }
          className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
        />
      </div>

      <div className={`rounded-2xl border ${BORDER_COLORS[target]} bg-zinc-900/60 p-5 shadow-xl shadow-black/30`}>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Reference files <span className="normal-case font-normal text-zinc-600">— analyzed by the model before the prompt is built</span>
        </label>
        <AttachZone
          attachments={attachments}
          onAddFiles={addFiles}
          onRemove={removeAttachment}
          onClear={clearAttachments}
        />
        {pendingCount > 0 && (
          <p className="mt-2 text-xs text-zinc-500">Reading {pendingCount} file(s)…</p>
        )}
      </div>

      <div className={`rounded-2xl border ${BORDER_COLORS[target]} bg-zinc-900/60 p-5 shadow-xl shadow-black/30`}>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Analysis model
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ModelChoice)}
          disabled={loading}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-fuchsia-500 disabled:opacity-50"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {hasVideo && !modelNeedsVideo && (
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            ⚠ This model doesn&apos;t accept video. Pick a video-capable model (Gemini / Qwen) to analyze video references.
          </p>
        )}

        <button
          onClick={() => generate()}
          disabled={!canGenerate}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Analyzing references &amp; forging your prompt…
            </span>
          ) : enabledKeys.length === 0 ? (
            "No keys — open Key Manager to add one"
          ) : (
            `⚡ Forge ${OUTPUT_LABELS[target].toLowerCase()} prompt`
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="font-semibold">Error: </span>
          {error}
        </div>
      )}

      <div ref={resultSectionRef} id="result">
        {result ? (
          <ResultPanel
            result={result}
            usedKeyLabel={usedKeyLabel}
            canRegenerate={!loading}
            onRegenerate={() => generate()}
            onApplyToText={(content) => {
              setTarget("text");
              setSceneDirection(
                (prev) =>
                  `${prev.trim() ? prev.trim() + "\n\n" : ""}Reference prompt to adapt:\n${content}`
              );
              setTimeout(
                () =>
                  document
                    .getElementById("scene")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                80
              );
            }}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
            <p className="text-sm text-zinc-500">
              Your ready-to-paste prompt will appear here.
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Attach references → add a scene direction → forge.
            </p>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Recent prompts
          </h3>
          <div className="grid gap-2">
            {history.slice(0, 5).map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  navigator.clipboard?.writeText(h.content).catch(() => {});
                  alert("Copied to clipboard.");
                }}
                className="truncate rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                title="Click to copy"
              >
                {h.content.slice(0, 120)}
                {h.content.length > 120 ? "…" : ""}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}