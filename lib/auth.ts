import type { Provider } from "./types";
export interface StoredKey {
  id: string;
  key: string;
  keyMask?: string;
  label: string;
  provider: Provider;
  enabled: boolean;
  addedAt: number;
  uses: number;
  lastError?: string;
  lastUsedAt?: number;
}
export interface Account {
  id?: string;
  email: string;
  passwordHash?: string;
  salt?: string;
  keys: StoredKey[];
  rotationIndex: number;
}
const ACCOUNTS_STORAGE = "promptforge_accounts";
const SESSION_STORAGE = "promptforge_session";
const hasWindow = typeof window !== "undefined";
function loadAccounts(): Record<string, Account> {
  if (!hasWindow) return {};
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE);
    const accounts = raw ? (JSON.parse(raw) as Record<string, Account>) : {};
    for (const email of Object.keys(accounts)) {
      const a = accounts[email];
      if (a.keys) a.keys = a.keys.map((k) => ({ ...k, provider: k.provider ?? "openrouter" }));
    }
    return accounts;
  } catch { return {}; }
}
function saveAccounts(accounts: Record<string, Account>) {
  if (!hasWindow) return;
  try { localStorage.setItem(ACCOUNTS_STORAGE, JSON.stringify(accounts)); } catch {}
}
export function randomId(): string { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
export function maskKey(key: string): string { if (!key) return ""; if (key.length <= 10) return "•••"; return `${key.slice(0, 8)}••••${key.slice(-4)}`; }
export function isValidEmail(email: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }
export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
export function getSessionEmail(): string { if (!hasWindow) return ""; return localStorage.getItem(SESSION_STORAGE) ?? ""; }
export function setSessionEmail(email: string) { if (!hasWindow) return; if (email) localStorage.setItem(SESSION_STORAGE, email); else localStorage.removeItem(SESSION_STORAGE); }
export function getAccount(email: string): Account | null { const accounts = loadAccounts(); return accounts[normalizeEmail(email)] ?? null; }
export function getLocalAccounts(): Record<string, Account> { return loadAccounts(); }
async function tryApi<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}
export async function apiFetchMe(): Promise<Account | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch { return null; }
}
export async function register(email: string, password: string): Promise<Account> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) throw new Error("Please enter a valid email address.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters long.");
  try {
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalized, password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Register failed");
    setSessionEmail(normalized);
    const me = await apiFetchMe();
    if (me) return me;
    return { email: normalized, keys: [], rotationIndex: 0 };
  } catch (e:any) {
    if (e.message && e.message.includes("fetch")) {
      // fallback to localStorage
      const accounts = loadAccounts();
      if (accounts[normalized]) throw new Error("An account with this email already exists.");
      const salt = randomId() + randomId();
      const hash = await sha256Hex(`${salt}:${password}`);
      const account: Account = { email: normalized, passwordHash: hash, salt, keys: [], rotationIndex: 0 };
      accounts[normalized] = account; saveAccounts(accounts); setSessionEmail(normalized); return account;
    }
    throw e;
  }
}
export async function login(email: string, password: string): Promise<Account> {
  const normalized = normalizeEmail(email);
  try {
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalized, password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setSessionEmail(normalized);
    const me = await apiFetchMe();
    if (me) return me;
    return { email: normalized, keys: [], rotationIndex: 0 };
  } catch (e:any) {
    if (e.message && e.message.includes("fetch")) {
      const account = getAccount(normalized);
      if (!account) throw new Error("No account found for this email. Create one first.");
      const hash = await sha256Hex(`${account.salt}:${password}`);
      if (hash !== account.passwordHash) throw new Error("Incorrect password.");
      setSessionEmail(normalized); return account;
    }
    throw e;
  }
}
export async function logout() {
  try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
  setSessionEmail("");
}
export function updateAccount(account: Account) { const accounts = loadAccounts(); accounts[account.email] = account; saveAccounts(accounts); }
export async function addKey(email: string, apiKey: string, label: string, provider: Provider): Promise<StoredKey> {
  const trimmed = apiKey.trim();
  // try API first if session active
  try {
    const res = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: trimmed, label, provider }) });
    if (res.ok) {
      const me = await apiFetchMe();
      const k = me?.keys.find((x:any)=> x.label===label) || me?.keys[me.keys.length-1];
      if (k) return k as StoredKey;
      throw new Error("added via API");
    }
    const data = await res.json();
    if (res.status !== 401) throw new Error(data.error || "Could not add key");
  } catch (e:any) {
    if (e.message && !e.message.includes("fetch") && !e.message.includes("added via API")) throw e;
  }
  // fallback local
  const normalized = normalizeEmail(email);
  const account = getAccount(normalized);
  if (!account) throw new Error("Account not found.");
  const valid = provider === "openrouter" ? /^sk-or-v1-/i.test(trimmed) : provider === "google" ? trimmed.length >= 15 : provider === "huggingface" ? /^hf_[0-9A-Za-z]{10,}$/.test(trimmed) : true;
  if (!valid) throw new Error(provider === "openrouter" ? "Key should start with sk-or-v1-." : provider === "google" ? "Google keys start with AIza" : "Hugging Face keys start with hf_");
  if (account.keys.some((k) => k.key === trimmed)) throw new Error("This key is already stored.");
  const stored: StoredKey = { id: randomId(), key: trimmed, label: label.trim() || `Key ${account.keys.length + 1}`, provider, enabled: true, addedAt: Date.now(), uses: 0 };
  account.keys.push(stored); updateAccount(account); return stored;
}
export async function removeKey(email: string, keyId: string) {
  try {
    const res = await fetch(`/api/keys/${keyId}`, { method: "DELETE" });
    if (res.ok) return;
  } catch {}
  const account = getAccount(email);
  if (!account) return;
  account.keys = account.keys.filter((k) => k.id !== keyId);
  if (account.rotationIndex >= account.keys.length && account.keys.length > 0) account.rotationIndex = 0;
  updateAccount(account);
}
export async function setKeyEnabled(email: string, keyId: string, enabled: boolean) {
  try {
    const res = await fetch(`/api/keys/${keyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    if (res.ok) return;
  } catch {}
  const account = getAccount(email);
  if (!account) return;
  const k = account.keys.find((x) => x.id === keyId);
  if (k) k.enabled = enabled;
  updateAccount(account);
}
export function updateKeyStatus(email: string, keyId: string, opts: { ok?: boolean; errorMessage?: string }) {
  const account = getAccount(email);
  if (!account) return;
  const k = account.keys.find((x) => x.id === keyId);
  if (!k) return;
  if (opts.ok) { k.uses += 1; k.lastUsedAt = Date.now(); delete k.lastError; } else if (opts.errorMessage) k.lastError = opts.errorMessage;
  updateAccount(account);
}
export function advanceRotation(email: string) {
  const account = getAccount(email);
  if (!account) return;
  const enabled = account.keys.filter((k) => k.enabled);
  account.rotationIndex = enabled.length > 0 ? (account.rotationIndex + 1) % enabled.length : 0;
  updateAccount(account);
}
export function nextRotationOrder(email: string): StoredKey[] {
  const account = getAccount(email);
  if (!account) return [];
  const enabled = account.keys.filter((k) => k.enabled);
  if (enabled.length === 0) return [];
  const start = account.rotationIndex % enabled.length;
  return [...enabled.slice(start), ...enabled.slice(0, start)];
}
export function enabledKeysCount(email: string): number {
  const account = getAccount(email);
  if (!account) return 0;
  return account.keys.filter((k) => k.enabled).length;
}
export function nextRotationOrderFromAccount(account: Account): StoredKey[] {
  const enabled = account.keys.filter((k) => k.enabled);
  if (enabled.length === 0) return [];
  const start = (account.rotationIndex ?? 0) % enabled.length;
  return [...enabled.slice(start), ...enabled.slice(0, start)];
}
export function enabledKeysCountFromAccount(account: Account): number {
  return account.keys.filter((k) => k.enabled).length;
}
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function migrateLocalToPostgres() {
  const accounts = loadAccounts();
  const email = getSessionEmail();
  const acc = email ? accounts[normalizeEmail(email)] : null;
  if (!acc || acc.keys.length === 0) return 0;
  try {
    const res = await fetch("/api/auth/migrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: acc.keys.map(k=>({ label:k.label, provider:k.provider, key:k.key, enabled:k.enabled })) }) });
    const data = await res.json();
    if (res.ok) {
      acc.keys = [];
      saveAccounts(accounts);
      return data.imported || 0;
    }
  } catch {}
  return 0;
}
