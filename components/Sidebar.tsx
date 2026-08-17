"use client";

import type { Account } from "@/lib/auth";
import { SCAN_ORDER, SCANS, type ScanId } from "@/lib/scan";

export type ToolId = "forge" | ScanId;

export const MENU: { id: ToolId; icon: string; label: string; blurb: string }[] = [
  { id: "forge", icon: "⚡", label: "Prompt Forge", blurb: "Reference → generation prompt" },
  ...SCAN_ORDER.map((scanId) => ({
    id: scanId as ToolId,
    icon: SCANS[scanId].icon,
    label: SCANS[scanId].title,
    blurb: SCANS[scanId].tagline,
  })),
];

export default function Sidebar({
  open,
  onClose,
  active,
  onSelect,
  account,
  enabledCount,
  onManageKeys,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  active: ToolId;
  onSelect: (id: ToolId) => void;
  account: Account;
  enabledCount: number;
  onManageKeys: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-800 bg-zinc-950 transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-sky-500 text-lg font-bold text-white">
            ⚡
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight">Prompt Forge</p>
            <p className="truncate text-[10px] text-zinc-600">production toolkit</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Tools
          </p>
          <ul className="space-y-1">
            {MENU.map((item) => {
              const isActive = active === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onSelect(item.id);
                      onClose();
                    }}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-gradient-to-r from-fuchsia-500/20 to-sky-500/10 text-white ring-1 ring-fuchsia-500/40"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-base">{item.icon}</span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </span>
                    <span className="mt-0.5 block truncate pl-8 text-[10px] text-zinc-600">
                      {item.blurb}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-zinc-800 px-3 py-3">
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Account
          </p>
          <p className="truncate px-3 text-xs text-zinc-400">{account.email}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={onManageKeys}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition-colors hover:border-fuchsia-500/60 hover:text-fuchsia-300"
            >
              Keys {enabledCount}/{account.keys.length}
            </button>
            <button
              onClick={onSignOut}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-300"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}