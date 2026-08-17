"use client";

import { useState } from "react";

export interface BarItem {
  id: string;
  name: string;
}

export default function ProjectBar<Item extends BarItem>({
  projects,
  active,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  subtitle,
}: {
  projects: Item[];
  active: Item | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: (id: string) => void;
  subtitle?: (item: Item) => string;
}) {
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    if (adding) onCreate(name.trim());
    else if (renaming) onRename(name.trim());
    setName("");
    setAdding(false);
    setRenaming(false);
  };

  const handleDelete = () => {
    if (!active) return;
    if (window.confirm(`Delete project "${active.name}"? This removes its scenes and video stages.`)) {
      onDelete(active.id);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl shadow-black/30">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Project
          </label>
          <select
            value={active?.id ?? ""}
            onChange={(e) => onSelect(e.target.value)}
            disabled={renaming || adding}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-fuchsia-500 disabled:opacity-50"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {subtitle ? ` · ${subtitle(p)}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {adding || renaming ? (
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setRenaming(false);
                    setName("");
                  }
                }}
                autoFocus
                placeholder={adding ? "New project name" : "Rename project"}
                className="w-44 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
              />
              <button
                onClick={submit}
                className="rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/10 px-3 py-2.5 text-xs font-medium text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setRenaming(false);
                  setName("");
                }}
                className="rounded-lg border border-zinc-700 px-3 py-2.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setAdding(true);
                  setRenaming(false);
                }}
                className="rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/10 px-3 py-2.5 text-xs font-medium text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20"
              >
                + New project
              </button>
              <button
                onClick={() => {
                  setRenaming(true);
                  setAdding(false);
                }}
                disabled={!active}
                className="rounded-lg border border-zinc-700 px-3 py-2.5 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Rename
              </button>
              <button
                onClick={handleDelete}
                disabled={!active}
                className="rounded-lg border border-zinc-700 px-3 py-2.5 text-xs text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}