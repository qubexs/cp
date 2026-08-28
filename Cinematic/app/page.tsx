"use client";
import { useCallback, useEffect, useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import KeyManager from "@/components/KeyManager";
import CinematicBuilder from "@/components/tools/CinematicBuilder";
import { apiFetchMe, logout, migrateLocalToPostgres, type Account } from "@/lib/auth";
export default function Page() {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const load = useCallback(async () => {
    const me = await apiFetchMe();
    if (me) {
      if (me.keys.length === 0) {
        const imported = await migrateLocalToPostgres();
        if (imported > 0) { const me2 = await apiFetchMe(); setAccount(me2); setReady(true); return; }
      }
      setAccount(me); setReady(true); return;
    }
    const email = typeof window !== "undefined" ? localStorage.getItem("promptforge_session") : null;
    if (email) {
      const { getAccount } = await import("@/lib/auth");
      setAccount(getAccount(email));
    } else setAccount(null);
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  const refresh = useCallback(async () => {
    const me = await apiFetchMe();
    if (me) setAccount(me);
    else {
      const { getAccount, getSessionEmail } = await import("@/lib/auth");
      const email = getSessionEmail();
      setAccount(email ? getAccount(email) : null);
    }
  }, []);
  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500 text-xs">Loading Cinematic Lab…</div>;
  if (!account) return <AuthScreen onAuthed={(a) => setAccount(a)} />;
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.07),transparent_55%)]" />
      <header className="relative mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-sky-500 text-xl">🎬</div>
          <div><h1 className="text-base font-bold tracking-tight">Cinematic Prompt Lab</h1><p className="text-[11px] text-zinc-500">Standalone · Turbopack · Postgres same PC</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">{account.email}</span>
          <button onClick={() => setKeysOpen(true)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-fuchsia-500/60">Keys {account.keys.filter(k=>k.enabled).length}/{account.keys.length}</button>
          <button onClick={async () => { await logout(); setAccount(null); }} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-red-300">Sign out</button>
        </div>
      </header>
      <main className="relative mx-auto max-w-4xl px-4 pb-16 pt-6">
        <CinematicBuilder account={account} refreshAccount={refresh} openKeys={() => setKeysOpen(true)} />
        <footer className="pt-8 text-center text-[11px] text-zinc-600">Cinematic Prompt Lab · standalone Turbopack · Postgres same PC · Veo/Kling/Wan prompts</footer>
      </main>
      {keysOpen && (
        <KeyManager
          account={account}
          onAdd={async (key, label, provider) => {
            try { const { addKey } = await import("@/lib/auth"); await addKey(account.email, key, label, provider); await refresh(); return null; } catch(e){ return e instanceof Error?e.message:"Error"; }
          }}
          onRemove={async (id)=>{ const { removeKey } = await import("@/lib/auth"); await removeKey(account.email,id); await refresh(); }}
          onToggle={async (id,en)=>{ const { setKeyEnabled } = await import("@/lib/auth"); await setKeyEnabled(account.email,id,en); await refresh(); }}
          onClose={()=>setKeysOpen(false)}
        />
      )}
    </div>
  );
}
