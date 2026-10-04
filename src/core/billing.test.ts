// Тарифы, пробный период, лимиты участников, права ролей — чистые правила.
import { describe, expect, it } from "vitest";
import {
  LIMIT_MESSAGE_TEAM, PLANS, TRIAL_DAYS, accessState, can, canAddMember, canChangePlan, canUseFeature, hasPaidAccess, invitationProblem,
  membersLabel, newTrial, planLimits, trialDaysLeft,
} from "./billing";

const NOW = new Date("2026-10-04T12:00:00Z");
const day = 86_400_000;
const trialSub = (endOffsetDays: number, planCode = "basic") => ({ planCode, status: "trialing", trialEndsAt: new Date(NOW.getTime() + endOffsetDays * day), currentPeriodEnd: null });

describe("тарифы", () => {
  it("4 тарифа с ценами и лимитами пользователей", () => {
    expect(Object.values(PLANS).map((p) => [p.code, p.priceRub, p.maxMembers])).toEqual([
      ["basic", 1990, 1], ["pro", 4990, 1], ["team", 9990, 5], ["corporate", 19990, null],
    ]);
    expect(PLANS.corporate.selfServe).toBe(false);
    expect(planLimits("team")).toEqual({ maxMembers: 5 });
  });
});

describe("пробный период", () => {
  it("новый trial — 7 дней от момента регистрации", () => {
    const t = newTrial(NOW);
    expect(TRIAL_DAYS).toBe(7);
    expect(t.status).toBe("trialing");
    expect(t.trialEndsAt.getTime() - t.trialStartsAt.getTime()).toBe(7 * day);
  });
  it("до окончания — активен, после — завершён; дни считаются на сервере по дате", () => {
    expect(accessState(trialSub(3), NOW)).toBe("trial_active");
    expect(trialDaysLeft(trialSub(3), NOW)).toBe(3);
    expect(accessState(trialSub(-0.001), NOW)).toBe("trial_expired");
    expect(hasPaidAccess(accessState(trialSub(-1), NOW))).toBe(false);
  });
  it("после окончания trial доступ к функциям закрывается", () => {
    expect(canUseFeature(trialSub(2), "assessments", NOW)).toBe(true);
    expect(canUseFeature(trialSub(-1), "assessments", NOW)).toBe(false);
    expect(canUseFeature(trialSub(-1), "export", NOW)).toBe(false);
  });
  it("подписка: активна до конца оплаченного периода, затем закончилась", () => {
    const sub = { planCode: "pro", status: "active", trialEndsAt: null, currentPeriodEnd: new Date(NOW.getTime() + day) };
    expect(accessState(sub, NOW)).toBe("active");
    expect(accessState({ ...sub, currentPeriodEnd: new Date(NOW.getTime() - day) }, NOW)).toBe("expired");
    expect(accessState({ ...sub, status: "canceled" }, NOW)).toBe("expired");
    expect(accessState(null, NOW)).toBe("expired");
  });
  it("функции тарифа: собственный справочник — с Профессионального, команда — с Команды", () => {
    expect(canUseFeature(trialSub(2, "basic"), "customDirectory", NOW)).toBe(false);
    expect(canUseFeature(trialSub(2, "pro"), "customDirectory", NOW)).toBe(true);
    expect(canUseFeature(trialSub(2, "pro"), "teamWorkspace", NOW)).toBe(false);
    expect(canUseFeature(trialSub(2, "team"), "teamWorkspace", NOW)).toBe(true);
  });
});

describe("лимит пользователей", () => {
  it("Базовый: второго пользователя добавить нельзя", () => {
    expect(canAddMember("basic", 0).ok).toBe(true);
    const r = canAddMember("basic", 1);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.upgrade).toBe("team");
  });
  it("Профессиональный: тоже один пользователь", () => {
    expect(canAddMember("pro", 1).ok).toBe(false);
  });
  it("Команда: до 5 пользователей, шестой — предложение Корпоративного", () => {
    for (let n = 1; n < 5; n++) expect(canAddMember("team", n).ok).toBe(true);
    const r = canAddMember("team", 5);
    expect(r).toEqual({ ok: false, message: LIMIT_MESSAGE_TEAM, upgrade: "corporate" });
    expect(LIMIT_MESSAGE_TEAM).toBe("В вашем тарифе доступно до 5 пользователей. Чтобы добавить больше участников, перейдите на Корпоративный тариф.");
  });
  it("Корпоративный: без ограничения", () => {
    expect(canAddMember("corporate", 500).ok).toBe(true);
  });
  it("подписи «Участники: N из M»", () => {
    expect(membersLabel("team", 4)).toBe("Участники: 4 из 5");
    expect(membersLabel("basic", 1)).toBe("Участники: 1 из 1");
    expect(membersLabel("corporate", 12)).toBe("Участники: без ограничений");
  });
  it("смена тарифа: Корпоративный — только по согласованию; меньший лимит — если участников не больше", () => {
    expect(canChangePlan("corporate", 1).ok).toBe(false);
    expect(canChangePlan("basic", 3).ok).toBe(false);
    expect(canChangePlan("team", 3).ok).toBe(true);
  });
});

describe("роли", () => {
  it("владелец — тариф и участники; администратор — участники; участник — ничего", () => {
    expect(can("owner", "manageBilling")).toBe(true);
    expect(can("owner", "manageMembers")).toBe(true);
    expect(can("admin", "manageBilling")).toBe(false);
    expect(can("admin", "manageMembers")).toBe(true);
    expect(can("admin", "assignAdmin")).toBe(false);
    expect(can("member", "manageMembers")).toBe(false);
    expect(can("member", "deleteAnyAssessment")).toBe(false);
    expect(can("hacker", "manageMembers")).toBe(false);
  });
});

describe("приглашение", () => {
  const inv = { status: "pending", expiresAt: new Date(NOW.getTime() + day), email: "Colleague@Example.ru" };
  it("действующее приглашение для своего email принимается", () => {
    expect(invitationProblem(inv, "colleague@example.ru", NOW)).toBeNull();
  });
  it("просроченное, принятое, отозванное, чужое — нет", () => {
    expect(invitationProblem({ ...inv, expiresAt: new Date(NOW.getTime() - 1) }, "colleague@example.ru", NOW)).toMatch(/истёк/);
    expect(invitationProblem({ ...inv, status: "accepted" }, "colleague@example.ru", NOW)).toMatch(/уже принято/);
    expect(invitationProblem({ ...inv, status: "revoked" }, "colleague@example.ru", NOW)).toMatch(/отозвано/);
    expect(invitationProblem(inv, "other@example.ru", NOW)).toMatch(/Войдите под этим адресом/);
    expect(invitationProblem(null, "x@y.ru", NOW)).toMatch(/не найдено/);
  });
});
