"use client";

import { useState } from "react";
import { login, register, type Account } from "@/lib/auth";

type Mode = "login" | "register";

export default function AuthScreen({
  onAuthed,
}: {
  onAuthed: (account: Account) => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Please fill in both email and password.");
      return;
    }
    if (mode === "register" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const account =
        mode === "login"
          ? await login(email, password)
          : await register(email, password);
      onAuthed(account);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.10),transparent_55%)]" />
      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl shadow-black/40">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-sky-500 text-2xl font-bold text-white">
              ⚡
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Prompt Forge</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {mode === "login"
                ? "Welcome back — sign in to forge prompts."
                : "Create your account to store your own API keys."}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
            {(
              [
                { id: "login", label: "Sign in" },
                { id: "register", label: "Create account" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id);
                  setError(null);
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  mode === t.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="you@example.com"
            autoComplete="email"
            className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
          />

          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Password
          </label>
          <div className="relative mb-4">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 pr-16 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
            />
            <button
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {mode === "register" && (
            <>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Confirm password
              </label>
              <div className="relative mb-4">
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 pr-16 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-fuchsia-500"
                />
              </div>
            </>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="mt-1 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in →" : "Create account →"}
          </button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-600">
            Accounts and API keys are stored locally in <b>your browser only</b> — never sent to any
            server. Passwords are hashed with SHA-256.
            <br />
            OpenRouter keys?{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-fuchsia-400 hover:underline"
            >
              Get one here ↗
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}