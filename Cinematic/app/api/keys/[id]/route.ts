import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sess = await getSession();
  if (!sess) return Response.json({ error: "Not authed" }, { status: 401 });
  const { id } = await params;
  const { enabled } = await req.json();
  await prisma.storedKey.updateMany({ where: { id, userId: sess.userId }, data: { enabled: !!enabled } });
  return Response.json({ ok: true });
}
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sess = await getSession();
  if (!sess) return Response.json({ error: "Not authed" }, { status: 401 });
  const { id } = await params;
  await prisma.storedKey.deleteMany({ where: { id, userId: sess.userId } });
  return Response.json({ ok: true });
}
