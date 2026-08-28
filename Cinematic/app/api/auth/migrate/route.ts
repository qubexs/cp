import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { encrypt } from "@/lib/crypto";
export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return Response.json({ error: "Not authed" }, { status: 401 });
  const { keys } = await req.json() as { keys: { label:string; provider:string; key:string; enabled:boolean }[] };
  if (!Array.isArray(keys)) return Response.json({ error: "keys array required" }, { status: 400 });
  let imported = 0;
  for (const k of keys) {
    if (!k.key || !k.provider) continue;
    const enc = encrypt(String(k.key).trim());
    await prisma.storedKey.create({ data: { userId: sess.userId, label: k.label || `Key ${imported+1}`, provider: k.provider, keyEncrypted: enc, enabled: !!k.enabled } });
    imported++;
  }
  return Response.json({ imported });
}
