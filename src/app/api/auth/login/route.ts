import { prisma } from "@/server/db";
import { api, body, ok, HttpError } from "@/server/http";
import { createSession, verifyPassword } from "@/server/auth";
import { loginSchema } from "@/server/schemas";

export const POST = api(async (req) => {
  const data = await body(req, loginSchema);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await verifyPassword(data.password, user.passwordHash))) throw new HttpError(401, "Неверный email или пароль");
  await createSession(user.id);
  return ok({ id: user.id, email: user.email });
});
