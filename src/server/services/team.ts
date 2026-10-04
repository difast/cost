// Участники рабочего пространства, приглашения и смена тарифа. Все проверки прав и лимитов — здесь, на сервере.
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../http";
import { sendMail } from "../mail";
import { SITE_URL } from "@/lib/site";
import {
  CONTACT_EMAIL, INVITATION_TTL_DAYS, ROLE_LABEL, can, canAddMember, canChangePlan, invitationProblem, isRole, membersLabel, plan, trialDaysLeft,
  ACCESS_LABEL, type PlanCode, type Role,
} from "@/core/billing";
import type { Access } from "../workspace";

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const normEmail = (e: string) => e.trim().toLowerCase();

/** Занятые места: участники + действующие (неистёкшие) приглашения. */
export async function occupiedSeats(workspaceId: string, now = new Date(), db: Prisma.TransactionClient = prisma) {
  const [members, invites] = await Promise.all([
    db.workspaceMember.count({ where: { workspaceId } }),
    db.invitation.count({ where: { workspaceId, status: "pending", expiresAt: { gt: now } } }),
  ]);
  return { members, invites, occupied: members + invites };
}

/** Сводка для раздела «Тариф и оплата». */
export async function billingSummary(a: Access) {
  const seats = await occupiedSeats(a.workspace.id);
  const s = a.subscription;
  const memberships = await prisma.workspaceMember.findMany({ where: { userId: a.user.id }, include: { workspace: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } });
  return {
    workspace: { id: a.workspace.id, name: a.workspace.name },
    role: a.role,
    roleLabel: ROLE_LABEL[a.role],
    plan: { code: a.plan.code, name: a.plan.name, priceRub: a.plan.priceRub, priceFrom: !!a.plan.priceFrom, maxMembers: a.plan.maxMembers },
    members: seats.members,
    pendingInvites: seats.invites,
    membersLabel: membersLabel(a.plan.code, seats.members),
    state: a.state,
    stateLabel: ACCESS_LABEL[a.state],
    trialStartsAt: s.trialStartsAt?.toISOString() ?? null,
    trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
    trialDaysLeft: trialDaysLeft(s),
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    paymentStatus: s.paymentStatus,
    permissions: { manageBilling: can(a.role, "manageBilling"), manageMembers: can(a.role, "manageMembers"), assignAdmin: can(a.role, "assignAdmin") },
    workspaces: memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.role, current: m.workspaceId === a.workspace.id })),
  };
}

export async function listMembers(a: Access) {
  const [members, invites] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: a.workspace.id },
      include: { user: { select: { id: true, email: true, name: true, appraiser: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({ where: { workspaceId: a.workspace.id, status: "pending" }, orderBy: { createdAt: "desc" } }),
  ]);
  const now = Date.now();
  return {
    members: members.map((m) => ({
      id: m.id, userId: m.userId, name: m.user.appraiser?.fullName || m.user.name || "", email: m.user.email,
      role: m.role, roleLabel: ROLE_LABEL[m.role as Role] ?? m.role, status: "active", statusLabel: "Активен", createdAt: m.createdAt.toISOString(), you: m.userId === a.user.id,
    })),
    invitations: invites.map((i) => {
      const expired = i.expiresAt.getTime() <= now;
      return { id: i.id, email: i.email, role: i.role, roleLabel: ROLE_LABEL[i.role as Role] ?? i.role, status: expired ? "expired" : "pending", statusLabel: expired ? "Приглашение истекло" : "Приглашение отправлено", createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString() };
    }),
  };
}

/**
 * Пригласить участника. Повторное приглашение того же email не создаёт дубль — обновляет срок и ссылку.
 * Лимит тарифа учитывает участников и действующие приглашения.
 */
export async function inviteMember(a: Access, emailRaw: string, role: Role = "member", now = new Date()) {
  if (!can(a.role, "manageMembers")) throw new HttpError(403, "Приглашать участников могут владелец и администратор");
  if (role === "owner") throw new HttpError(400, "Владелец у рабочего пространства один");
  if (role === "admin" && !can(a.role, "assignAdmin")) throw new HttpError(403, "Назначать администраторов может только владелец");
  const email = normEmail(emailRaw);
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser && (await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: a.workspace.id, userId: existingUser.id } } }))) {
    throw new HttpError(409, "Этот пользователь уже участник рабочего пространства");
  }
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * 86_400_000);
  const pending = await prisma.invitation.findFirst({ where: { workspaceId: a.workspace.id, email, status: "pending" }, orderBy: { createdAt: "desc" } });
  const pendingActive = pending && pending.expiresAt > now;
  if (!pendingActive) {
    const seats = await occupiedSeats(a.workspace.id, now);
    const check = canAddMember(a.plan.code, seats.occupied);
    if (!check.ok) throw new HttpError(402, check.message, { reason: "member_limit", upgrade: check.upgrade, contact: CONTACT_EMAIL });
  }
  const inv = pending
    ? await prisma.invitation.update({ where: { id: pending.id }, data: { tokenHash: hashToken(token), role, expiresAt, invitedById: a.user.id } })
    : await prisma.invitation.create({ data: { workspaceId: a.workspace.id, email, role, tokenHash: hashToken(token), expiresAt, invitedById: a.user.id } });
  const link = `${SITE_URL}/invite/${token}`;
  const inviter = a.user.name || a.user.email;
  const mail = await sendMail({
    to: email,
    subject: `Приглашение в рабочее пространство «${a.workspace.name}» — ЭВМО`,
    text: `${inviter} приглашает вас в рабочее пространство «${a.workspace.name}» в ЭВМО — рабочей системе для оценки недвижимости.\n\nПринять приглашение: ${link}\n\nСсылка действует ${INVITATION_TTL_DAYS} дней. Вопросы: ${CONTACT_EMAIL}`,
  });
  return { id: inv.id, email, role, expiresAt: expiresAt.toISOString(), link, emailSent: mail.sent, renewed: !!pending };
}

export async function revokeInvitation(a: Access, id: string) {
  if (!can(a.role, "manageMembers")) throw new HttpError(403, "Недостаточно прав");
  const r = await prisma.invitation.updateMany({ where: { id, workspaceId: a.workspace.id, status: "pending" }, data: { status: "revoked" } });
  if (!r.count) throw new HttpError(404, "Приглашение не найдено");
}

/** Сведения о приглашении по ссылке (без входа): куда приглашают и действует ли оно. */
export async function invitationInfo(token: string) {
  const inv = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { workspace: { select: { name: true } }, invitedBy: { select: { name: true, email: true } } } });
  if (!inv) return null;
  const expired = inv.expiresAt.getTime() <= Date.now();
  return { email: inv.email, workspace: inv.workspace.name, role: inv.role, roleLabel: ROLE_LABEL[inv.role as Role] ?? inv.role, invitedBy: inv.invitedBy.name || inv.invitedBy.email, status: expired && inv.status === "pending" ? "expired" : inv.status, expiresAt: inv.expiresAt.toISOString() };
}

/** Принять приглашение: пользователь становится участником, рабочее пространство — текущим. */
export async function acceptInvitation(userId: string, userEmail: string, token: string, now = new Date(), tx: Prisma.TransactionClient = prisma) {
  const inv = await tx.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { workspace: { include: { subscription: true } } } });
  const problem = invitationProblem(inv, userEmail, now);
  if (problem || !inv) throw new HttpError(inv && new Date(inv.expiresAt) <= now ? 410 : 400, problem ?? "Приглашение не найдено");
  const exists = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: inv.workspaceId, userId } } });
  if (!exists) {
    // приглашение уже занимает место; проверяем, что участников не больше лимита
    const members = await tx.workspaceMember.count({ where: { workspaceId: inv.workspaceId } });
    const check = canAddMember(plan(inv.workspace.subscription?.planCode).code, members);
    if (!check.ok) throw new HttpError(402, check.message, { reason: "member_limit", upgrade: check.upgrade, contact: CONTACT_EMAIL });
    await tx.workspaceMember.create({ data: { workspaceId: inv.workspaceId, userId, role: isRole(inv.role) && inv.role !== "owner" ? inv.role : "member" } });
  }
  await tx.invitation.update({ where: { id: inv.id }, data: { status: "accepted", acceptedAt: now } });
  await tx.user.update({ where: { id: userId }, data: { currentWorkspaceId: inv.workspaceId } });
  return { workspaceId: inv.workspaceId, workspace: inv.workspace.name };
}

export async function removeMember(a: Access, memberId: string) {
  const m = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId: a.workspace.id } });
  if (!m) throw new HttpError(404, "Участник не найден");
  if (m.role === "owner") throw new HttpError(400, "Владельца нельзя исключить из рабочего пространства");
  const self = m.userId === a.user.id;
  if (!self) {
    if (!can(a.role, "manageMembers")) throw new HttpError(403, "Исключать участников могут владелец и администратор");
    if (m.role === "admin" && !can(a.role, "assignAdmin")) throw new HttpError(403, "Исключить администратора может только владелец");
  }
  // данные (оценки) остаются в рабочем пространстве — ничего не удаляется
  await prisma.workspaceMember.delete({ where: { id: m.id } });
  await prisma.user.updateMany({ where: { id: m.userId, currentWorkspaceId: a.workspace.id }, data: { currentWorkspaceId: null } });
}

export async function changeRole(a: Access, memberId: string, role: Role) {
  if (!can(a.role, "assignAdmin")) throw new HttpError(403, "Менять роли может только владелец");
  if (role === "owner") throw new HttpError(400, "Передача владения пока не поддерживается");
  const m = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId: a.workspace.id } });
  if (!m) throw new HttpError(404, "Участник не найден");
  if (m.role === "owner") throw new HttpError(400, "Роль владельца не меняется");
  await prisma.workspaceMember.update({ where: { id: m.id }, data: { role } });
}

/**
 * Смена тарифа владельцем. Во время пробного периода — сразу (пробный период продолжается на новом тарифе).
 * Оплата пока не подключена: после окончания пробного периода тариф фиксируется, а доступ откроется после оплаты.
 */
export async function changePlan(a: Access, to: PlanCode) {
  if (!can(a.role, "manageBilling")) throw new HttpError(403, "Тариф может менять только владелец рабочего пространства");
  const { members } = await occupiedSeats(a.workspace.id);
  const check = canChangePlan(to, members);
  if (!check.ok) throw new HttpError(400, check.message);
  await prisma.subscription.update({ where: { workspaceId: a.workspace.id }, data: { planCode: to } });
  return { plan: to, paymentRequired: a.state !== "trial_active" && a.state !== "active" };
}

export async function switchWorkspace(userId: string, workspaceId: string) {
  const m = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!m) throw new HttpError(404, "Рабочее пространство не найдено");
  await prisma.user.update({ where: { id: userId }, data: { currentWorkspaceId: workspaceId } });
}

export async function renameWorkspace(a: Access, name: string) {
  if (!can(a.role, "editWorkspace")) throw new HttpError(403, "Недостаточно прав");
  await prisma.workspace.update({ where: { id: a.workspace.id }, data: { name } });
}
