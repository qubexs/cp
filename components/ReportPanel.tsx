"use client";

import { useState } from "react";
import type { ChatResult } from "@/lib/types";

export default function ReportPanel({
  result,
  title,
  loading,
  onRegenerate,
}: {
  result: ChatResult;
  title: string;
  loading: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);

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
    const safe = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const blob = new Blob([result.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safe || "report"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-[16rem] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <p className="text-[11px] text-zinc-500">
            via {result.model}
            {result.usedKey ? ` · key: ${result.usedKey}` : ""}
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
            disabled={loading}
            className="rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-medium text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↻ Re-run
          </button>
        </div>
      </div>

      <textarea
        readOnly
        value={result.content}
        spellCheck={false}
        className="flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed text-zinc-200 outline-none focus:ring-0"
        placeholder="The report will appear here."
      />
    </div>
  );
}