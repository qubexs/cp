export interface StoredKey {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  addedAt: number;
  uses: number;
  lastError?: string;
  lastUsedAt?: number;
}

export interface Account {
  email: string;
  passwordHash: string;
  salt: string;
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
    return raw ? (JSON.parse(raw) as Record<string, Account>) : {};
  } catch {
    return {};
  }
}

function saveAccounts(accounts: Record<string, Account>) {
  if (!hasWindow) return;
  try {
    localStorage.setItem(ACCOUNTS_STORAGE, JSON.stringify(accounts));
  } catch {
    /* storage full or blocked */
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return "•••";
  return `${key.slice(0, 8)}••••${key.slice(-4)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getSessionEmail(): string {
  if (!hasWindow) return "";
  return localStorage.getItem(SESSION_STORAGE) ?? "";
}

export function setSessionEmail(email: string) {
  if (!hasWindow) return;
  if (email) localStorage.setItem(SESSION_STORAGE, email);
  else localStorage.removeItem(SESSION_STORAGE);
}

export function getAccount(email: string): Account | null {
  const accounts = loadAccounts();
  return accounts[normalizeEmail(email)] ?? null;
}

export async function register(email: string, password: string): Promise<Account> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) throw new Error("Please enter a valid email address.");
  if (password.length < 6)
    throw new Error("Password must be at least 6 characters long.");

  const accounts = loadAccounts();
  if (accounts[normalized]) throw new Error("An account with this email already exists.");

  const salt = randomId() + randomId();
  const passwordHash = await sha256Hex(`${salt}:${password}`);

  const account: Account = {
    email: normalized,
    passwordHash,
    salt,
    keys: [],
    rotationIndex: 0,
  };
  accounts[normalized] = account;
  saveAccounts(accounts);
  setSessionEmail(normalized);
  return account;
}

export async function login(email: string, password: string): Promise<Account> {
  const normalized = normalizeEmail(email);
  const account = getAccount(normalized);
  if (!account) throw new Error("No account found for this email. Create one first.");

  const hash = await sha256Hex(`${account.salt}:${password}`);
  if (hash !== account.passwordHash) throw new Error("Incorrect password.");

  setSessionEmail(normalized);
  return account;
}

export function logout() {
  setSessionEmail("");
}

export function updateAccount(account: Account) {
  const accounts = loadAccounts();
  accounts[account.email] = account;
  saveAccounts(accounts);
}

export function addKey(email: string, apiKey: string, label: string): StoredKey {
  const normalized = normalizeEmail(email);
  const account = getAccount(normalized);
  if (!account) throw new Error("Account not found.");
  if (!/^sk-or-v1-/i.test(apiKey.trim()))
    throw new Error("Key should start with sk-or-v1-.");
  if (account.keys.some((k) => k.key === apiKey.trim()))
    throw new Error("This key is already stored.");

  const stored: StoredKey = {
    id: randomId(),
    key: apiKey.trim(),
    label: label.trim() || `Key ${account.keys.length + 1}`,
    enabled: true,
    addedAt: Date.now(),
    uses: 0,
  };
  account.keys.push(stored);
  updateAccount(account);
  return stored;
}

export function removeKey(email: string, keyId: string) {
  const account = getAccount(email);
  if (!account) return;
  account.keys = account.keys.filter((k) => k.id !== keyId);
  if (account.rotationIndex >= account.keys.length && account.keys.length > 0) {
    account.rotationIndex = 0;
  }
  updateAccount(account);
}

export function setKeyEnabled(email: string, keyId: string, enabled: boolean) {
  const account = getAccount(email);
  if (!account) return;
  const k = account.keys.find((x) => x.id === keyId);
  if (k) k.enabled = enabled;
  updateAccount(account);
}

export function updateKeyStatus(
  email: string,
  keyId: string,
  opts: { ok?: boolean; errorMessage?: string }
) {
  const account = getAccount(email);
  if (!account) return;
  const k = account.keys.find((x) => x.id === keyId);
  if (!k) return;
  if (opts.ok) {
    k.uses += 1;
    k.lastUsedAt = Date.now();
    delete k.lastError;
  } else if (opts.errorMessage) {
    k.lastError = opts.errorMessage;
  }
  updateAccount(account);
}

export function advanceRotation(email: string) {
  const account = getAccount(email);
  if (!account) return;
  const enabled = account.keys.filter((k) => k.enabled);
  account.rotationIndex =
    enabled.length > 0 ? (account.rotationIndex + 1) % enabled.length : 0;
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