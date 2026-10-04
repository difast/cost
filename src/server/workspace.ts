// Рабочее пространство пользователя, его роль и подписка — все проверки доступа выполняются здесь, на сервере.
import type { Prisma, Subscription, User } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./http";
import { currentUser, requireUser } from "./auth";
import { DEFAULT_PLAN, accessState, can, canUseFeature, hasPaidAccess, isPlanCode, newTrial, plan, type AccessState, type Feature, type PlanCode, type Permission, type Role } from "@/core/billing";

export interface Access {
  user: User;
  workspace: { id: string; name: string; ownerId: string };
  role: Role;
  subscription: Subscription;
  state: AccessState;
  plan: ReturnType<typeof plan>;
}

type Tx = Prisma.TransactionClient;

/** Личное рабочее пространство с пробным периодом — при регистрации (или если у пользователя нет ни одного). */
export async function createPersonalWorkspace(userId: string, name: string, planCode: PlanCode = DEFAULT_PLAN, tx: Tx = prisma) {
  const ws = await tx.workspace.create({
    data: {
      name,
      ownerId: userId,
      members: { create: { userId, role: "owner" } },
      subscription: { create: { planCode, ...newTrial() } },
    },
  });
  await tx.user.update({ where: { id: userId }, data: { currentWorkspaceId: ws.id } });
  return ws;
}

/** Текущее рабочее пространство пользователя, роль и состояние подписки. */
export async function getAccess(user: User): Promise<Access> {
  let members = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: { include: { subscription: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!members.length) {
    await prisma.$transaction((tx) => createPersonalWorkspace(user.id, user.name || user.email, DEFAULT_PLAN, tx));
    members = await prisma.workspaceMember.findMany({ where: { userId: user.id }, include: { workspace: { include: { subscription: true } } } });
  }
  const m = members.find((x) => x.workspaceId === user.currentWorkspaceId) ?? members[0];
  let sub = m.workspace.subscription;
  if (!sub) sub = await prisma.subscription.create({ data: { workspaceId: m.workspaceId, planCode: DEFAULT_PLAN, ...newTrial() } });
  const { subscription: _s, ...workspace } = m.workspace;
  return { user, workspace, role: m.role as Role, subscription: sub, state: accessState(sub), plan: plan(sub.planCode) };
}

export async function requireAccess(): Promise<Access> {
  return getAccess(await requireUser());
}

export const PAYWALL_MESSAGE = "Пробный период закончился. Данные сохранены и доступны для просмотра — чтобы создавать и изменять оценки, выберите тариф.";
const EXPIRED_MESSAGE = "Подписка закончилась. Данные сохранены и доступны для просмотра — чтобы продолжить работу, продлите тариф.";

export function assertPaid(a: Access) {
  if (!hasPaidAccess(a.state)) throw new HttpError(402, a.state === "trial_expired" ? PAYWALL_MESSAGE : EXPIRED_MESSAGE, { state: a.state });
}

export function assertFeature(a: Access, f: Feature) {
  assertPaid(a);
  if (!canUseFeature(a.subscription, f)) throw new HttpError(403, `Функция недоступна в тарифе «${a.plan.name}»`, { feature: f, plan: a.plan.code });
}

export function assertCan(a: Access, p: Permission) {
  if (!can(a.role, p)) throw new HttpError(403, "Недостаточно прав для этого действия");
}

/**
 * Изменение данных (оценки, справочники, аналоги) — только при действующем пробном периоде или подписке.
 * Вызывается обёрткой api() для запросов, меняющих данные. Без входа — пропускает (маршрут сам вернёт 401).
 */
export async function assertWriteAccess() {
  const u = await currentUser();
  if (!u) return;
  assertPaid(await getAccess(u));
}

export async function workspaceUserIds(workspaceId: string) {
  return (await prisma.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true } })).map((m) => m.userId);
}

export { isPlanCode };
