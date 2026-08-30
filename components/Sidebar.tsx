"use client";
import { useRef } from "react";
import type { Account } from "@/lib/auth";
import { SCAN_ORDER, SCANS, type ScanId } from "@/lib/scan";
export type ToolId = "forge" | "cinematic" | "storyboard" | "stage" | "stagevideo" | "filmset" | ScanId;
export const MENU: { id: ToolId; icon: string; label: string; blurb: string }[] = [
  { id: "storyboard", icon: "📚", label: "Storyboard", blurb: "Story → scenes → image → video" },
  { id: "cinematic", icon: "🎞️", label: "Cinematic Lab", blurb: "Locked-identity video prompts" },
  { id: "stage", icon: "🎬", label: "Scene Stage", blurb: "Per-project storyboard rows" },
  { id: "stagevideo", icon: "📽️", label: "Scene Video Stage", blurb: "Transition footage between scene stages" },
  { id: "filmset", icon: "🎥", label: "Filming Set 3D", blurb: "Dress a 3D set with props + virtual camera" },
  ...SCAN_ORDER.map((scanId) => ({
    id: scanId as ToolId,
    icon: SCANS[scanId].icon,
    label: SCANS[scanId].title,
    blurb: SCANS[scanId].tagline,
  })),
];
export default function Sidebar({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
  active,
  onSelect,
  account,
  enabledCount,
  onManageKeys,
  onSignOut,
}: {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  active: ToolId;
  onSelect: (id: ToolId) => void;
  account: Account;
  enabledCount: number;
  onManageKeys: () => void;
  onSignOut: () => void;
}) {
  const dragRef = useRef<{ startX: number; dragging: boolean }>({ startX: 0, dragging: false });
  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, dragging: true };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current.dragging = false;
    if (dx < -40 && !collapsed) onToggleCollapse();
    else if (dx > 40 && collapsed) onToggleCollapse();
  };
  const widthClass = collapsed ? "w-16" : "w-64";
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-300 ease-in-out ${widthClass} ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-hidden={!open}
        onTouchStart={(e) => (dragRef.current.startX = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - dragRef.current.startX;
          if (dx < -50 && !collapsed) onToggleCollapse();
          else if (dx > 50 && collapsed) onToggleCollapse();
        }}
      >
        <div className={`flex items-center gap-3 border-b border-zinc-800 py-4 ${collapsed ? "justify-center px-2" : "px-4"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-sky-500 text-lg font-bold text-white">⚡</div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">Prompt Forge</p>
              <p className="truncate text-[10px] text-zinc-600">production toolkit</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={onToggleCollapse} title="Minimize" className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200">
              ‹
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={onToggleCollapse} title="Expand" className="mx-auto mt-2 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200">
            ›
          </button>
        )}
        <nav className={`flex-1 overflow-y-auto py-3 ${collapsed ? "px-1.5" : "px-3"}`}>
          {!collapsed && <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Tools</p>}
          <ul className="space-y-1">
            {MENU.map((item) => {
              const isActive = active === item.id;
              return (
                <li key={item.id} className="group relative">
                  <button
                    onClick={() => {
                      onSelect(item.id);
                      if (window.innerWidth < 1024) onClose();
                    }}
                    title={collapsed ? `${item.label} — ${item.blurb}` : undefined}
                    className={`flex w-full items-center rounded-xl text-left transition-colors ${collapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5"} ${isActive ? "bg-gradient-to-r from-fuchsia-500/20 to-sky-500/10 text-white ring-1 ring-fuchsia-500/40" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"}`}
                  >
                    <span className={collapsed ? "text-xl" : "text-base"}>{item.icon}</span>
                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </button>
                  {!collapsed && <span className="mt-0.5 block truncate pl-8 text-[10px] text-zinc-600">{item.blurb}</span>}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 shadow-xl group-hover:block">
                      {item.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={`border-t border-zinc-800 py-3 ${collapsed ? "px-1.5" : "px-3"}`}>
          {!collapsed && <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Account</p>}
          {!collapsed && <p className="truncate px-3 text-xs text-zinc-400">{account.email}</p>}
          {collapsed ? (
            <div className="flex flex-col gap-1.5">
              <button onClick={onManageKeys} title={`Keys ${enabledCount}/${account.keys.length}`} className="rounded-lg border border-zinc-700 py-2 text-xs text-zinc-300 hover:border-fuchsia-500/60">
                🔑
              </button>
              <button onClick={onSignOut} title="Sign out" className="rounded-lg border border-zinc-700 py-2 text-xs text-zinc-400 hover:border-red-500/50">
                ⎋
              </button>
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={onManageKeys} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition-colors hover:border-fuchsia-500/60 hover:text-fuchsia-300">
                Keys {enabledCount}/{account.keys.length}
              </button>
              <button onClick={onSignOut} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-300">
                Sign out
              </button>
            </div>
          )}
        </div>
        <div onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} className="absolute bottom-0 right-0 top-0 w-1.5 cursor-ew-resize touch-none hover:bg-fuchsia-500/20" title="Drag to collapse/expand" />
      </aside>
    </>
  );
}
