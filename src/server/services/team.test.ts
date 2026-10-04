// Интеграционные тесты тарифов и команды на реальной БД (PostgreSQL из DATABASE_URL).
// Если база недоступна — набор пропускается. Создаются временные пользователи t-*@test.evmo.local, в конце удаляются.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "../db";
import { HttpError } from "../http";
import { assertPaid, createPersonalWorkspace, getAccess } from "../workspace";
import { acceptInvitation, changePlan, changeRole, inviteMember, occupiedSeats, removeMember } from "./team";
import { createAssessment, getOwned } from "./assessment";
import type { PlanCode } from "@/core/billing";

let dbUp = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbUp = true;
} catch {
  dbUp = false;
}

const RUN = crypto.randomBytes(4).toString("hex");
const emails: string[] = [];
const mail = (n: string) => {
  const e = `t-${RUN}-${n}@test.evmo.local`;
  emails.push(e);
  return e;
};

async function newUser(n: string, planCode: PlanCode = "basic") {
  const u = await prisma.user.create({ data: { email: mail(n), passwordHash: "x", name: `Тест ${n}` } });
  await prisma.$transaction((tx) => createPersonalWorkspace(u.id, `ws ${n}`, planCode, tx));
  return prisma.user.findUniqueOrThrow({ where: { id: u.id } });
}
async function access(userId: string) {
  return getAccess(await prisma.user.findUniqueOrThrow({ where: { id: userId } }));
}
/** Пригласить и принять: возвращает нового участника. */
async function addMember(ownerId: string, n: string, role: "member" | "admin" = "member") {
  const res = await inviteMember(await access(ownerId), mail(n), role);
  const token = res.link.split("/invite/")[1];
  const u = await prisma.user.create({ data: { email: res.email, passwordHash: "x", name: n } });
  await acceptInvitation(u.id, u.email, token);
  return u;
}
const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 0;
  } catch (e) {
    if (e instanceof HttpError) return e.status;
    throw e;
  }
};

afterAll(async () => {
  if (!dbUp) return;
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const ws = await prisma.workspace.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
  await prisma.assessment.deleteMany({ where: { workspaceId: { in: ws.map((w) => w.id) } } });
  await prisma.workspace.deleteMany({ where: { id: { in: ws.map((w) => w.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe.skipIf(!dbUp)("тарифы и команда (БД)", () => {
  beforeAll(() => undefined);

  it("1–2. новый пользователь получает 7-дневный trial на выбранном тарифе; trial активен", async () => {
    const u = await newUser("trial", "pro");
    const a = await access(u.id);
    expect(a.subscription.status).toBe("trialing");
    expect(a.plan.code).toBe("pro");
    expect(a.role).toBe("owner");
    const days = (a.subscription.trialEndsAt!.getTime() - a.subscription.trialStartsAt!.getTime()) / 86_400_000;
    expect(days).toBe(7);
    expect(a.state).toBe("trial_active");
    expect(() => assertPaid(a)).not.toThrow();
  });

  it("3. после окончания trial изменение данных запрещено (402), данные сохраняются и читаются", async () => {
    const u = await newUser("expired");
    const before = await access(u.id);
    const asm = await createAssessment(u.id, { address: "г. Тест, ул. Проверочная, 1" }, before.workspace.id);
    await prisma.subscription.update({ where: { workspaceId: before.workspace.id }, data: { trialEndsAt: new Date(Date.now() - 1000) } });
    const a = await access(u.id);
    expect(a.state).toBe("trial_expired");
    expect(() => assertPaid(a)).toThrow(HttpError);
    try { assertPaid(a); } catch (e) { expect((e as HttpError).status).toBe(402); }
    // данные не удаляются и остаются доступными
    expect((await getOwned(asm.id, u.id)).id).toBe(asm.id);
  });

  it("4. Базовый тариф не позволяет добавить второго пользователя", async () => {
    const u = await newUser("basic", "basic");
    expect(await status(inviteMember(await access(u.id), mail("basic-2")))).toBe(402);
  });

  it("5. Профессиональный — тоже один пользователь", async () => {
    const u = await newUser("pro", "pro");
    expect(await status(inviteMember(await access(u.id), mail("pro-2")))).toBe(402);
  });

  it("6–7. Команда: максимум 5 пользователей, шестой не добавляется (с предложением Корпоративного)", async () => {
    const owner = await newUser("team", "team");
    for (let i = 2; i <= 5; i++) await addMember(owner.id, `team-${i}`);
    const a = await access(owner.id);
    expect((await occupiedSeats(a.workspace.id)).members).toBe(5);
    try {
      await inviteMember(a, mail("team-6"));
      throw new Error("должно быть отклонено");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(402);
      expect((e as HttpError).message).toContain("перейдите на Корпоративный тариф");
      expect((e as HttpError).details).toMatchObject({ upgrade: "corporate", contact: "info@evmo.ru" });
    }
  });

  it("лимит учитывает и неистёкшие приглашения; повторное приглашение не создаёт дубль", async () => {
    const owner = await newUser("seats", "team");
    const a = await access(owner.id);
    const r1 = await inviteMember(a, mail("seats-x"));
    const r2 = await inviteMember(a, emails.at(-1)!);
    expect(r2.id).toBe(r1.id);
    expect(r2.renewed).toBe(true);
    expect(await prisma.invitation.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
    for (let i = 0; i < 3; i++) await inviteMember(a, mail(`seats-${i}`));
    expect(await status(inviteMember(a, mail("seats-over")))).toBe(402);
  });

  it("8. Корпоративный — без ограничения по количеству пользователей", async () => {
    const owner = await newUser("corp", "team");
    const ws = (await access(owner.id)).workspace.id;
    await prisma.subscription.update({ where: { workspaceId: ws }, data: { planCode: "corporate" } }); // подключается по согласованию
    for (let i = 2; i <= 7; i++) await addMember(owner.id, `corp-${i}`);
    expect((await occupiedSeats(ws)).members).toBe(7);
  });

  it("9. приглашение создаётся и принимается; участник видит оценки рабочего пространства", async () => {
    const owner = await newUser("inv", "team");
    const a = await access(owner.id);
    const asm = await createAssessment(owner.id, { address: "г. Тест, ул. Общая, 5" }, a.workspace.id);
    const member = await addMember(owner.id, "inv-m");
    const ma = await access(member.id);
    expect(ma.workspace.id).toBe(a.workspace.id);
    expect(ma.role).toBe("member");
    expect((await getOwned(asm.id, member.id)).id).toBe(asm.id);
    const inv = await prisma.invitation.findFirstOrThrow({ where: { workspaceId: a.workspace.id, email: member.email } });
    expect(inv.status).toBe("accepted");
    // посторонний пользователь оценку не видит
    const stranger = await newUser("stranger");
    expect(await status(getOwned(asm.id, stranger.id))).toBe(404);
  });

  it("10. просроченное приглашение использовать нельзя; чужой email — тоже", async () => {
    const owner = await newUser("exp", "team");
    const res = await inviteMember(await access(owner.id), mail("exp-m"));
    const token = res.link.split("/invite/")[1];
    const u = await prisma.user.create({ data: { email: res.email, passwordHash: "x" } });
    const other = await prisma.user.create({ data: { email: mail("exp-other"), passwordHash: "x" } });
    expect(await status(acceptInvitation(other.id, other.email, token))).toBe(400);
    await prisma.invitation.update({ where: { id: res.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await status(acceptInvitation(u.id, u.email, token))).toBe(410);
    expect(await prisma.workspaceMember.count({ where: { userId: u.id } })).toBe(0);
  });

  it("11. права проверяются на сервере: участник/администратор/владелец", async () => {
    const owner = await newUser("roles", "team");
    const admin = await addMember(owner.id, "roles-admin", "admin");
    const member = await addMember(owner.id, "roles-member");
    const oa = await access(owner.id), aa = await access(admin.id), ma = await access(member.id);
    expect(aa.role).toBe("admin");
    // участник не приглашает, не меняет тариф и роли, не исключает других
    expect(await status(inviteMember(ma, mail("roles-x")))).toBe(403);
    expect(await status(changePlan(ma, "basic"))).toBe(403);
    expect(await status(changeRole(ma, (await prisma.workspaceMember.findFirstOrThrow({ where: { userId: admin.id } })).id, "member"))).toBe(403);
    const ownerMember = await prisma.workspaceMember.findFirstOrThrow({ where: { userId: owner.id } });
    expect(await status(removeMember(ma, ownerMember.id))).toBe(400);
    // администратор приглашает участников, но не меняет тариф и не назначает администраторов
    expect(await status(inviteMember(aa, mail("roles-by-admin")))).toBe(0);
    expect(await status(inviteMember(aa, mail("roles-admin2"), "admin"))).toBe(403);
    expect(await status(changePlan(aa, "pro"))).toBe(403);
    // владелец меняет тариф; на тариф с меньшим лимитом при 3 участниках перейти нельзя
    expect(await status(changePlan(oa, "basic"))).toBe(400);
    expect(await status(changePlan(oa, "corporate"))).toBe(400);
    expect(await status(changePlan(oa, "team"))).toBe(0);
    // исключение участника не удаляет данные рабочего пространства
    const mm = await prisma.workspaceMember.findFirstOrThrow({ where: { userId: member.id } });
    expect(await status(removeMember(aa, mm.id))).toBe(0);
    expect(await prisma.workspaceMember.count({ where: { workspaceId: oa.workspace.id } })).toBe(2);
  });
});
