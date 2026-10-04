import { prisma } from "@/server/db";
import { api, body, ok, HttpError } from "@/server/http";
import { createSession, hashPassword } from "@/server/auth";
import { registerSchema } from "@/server/schemas";
import { ensureSystemData } from "@/server/bootstrap";
import { createPersonalWorkspace } from "@/server/workspace";
import { acceptInvitation } from "@/server/services/team";
import { DEFAULT_PLAN } from "@/core/billing";

/**
 * Регистрация. Без приглашения — личное рабочее пространство и 7-дневный пробный период на выбранном тарифе
 * (по умолчанию «Базовый»). По приглашению — сразу участник рабочего пространства пригласившей команды.
 */
export const POST = api(async (req) => {
  const data = await body(req, registerSchema);
  await ensureSystemData();
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw new HttpError(409, "Пользователь с таким email уже зарегистрирован");
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        passwordHash: await hashPassword(data.password),
        name: data.name,
        appraiser: { create: { fullName: data.name ?? "", email: data.email } },
      },
    });
    if (data.invite) {
      const joined = await acceptInvitation(user.id, user.email, data.invite, new Date(), tx);
      return { user, joined };
    }
    const ws = await createPersonalWorkspace(user.id, data.name || data.email, data.plan ?? DEFAULT_PLAN, tx);
    const sub = await tx.subscription.findUniqueOrThrow({ where: { workspaceId: ws.id } });
    return { user, trial: { plan: sub.planCode, trialEndsAt: sub.trialEndsAt?.toISOString() ?? null } };
  });
  await createSession(result.user.id);
  return ok({ id: result.user.id, email: result.user.email, joined: "joined" in result ? result.joined : null, trial: "trial" in result ? result.trial : null }, 201);
});
