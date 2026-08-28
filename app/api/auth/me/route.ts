import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
export async function GET() {
  const sess = await getSession();
  if (!sess) return Response.json({ user: null }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: sess.userId }, include: { keys: { orderBy: { addedAt: "asc" } } } });
  if (!user) return Response.json({ user: null }, { status: 401 });
  return Response.json({ user: { id: user.id, email: user.email, rotationIndex: user.rotationIndex, keys: user.keys.map(k=>({ id:k.id, label:k.label, provider:k.provider, enabled:k.enabled, uses:k.uses, lastError:k.lastError, lastUsedAt:k.lastUsedAt, addedAt:k.addedAt, key: decrypt(k.keyEncrypted) })) } });
}
