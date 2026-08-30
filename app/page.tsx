"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import KeyManager from "@/components/KeyManager";
import Sidebar, { type ToolId } from "@/components/Sidebar";
import PromptForge from "@/components/tools/PromptForge";
import SceneStage from "@/components/tools/SceneStage";
import SceneVideoStage from "@/components/tools/SceneVideoStage";
import FilmingSet from "@/components/tools/FilmingSet";
import CinematicBuilder from "@/components/tools/CinematicBuilder";
import StoryboardBoard from "@/components/tools/StoryboardBoard";
import ScanTool from "@/components/tools/ScanTool";
import { apiFetchMe, enabledKeysCount, logout, migrateLocalToPostgres, type Account } from "@/lib/auth";
import { SCANS } from "@/lib/scan";
function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.10),transparent_55%)]" />
      <div className="relative flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-sky-500 text-2xl font-bold text-white">⚡</div>
        <p className="text-xs text-zinc-500">Prompt Forge loading…</p>
      </div>
    </div>
  );
}
export default function Home() {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return JSON.parse(localStorage.getItem("promptforge_sidebar_collapsed") ?? "false"); } catch { return false; }
  });
  const [keysModalOpen, setKeysModalOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>("storyboard");
  const [pendingTransfer, setPendingTransfer] = useState<null | import("@/components/tools/StoryboardBoard").PendingTransfer & { target: ToolId }>(null);
  const load = useCallback(async () => {
    const me = await apiFetchMe();
    if (me) {
      if (me.keys.length === 0) {
        const imported = await migrateLocalToPostgres();
        if (imported > 0) {
          const me2 = await apiFetchMe();
          setAccount(me2);
          setReady(true);
          return;
        }
      }
      setAccount(me);
    } else {
      const localEmail = typeof window !== "undefined" ? localStorage.getItem("promptforge_session") : null;
      if (localEmail) {
        const { getAccount } = await import("@/lib/auth");
        const local = getAccount(localEmail);
        setAccount(local);
      } else setAccount(null);
    }
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  const refreshAccount = useCallback(async () => {
    const me = await apiFetchMe();
    if (me) setAccount(me);
    else {
      const { getAccount, getSessionEmail } = await import("@/lib/auth");
      const email = getSessionEmail();
      setAccount(email ? getAccount(email) : null);
    }
  }, []);
  const handleSignOut = async () => {
    await logout();
    setAccount(null);
    setSidebarOpen(false);
    setKeysModalOpen(false);
  };
  const toggleCollapse = useCallback(() => {
    setSidebarCollapsed((v) => {
      const n = !v;
      try { localStorage.setItem("promptforge_sidebar_collapsed", JSON.stringify(n)); } catch {}
      return n;
    });
  }, []);
  const enabledTotal = useMemo(() => (account ? account.keys.filter((k) => k.enabled).length : 0), [account]);
  if (!ready) return <Splash />;
  if (!account) return <AuthScreen onAuthed={(a) => setAccount(a)} />;
  const openKeys = () => setKeysModalOpen(true);
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.06),transparent_55%)]" />
      <Sidebar open={sidebarOpen} collapsed={sidebarCollapsed} onClose={() => setSidebarOpen(false)} onToggleCollapse={toggleCollapse} active={activeTool} onSelect={setActiveTool} account={account} enabledCount={enabledTotal} onManageKeys={openKeys} onSignOut={handleSignOut} />
      <header className={`sticky top-0 z-30 mx-auto flex w-full flex-wrap items-center justify-between gap-3 bg-zinc-950/80 px-4 pb-2 pt-6 backdrop-blur-md transition-[padding] duration-300 ${sidebarOpen ? (sidebarCollapsed ? "lg:pl-16" : "lg:pl-64") : ""} max-w-[1900px]`}>
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen((o) => !o)} aria-label={sidebarOpen ? "Close menu" : "Open menu"} aria-expanded={sidebarOpen} className="relative z-50 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-fuchsia-500/50 bg-zinc-800 text-white shadow-lg shadow-black/30 transition-colors hover:border-fuchsia-500 hover:bg-zinc-700">
            <span className="relative block h-3.5 w-5">
              <span className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-white transition-all duration-200 ${sidebarOpen ? "top-1.5 rotate-45" : ""}`} />
              <span className={`absolute left-0 top-1.5 h-0.5 w-5 rounded-full bg-white transition-all duration-200 ${sidebarOpen ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 top-3 h-0.5 w-5 rounded-full bg-white transition-all duration-200 ${sidebarOpen ? "top-1.5 -rotate-45" : ""}`} />
            </span>
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Prompt Forge</h1>
            <p className="text-[11px] text-zinc-500">Reference files → ready-to-paste generation prompts (text only)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{account.email}
          </span>
          <button onClick={openKeys} className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${enabledTotal === 0 ? "border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20" : "border-zinc-700 text-zinc-300 hover:border-fuchsia-500/60 hover:text-fuchsia-300"}`}>Keys {enabledTotal}/{account.keys.length}</button>
          <button onClick={handleSignOut} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-300">Sign out</button>
        </div>
      </header>
      <main className={`relative mx-auto w-full px-4 pb-16 pt-6 transition-[padding] duration-300 ${sidebarOpen ? (sidebarCollapsed ? "lg:pl-16" : "lg:pl-64") : ""} max-w-[1900px]`}>
        {activeTool === "forge" ? (<PromptForge account={account} refreshAccount={refreshAccount} openKeys={openKeys} incoming={pendingTransfer?.target === "forge" ? pendingTransfer : undefined} onConsumed={() => setPendingTransfer(null)} />) : activeTool === "cinematic" ? (<CinematicBuilder account={account} refreshAccount={refreshAccount} openKeys={openKeys} incoming={pendingTransfer?.target === "cinematic" ? pendingTransfer : undefined} onConsumed={() => setPendingTransfer(null)} />) : activeTool === "storyboard" ? (<StoryboardBoard account={account} refreshAccount={refreshAccount} openKeys={openKeys} onSend={(target, payload) => { setPendingTransfer({ ...payload, target }); setActiveTool(target); }} />) : activeTool === "stage" ? (<SceneStage account={account} refreshAccount={refreshAccount} openKeys={openKeys} incoming={pendingTransfer?.target === "stage" ? pendingTransfer : undefined} onConsumed={() => setPendingTransfer(null)} />) : activeTool === "stagevideo" ? (<SceneVideoStage account={account} refreshAccount={refreshAccount} openKeys={openKeys} incoming={pendingTransfer?.target === "stagevideo" ? pendingTransfer : undefined} onConsumed={() => setPendingTransfer(null)} />) : activeTool === "filmset" ? (<FilmingSet account={account} refreshAccount={refreshAccount} openKeys={openKeys} incoming={pendingTransfer?.target === "filmset" ? pendingTransfer : undefined} onConsumed={() => setPendingTransfer(null)} />) : (<ScanTool account={account} config={SCANS[activeTool as import("@/lib/scan").ScanId]} refreshAccount={refreshAccount} openKeys={openKeys} incoming={pendingTransfer && ["analyze","sceneflow","continuity","drift","defect"].includes(pendingTransfer.target) ? pendingTransfer : undefined} onConsumed={() => setPendingTransfer(null)} />)}
        <footer className="pt-8 text-center text-[11px] text-zinc-600">Prompt Forge · production toolkit · Postgres on same PC • your API keys encrypted • no images/videos generated</footer>
      </main>
      {keysModalOpen && (
        <KeyManager
          account={account}
          onAdd={async (key, label, provider) => {
            try {
              const { addKey } = await import("@/lib/auth");
              await addKey(account.email, key, label, provider);
              await refreshAccount();
              return null;
            } catch (e) { return e instanceof Error ? e.message : "Could not add key."; }
          }}
          onRemove={async (keyId) => {
            const { removeKey } = await import("@/lib/auth");
            await removeKey(account.email, keyId);
            await refreshAccount();
          }}
          onToggle={async (keyId, enabled) => {
            const { setKeyEnabled } = await import("@/lib/auth");
            await setKeyEnabled(account.email, keyId, enabled);
            await refreshAccount();
          }}
          onClose={() => setKeysModalOpen(false)}
        />
      )}
    </div>
  );
}
