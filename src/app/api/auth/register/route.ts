import { prisma } from "@/server/db";
import { api, body, ok, HttpError } from "@/server/http";
import { createSession, hashPassword } from "@/server/auth";
import { registerSchema } from "@/server/schemas";
import { ensureSystemData } from "@/server/bootstrap";

export const POST = api(async (req) => {
  const data = await body(req, registerSchema);
  await ensureSystemData();
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw new HttpError(409, "Пользователь с таким email уже зарегистрирован");
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await hashPassword(data.password),
      name: data.name,
      appraiser: { create: { fullName: data.name ?? "", email: data.email } },
    },
  });
  await createSession(user.id);
  return ok({ id: user.id, email: user.email }, 201);
});
