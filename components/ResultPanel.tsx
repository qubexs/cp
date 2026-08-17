"use client";

import { useState } from "react";
import type { ChatResult } from "@/lib/types";

export default function ResultPanel({
  result,
  usedKeyLabel,
  onRegenerate,
  onApplyToText,
  canRegenerate,
}: {
  result: ChatResult;
  usedKeyLabel?: string;
  onRegenerate: () => void;
  onApplyToText: (content: string) => void;
  canRegenerate: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const chars = result.content.length;
  const words = result.content.trim() ? result.content.trim().split(/\s+/).length : 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      alert("Could not access the clipboard. Select the text and copy manually.");
    }
  };

  const download = () => {
    const blob = new Blob([result.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ready-prompt.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Ready Prompt</h2>
          <p className="text-[11px] text-zinc-500">
            {words} words · {chars} characters · via {result.model}
            {usedKeyLabel ? ` · key: ${usedKeyLabel}` : ""}
            {result.usage
              ? ` · ${result.usage.prompt_tokens + result.usage.completion_tokens} tokens`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-700"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
          <button
            onClick={download}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-700"
          >
            Download .txt
          </button>
          <button
            onClick={onRegenerate}
            disabled={!canRegenerate}
            className="rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-medium text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↻ Regenerate
          </button>
        </div>
      </div>

      <textarea
        readOnly
        value={result.content}
        spellCheck={false}
        className="flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed text-zinc-200 outline-none focus:ring-0"
        placeholder="Your ready-to-paste prompt will appear here."
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 px-4 py-3">
        <button
          onClick={() => onApplyToText(result.content)}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
        >
          Use as AI text prompt
        </button>
        <p className="text-[11px] text-zinc-500">
          Tip: paste into your image/video generator&apos;s prompt box as-is.
        </p>
      </div>
    </div>
  );
}