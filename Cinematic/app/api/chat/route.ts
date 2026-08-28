import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
import { sendProviderRequest } from "@/lib/providers";
import type { ModelChoice } from "@/lib/types";

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return Response.json({ error: "Not authed" }, { status: 401 });
  const { model, messages, temperature, max_tokens } = await req.json() as { model: ModelChoice; messages: any[]; temperature?: number; max_tokens?: number };
  const user = await prisma.user.findUnique({ where: { id: sess.userId }, include: { keys: { where: { enabled: true }, orderBy: { addedAt: "asc" } } } });
  if (!user || user.keys.length === 0) return Response.json({ error: "No enabled keys" }, { status: 400 });
  const order = (() => {
    const start = user.rotationIndex % user.keys.length;
    return [...user.keys.slice(start), ...user.keys.slice(0, start)];
  })();
  let lastError: string | null = null;
  const attempts: any[] = [];
  for (const k of order) {
    try {
      const apiKey = decrypt(k.keyEncrypted);
      const res = await sendProviderRequest({ provider: k.provider as any, apiKey, model, body: { messages, temperature, max_tokens } });
      await prisma.storedKey.update({ where: { id: k.id }, data: { uses: { increment: 1 }, lastUsedAt: new Date(), lastError: null } });
      await prisma.user.update({ where: { id: user.id }, data: { rotationIndex: (user.rotationIndex + 1) % user.keys.length } });
      attempts.push({ keyId: k.id, label: k.label, ok: true });
      return Response.json({ content: res.content, model: res.model, provider: k.provider, usedKeyId: k.id, attempts });
    } catch (e:any) {
      const msg = e?.message || String(e);
      lastError = msg;
      attempts.push({ keyId: k.id, label: k.label, ok: false, errorMessage: msg });
      await prisma.storedKey.update({ where: { id: k.id }, data: { lastError: msg } });
    }
  }
  return Response.json({ error: `All ${order.length} keys failed. Last: ${lastError}`, attempts }, { status: 502 });
}
