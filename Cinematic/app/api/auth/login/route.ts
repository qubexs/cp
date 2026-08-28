import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import bcrypt from "bcryptjs";
export async function POST(req: Request) {
  const { email, password } = await req.json();
  const norm = String(email || "").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: norm } });
  if (!user) return Response.json({ error: "No account" }, { status: 400 });
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return Response.json({ error: "Incorrect password" }, { status: 400 });
  await createSession(user.id, user.email);
  return Response.json({ id: user.id, email: user.email });
}
