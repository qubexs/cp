"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import KeyManager from "@/components/KeyManager";
import Sidebar, { type ToolId } from "@/components/Sidebar";
import PromptForge from "@/components/tools/PromptForge";
import ScanTool from "@/components/tools/ScanTool";
import {
  addKey,
  enabledKeysCount,
  getAccount,
  getSessionEmail,
  logout,
  removeKey,
  setKeyEnabled,
  type Account,
} from "@/lib/auth";
import { SCANS } from "@/lib/scan";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.10),transparent_55%)]" />
      <div className="relative flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-sky-500 text-2xl font-bold text-white">
          ⚡
        </div>
        <p className="text-xs text-zinc-500">Prompt Forge loading…</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [keysModalOpen, setKeysModalOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>("forge");

  useEffect(() => {
    const t = setTimeout(() => {
      const email = getSessionEmail();
      setAccount(email ? getAccount(email) : null);
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const refreshAccount = useCallback(() => {
    const email = getSessionEmail();
    setAccount(email ? getAccount(email) : null);
  }, []);

  const handleSignOut = () => {
    logout();
    setAccount(null);
    setSidebarOpen(false);
    setKeysModalOpen(false);
  };

  const enabledTotal = useMemo(
    () => (account ? enabledKeysCount(account.email) : 0),
    [account]
  );

  if (!ready) return <Splash />;

  if (!account) {
    return <AuthScreen onAuthed={(a) => setAccount(a)} />;
  }

  const openKeys = () => setKeysModalOpen(true);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.06),transparent_55%)]" />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        active={activeTool}
        onSelect={setActiveTool}
        account={account}
        enabledCount={enabledTotal}
        onManageKeys={openKeys}
        onSignOut={handleSignOut}
      />

      <header className="relative mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={sidebarOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-fuchsia-500/60 hover:text-fuchsia-300"
          >
            <span className="relative block h-3.5 w-5">
              <span
                className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${
                  sidebarOpen ? "top-1.5 rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-1.5 h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${
                  sidebarOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-3 h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${
                  sidebarOpen ? "top-1.5 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Prompt Forge</h1>
            <p className="text-[11px] text-zinc-500">
              Reference files → ready-to-paste generation prompts (text only)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {account.email}
          </span>
          <button
            onClick={openKeys}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              enabledTotal === 0
                ? "border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                : "border-zinc-700 text-zinc-300 hover:border-fuchsia-500/60 hover:text-fuchsia-300"
            }`}
          >
            Keys {enabledTotal}/{account.keys.length}
          </button>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-300"
          >
            Sign out
          </button>
        </div>
      </header>

      <main
        className={`relative mx-auto w-full max-w-4xl px-4 pb-16 pt-6 transition-[padding] duration-300 ${
          sidebarOpen ? "lg:pl-64" : ""
        }`}
      >
        {activeTool === "forge" ? (
          <PromptForge account={account} refreshAccount={refreshAccount} openKeys={openKeys} />
        ) : (
          <ScanTool
            account={account}
            config={SCANS[activeTool]}
            refreshAccount={refreshAccount}
            openKeys={openKeys}
          />
        )}

        <footer className="pt-8 text-center text-[11px] text-zinc-600">
          Prompt Forge · production toolkit · all analysis runs through your own OpenRouter keys · no
          images or videos are generated
        </footer>
      </main>

      {keysModalOpen && (
        <KeyManager
          account={account}
          onAdd={(key, label) => {
            try {
              addKey(account.email, key, label);
              refreshAccount();
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : "Could not add key.";
            }
          }}
          onRemove={(keyId) => {
            removeKey(account.email, keyId);
            refreshAccount();
          }}
          onToggle={(keyId, enabled) => {
            setKeyEnabled(account.email, keyId, enabled);
            refreshAccount();
          }}
          onClose={() => setKeysModalOpen(false)}
        />
      )}
    </div>
  );
}