"use client";

import { useCallback, useRef, useState } from "react";
import AttachZone from "@/components/AttachZone";
import ReportPanel from "@/components/ReportPanel";
import {
  advanceRotation,
  nextRotationOrder,
  updateKeyStatus,
  type Account,
} from "@/lib/auth";
import { OpenRouterError, readAttachment } from "@/lib/openrouter";
import { runScan, type ScanConfig } from "@/lib/scan";
import {
  MODELS,
  type Attachment,
  type ChatResult,
  type ModelChoice,
} from "@/lib/types";

export default function ScanTool({
  account,
  config,
  refreshAccount,
  openKeys,
}: {
  account: Account;
  config: ScanConfig;
  refreshAccount: () => void;
  openKeys: () => void;
}) {
  const [model, setModel] = useState<ModelChoice>("google/gemini-2.5-flash");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [userPrompt, setUserPrompt] = useState("");
  const [result, setResult] = useState<ChatResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

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

  const run = async () => {
    setError(null);
    if (attachments.length < config.minRefs) {
      setError(
        `${config.title} needs at least ${config.minRefs} reference file${config.minRefs > 1 ? "s" : ""}. ${config.advice}`
      );
      return;
    }

    const order = nextRotationOrder(account.email);
    if (order.length === 0) {
      setError("No enabled API keys. Add one in the Key Manager.");
      openKeys();
      return;
    }

    setLoading(true);
    try {
      const r = await runScan({
        keys: order.map((k) => ({ id: k.id, key: k.key, label: k.label })),
        model,
        config,
        attachments,
        userPrompt,
      });
      r.attempts?.forEach((a) => {
        if (a.keyId) updateKeyStatus(account.email, a.keyId, { ok: a.ok, errorMessage: a.errorMessage });
      });
      advanceRotation(account.email);
      refreshAccount();
      setResult(r);
      setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
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
  };

  const canRun = !loading && attachments.length >= config.minRefs;

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl shadow-black/30">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-sky-500/10 text-xl ring-1 ring-fuchsia-500/40">
            {config.icon}
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">{config.title}</h2>
            <p className="text-xs text-zinc-400">{config.tagline}</p>
            <p className="mt-1 text-[11px] text-zinc-600">{config.reminder}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl shadow-black/30">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          References <span className="normal-case font-normal text-zinc-600">({config.hint})</span>
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
        <p className="mt-2 text-[11px] text-zinc-600">{config.advice}</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl shadow-black/30">
        <label
          htmlFor={`${config.id}-notes`}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400"
        >
          Notes / script <span className="normal-case font-normal text-zinc-600">(optional)</span>
        </label>
        <textarea
          id={`${config.id}-notes`}
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          rows={2}
          placeholder={
            config.id === "sceneflow"
              ? "e.g. Scene 1: the knight reaches the gate. Then scene 2: interior hall, same character, night."
              : "e.g. Focus on hands and proportions. Check frame 2 vs frame 5."
          }
          className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
        />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl shadow-black/30">
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

        <button
          onClick={run}
          disabled={!canRun}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {config.title} in progress…
            </span>
          ) : attachments.length < config.minRefs ? (
            `Add ${config.minRefs - attachments.length} more reference${config.minRefs - attachments.length > 1 ? "s" : ""} to run`
          ) : (
            `▶ Run ${config.title}`
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="font-semibold">Error: </span>
          {error}
        </div>
      )}

      <div ref={resultRef}>
        {result ? (
          <ReportPanel
            result={result}
            title={config.title}
            loading={loading}
            onRegenerate={() => run()}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
            <p className="text-sm text-zinc-500">
              The {config.title.toLowerCase()} report will appear here.
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {config.advice} Then press Run.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}