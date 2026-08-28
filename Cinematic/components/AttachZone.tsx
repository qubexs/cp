"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import type { Attachment } from "@/lib/types";
import { MAX_FILE_SIZE_BYTES } from "@/lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_ICON: Record<Attachment["kind"], string> = {
  image: "🖼",
  video: "🎞",
  audio: "🎵",
  text: "📄",
  other: "📦",
};

const ACCEPT =
  "image/*,video/mp4,video/webm,video/quicktime,video/mpeg,video/mov,audio/*,.txt,.md,.srt,.vtt,.json,.csv,.xml,.log,text/*";

export default function AttachZone({
  attachments,
  onAddFiles,
  onRemove,
  onClear,
}: {
  attachments: Attachment[];
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const list = Array.from(files);
      const oversized = list.some((f) => f.size > MAX_FILE_SIZE_BYTES);
      if (oversized) {
        onAddFiles([]);
        alert(
          "One or more files exceed the 40 MB limit (base64 payloads grow even larger). Please use a smaller reference file."
        );
        return;
      }
      onAddFiles(list);
    },
    [onAddFiles]
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Attach reference files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-fuchsia-400 bg-fuchsia-500/10"
            : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-500 hover:bg-zinc-900"
        }`}
      >
        <div className="text-3xl">📎</div>
        <p className="text-sm font-medium text-zinc-200">
          Drop reference files here, or{" "}
          <span className="text-fuchsia-400 underline underline-offset-2">browse</span>
        </p>
        <p className="text-xs text-zinc-500">
          Images · Videos (mp4/webm/mov) · Scripts &amp; text (txt/md/srt/json) · Audio. Up to 40 MB each.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {attachments.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              {attachments.length} reference{attachments.length > 1 ? "s" : ""}
            </p>
            <button
              onClick={onClear}
              className="text-xs text-zinc-500 transition-colors hover:text-red-400"
            >
              Clear all
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="group flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-2.5"
              >
                {a.kind === "image" && a.dataUrl ? (
                  <Image
                    src={a.dataUrl}
                    alt={a.name}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 flex-shrink-0 rounded-md border border-zinc-700 object-cover"
                  />
                ) : a.kind === "video" && a.dataUrl ? (
                  <video
                    src={a.dataUrl}
                    muted
                    className="h-12 w-12 flex-shrink-0 rounded-md border border-zinc-700 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-xl">
                    {KIND_ICON[a.kind]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-zinc-200" title={a.name}>
                    {a.name}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {a.kind} · {formatBytes(a.size)}
                    {a.size > 20 * 1024 * 1024 ? " · large ⚠" : ""}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(a.id)}
                  aria-label={`Remove ${a.name}`}
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}