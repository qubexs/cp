"use client";

import { useState } from "react";
import {
  enabledKeysCount,
  maskKey,
  nextRotationOrder,
  type Account,
} from "@/lib/auth";
import { PROVIDERS } from "@/lib/providers";
import type { Provider } from "@/lib/types";

export default function KeyManager({
  account,
  onAdd,
  onRemove,
  onToggle,
  onClose,
}: {
  account: Account;
  onAdd: (key: string, label: string, provider: Provider) => string | null | Promise<string | null>;
  onRemove: (keyId: string) => void;
  onToggle: (keyId: string, enabled: boolean) => void;
  onClose: () => void;
}) {
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [provider, setProvider] = useState<Provider>("openrouter");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackOk, setFeedbackOk] = useState(false);

  const enabledCount = enabledKeysCount(account.email);
  const next = nextRotationOrder(account.email)[0];

  const providerConfig = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  const add = async () => {
    setFeedback(null);
    if (!newKey.trim()) {
      setFeedback(`Paste a ${providerConfig.short} API key first.`);
      setFeedbackOk(false);
      return;
    }
    const err = await onAdd(newKey.trim(), newLabel.trim(), provider);
    if (err) {
      setFeedback(err);
      setFeedbackOk(false);
      return;
    }
    setNewKey("");
    setNewLabel("");
    setFeedback(`Key added and enabled. It is now in the rotation pool.`);
    setFeedbackOk(true);
  };

  const time = (ts: number) =>
    new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">API keys</h2>
            <p className="text-[11px] text-zinc-500">
              {account.email} · {enabledCount} of {account.keys.length} enabled ·
              rotates automatically per request
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Add a key
            </label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as Provider);
                setNewKey("");
              }}
              className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-fuchsia-500"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (e.g. Work, Home, Backup)"
              spellCheck={false}
              className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
            />
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              placeholder={providerConfig.placeholder}
              spellCheck={false}
              autoComplete="off"
              className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
            />
            <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
              {providerConfig.hint}
            </p>
            {feedback && (
              <p
                className={`mb-2 text-xs ${feedbackOk ? "text-emerald-400" : "text-red-400"}`}
              >
                {feedback}
              </p>
            )}
            <button
              onClick={add}
              className="w-full rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/10 px-3 py-2 text-sm font-medium text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20"
            >
              + Add to rotation pool
            </button>
          </div>

          {account.keys.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">
              No keys yet. Add OpenRouter, Google, or Hugging Face keys above — add several to
              enable automatic rotation and fallback.
            </div>
          ) : (
            <ul className="space-y-2">
              {account.keys.map((k) => (
                <li
                  key={k.id}
                  className={`rounded-xl border p-3 ${
                    k.enabled && !k.lastError
                      ? "border-zinc-700 bg-zinc-900"
                      : k.enabled
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "border-zinc-800 bg-zinc-950 opacity-70"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => onToggle(k.id, !k.enabled)}
                      role="switch"
                      aria-checked={k.enabled}
                      aria-label={`Toggle ${k.label}`}
                      className={`mt-0.5 flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                        k.enabled ? "bg-emerald-500" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`ml-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          k.enabled ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-zinc-100">{k.label}</p>
                        {PROVIDERS.find((p) => p.id === k.provider) && (
                          <span className="flex-shrink-0 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                            {PROVIDERS.find((p) => p.id === k.provider)?.short}
                          </span>
                        )}
                        {k.id === next?.id && k.enabled && (
                          <span className="flex-shrink-0 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia-300">
                            next up
                          </span>
                        )}
                      </div>
                      <p className="truncate font-mono text-[11px] text-zinc-500">{maskKey(k.key)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
                        <span className={k.enabled ? "text-emerald-400" : ""}>
                          {k.enabled ? "enabled" : "disabled"}
                        </span>
                        <span>used {k.uses}×</span>
                        {k.lastUsedAt && <span>last {time(k.lastUsedAt)}</span>}
                        {k.lastError && (
                          <span className="truncate text-amber-400" title={k.lastError}>
                            ⚠ {k.lastError.slice(0, 60)}
                          </span>
                        )}
                        {!k.lastError && k.enabled && k.uses === 0 && (
                          <span className="text-zinc-600">status: untested</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(k.id)}
                      aria-label={`Delete ${k.label}`}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      🗑
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-zinc-800 px-5 py-3">
          <p className="text-[11px] leading-relaxed text-zinc-600">
            Rotation: keys are tried in order. If one fails, the next enabled key is tried
            automatically. The starting key advances after every successful request.
          </p>
        </div>
      </div>
    </div>
  );
}