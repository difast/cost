// Тарифы, ограничения, пробный период и права ролей — единый источник правил.
// Чистые функции: используются сервером (проверки), интерфейсом (отображение) и тестами.
// Чтобы изменить ограничения тарифа, достаточно поправить PLANS — бизнес-логика не меняется.

export type PlanCode = "basic" | "pro" | "team" | "corporate";
export type Role = "owner" | "admin" | "member";

/** Функции продукта, которые могут различаться по тарифам. */
export type Feature =
  | "assessments" // создание и ведение оценок
  | "egrn" // объект и выписка ЕГРН
  | "comparables" // аналоги
  | "adjustments" // корректировки
  | "calculation" // расчёт
  | "quality" // контроль качества
  | "reports" // отчёты
  | "export" // экспорт DOCX / PDF / XLSX
  | "customDirectory" // собственные редакции справочника корректировок
  | "commercialSources" // коммерческие источники данных — заложено на будущее, пока не реализовано
  | "teamWorkspace"; // общее рабочее пространство и приглашения

export const CORE_FEATURES: Feature[] = ["assessments", "egrn", "comparables", "adjustments", "calculation", "quality", "reports", "export"];

export interface PlanDef {
  code: PlanCode;
  name: string;
  /** Цена в месяц, ₽ (для «Корпоративного» — «от»). */
  priceRub: number;
  priceFrom?: boolean;
  /** Максимум пользователей; null — без ограничений. */
  maxMembers: number | null;
  features: Feature[];
  /** Можно ли выбрать тариф самостоятельно (без согласования). */
  selfServe: boolean;
}

export const PLANS: Record<PlanCode, PlanDef> = {
  basic: { code: "basic", name: "Базовый", priceRub: 1990, maxMembers: 1, features: [...CORE_FEATURES], selfServe: true },
  pro: { code: "pro", name: "Профессиональный", priceRub: 4990, maxMembers: 1, features: [...CORE_FEATURES, "customDirectory", "commercialSources"], selfServe: true },
  team: { code: "team", name: "Команда", priceRub: 9990, maxMembers: 5, features: [...CORE_FEATURES, "customDirectory", "commercialSources", "teamWorkspace"], selfServe: true },
  corporate: { code: "corporate", name: "Корпоративный", priceRub: 19990, priceFrom: true, maxMembers: null, features: [...CORE_FEATURES, "customDirectory", "commercialSources", "teamWorkspace"], selfServe: false },
};
export const PLAN_ORDER: PlanCode[] = ["basic", "pro", "team", "corporate"];
export const DEFAULT_PLAN: PlanCode = "basic";
export const TRIAL_DAYS = 7;
export const INVITATION_TTL_DAYS = 7;
export const CONTACT_EMAIL = "info@evmo.ru";

export const isPlanCode = (v: unknown): v is PlanCode => typeof v === "string" && v in PLANS;
export const plan = (code: string | null | undefined): PlanDef => PLANS[isPlanCode(code) ? code : DEFAULT_PLAN];
export const planLimits = (code: string) => ({ maxMembers: plan(code).maxMembers });
export const formatPrice = (p: PlanDef) => `${p.priceFrom ? "от " : ""}${p.priceRub.toLocaleString("ru-RU").replace(/ /g, " ")} ₽/мес.`;

/* ───────── Подписка и пробный период ───────── */

export interface SubscriptionLike {
  planCode: string;
  status: string; // trialing | active | past_due | canceled | expired
  trialEndsAt: Date | string | null;
  currentPeriodEnd: Date | string | null;
}

/** Состояние доступа, вычисляемое на сервере по датам из БД. */
export type AccessState = "trial_active" | "trial_expired" | "active" | "expired";

const ts = (d: Date | string | null) => (d === null ? null : new Date(d).getTime());

export function accessState(sub: SubscriptionLike | null, now = new Date()): AccessState {
  if (!sub) return "expired";
  const t = now.getTime();
  if (sub.status === "trialing") {
    const end = ts(sub.trialEndsAt);
    return end !== null && t < end ? "trial_active" : "trial_expired";
  }
  if (sub.status === "active") {
    const end = ts(sub.currentPeriodEnd);
    return end === null || t < end ? "active" : "expired";
  }
  return "expired";
}

/** Есть ли доступ к платному функционалу (создание и изменение данных, экспорт). */
export const hasPaidAccess = (state: AccessState) => state === "trial_active" || state === "active";

export const ACCESS_LABEL: Record<AccessState, string> = {
  trial_active: "Пробный период",
  trial_expired: "Пробный период завершён",
  active: "Подписка активна",
  expired: "Подписка закончилась",
};

export function trialDaysLeft(sub: SubscriptionLike | null, now = new Date()): number | null {
  if (!sub || sub.status !== "trialing" || !sub.trialEndsAt) return null;
  return Math.max(0, Math.ceil((ts(sub.trialEndsAt)! - now.getTime()) / 86_400_000));
}

/** Даты нового пробного периода. */
export function newTrial(now = new Date()) {
  return { status: "trialing" as const, trialStartsAt: now, trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86_400_000) };
}

/** Можно ли использовать функцию: функция входит в тариф и есть платный доступ. */
export function canUseFeature(sub: SubscriptionLike | null, feature: Feature, now = new Date()): boolean {
  if (!sub) return false;
  return plan(sub.planCode).features.includes(feature) && hasPaidAccess(accessState(sub, now));
}

/* ───────── Участники ───────── */

export const LIMIT_MESSAGE_TEAM = "В вашем тарифе доступно до 5 пользователей. Чтобы добавить больше участников, перейдите на Корпоративный тариф.";

/** Можно ли добавить ещё одного участника (учитываются участники и неистёкшие приглашения). */
export function canAddMember(planCode: string, occupied: number): { ok: true } | { ok: false; message: string; upgrade: PlanCode | null } {
  const max = plan(planCode).maxMembers;
  if (max === null || occupied < max) return { ok: true };
  if (planCode === "team") return { ok: false, message: LIMIT_MESSAGE_TEAM, upgrade: "corporate" };
  return {
    ok: false,
    message: `В тарифе «${plan(planCode).name}» доступен ${max} пользователь. Для работы командой перейдите на тариф «Команда» (до 5 пользователей).`,
    upgrade: "team",
  };
}

export const membersLabel = (planCode: string, used: number) => {
  const max = plan(planCode).maxMembers;
  return max === null ? "Участники: без ограничений" : `Участники: ${used} из ${max}`;
};

/* ───────── Роли ───────── */

export type Permission = "manageBilling" | "manageMembers" | "assignAdmin" | "editWorkspace" | "deleteAnyAssessment";

const MATRIX: Record<Role, Permission[]> = {
  owner: ["manageBilling", "manageMembers", "assignAdmin", "editWorkspace", "deleteAnyAssessment"],
  admin: ["manageMembers", "editWorkspace", "deleteAnyAssessment"],
  member: [],
};
export const ROLE_LABEL: Record<Role, string> = { owner: "Владелец", admin: "Администратор", member: "Участник" };
export const isRole = (v: unknown): v is Role => v === "owner" || v === "admin" || v === "member";
export const can = (role: string, p: Permission) => isRole(role) && MATRIX[role].includes(p);

/** Можно ли перейти на тариф: самостоятельный выбор и текущее число участников укладывается в лимит. */
export function canChangePlan(to: string, members: number): { ok: true } | { ok: false; message: string } {
  if (!isPlanCode(to)) return { ok: false, message: "Неизвестный тариф" };
  const p = PLANS[to];
  if (!p.selfServe) return { ok: false, message: `Подключение тарифа «${p.name}» согласовывается индивидуально — напишите на ${CONTACT_EMAIL}` };
  if (p.maxMembers !== null && members > p.maxMembers) return { ok: false, message: `В рабочем пространстве ${members} участников, а в тарифе «${p.name}» доступно ${p.maxMembers}. Сначала уберите лишних участников.` };
  return { ok: true };
}

/* ───────── Приглашения ───────── */

export interface InvitationLike { status: string; expiresAt: Date | string; email: string }

/** Проверка приглашения при принятии. */
export function invitationProblem(inv: InvitationLike | null, userEmail: string, now = new Date()): string | null {
  if (!inv) return "Приглашение не найдено";
  if (inv.status === "accepted") return "Приглашение уже принято";
  if (inv.status === "revoked") return "Приглашение отозвано";
  if (new Date(inv.expiresAt).getTime() <= now.getTime()) return "Срок действия приглашения истёк — попросите администратора отправить новое";
  if (inv.email.trim().toLowerCase() !== userEmail.trim().toLowerCase()) return `Приглашение отправлено на ${inv.email}. Войдите под этим адресом`;
  return null;
}
