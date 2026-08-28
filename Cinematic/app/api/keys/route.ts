import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/crypto";
export async function GET() {
  const sess = await getSession();
  if (!sess) return Response.json({ error: "Not authed" }, { status: 401 });
  const keys = await prisma.storedKey.findMany({ where: { userId: sess.userId }, orderBy: { addedAt: "asc" } });
  return Response.json({ keys: keys.map(k=>({ id:k.id, label:k.label, provider:k.provider, enabled:k.enabled, uses:k.uses, lastError:k.lastError, lastUsedAt:k.lastUsedAt, addedAt:k.addedAt, keyMask: k.keyEncrypted.slice(0,4)+"••••" })) });
}
export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return Response.json({ error: "Not authed" }, { status: 401 });
  const { key, label, provider } = await req.json();
  const trimmed = String(key||"").trim();
  if (!trimmed) return Response.json({ error: "Key required" }, { status: 400 });
  const valid = provider==="openrouter"? /^sk-or-v1-/i.test(trimmed) : provider==="google"? trimmed.length>=15 : provider==="huggingface"? /^hf_[0-9A-Za-z]{10,}$/.test(trimmed) : true;
  if (!valid) return Response.json({ error: "Invalid key format" }, { status: 400 });
  const enc = encrypt(trimmed);
  const exists = await prisma.storedKey.findFirst({ where: { userId: sess.userId, keyEncrypted: enc } });
  const created = await prisma.storedKey.create({ data: { userId: sess.userId, label: String(label||`Key ${Date.now()}`), provider: String(provider||"openrouter"), keyEncrypted: enc, enabled: true } });
  return Response.json({ id: created.id });
}
