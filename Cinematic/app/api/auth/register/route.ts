import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import bcrypt from "bcryptjs";
export async function POST(req: Request) {
  const { email, password } = await req.json();
  const norm = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) return Response.json({ error: "Invalid email" }, { status: 400 });
  if (!password || String(password).length < 6) return Response.json({ error: "Password >=6 chars" }, { status: 400 });
  const exists = await prisma.user.findUnique({ where: { email: norm } });
  if (exists) return Response.json({ error: "Account exists" }, { status: 400 });
  const hash = await bcrypt.hash(String(password), 10);
  const user = await prisma.user.create({ data: { email: norm, passwordHash: hash } });
  await createSession(user.id, user.email);
  return Response.json({ id: user.id, email: user.email });
}
