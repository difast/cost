// Куда ведёт замечание: вкладка оценки (или внешняя страница) и поле для подсветки.
// Чистая функция — используется «Контролем качества», списками замечаний этапов и тестами.

import type { CheckIssue } from "./index";

export type TargetTab = "assignment" | "property" | "comparables" | "adjustments" | "calculation" | "checks" | "report";

export interface IssueTarget {
  /** Вкладка оценки; null — переход на другую страницу (href). */
  tab: TargetTab | null;
  href?: string;
  /** Путь поля (data-field) для подсветки; может отсутствовать — тогда открывается раздел. */
  field?: string;
  /** Название раздела-источника для списка. */
  source: string;
}

const GO_LABEL: Record<string, string> = {
  assignment: "Перейти к заданию", property: "Перейти к объекту", comparables: "Перейти к аналогам", adjustments: "Перейти к корректировкам",
  calculation: "Перейти к расчёту", report: "Перейти к отчёту", checks: "Перейти",
};

/** Подпись кнопки перехода: «Перейти к заданию», «Перейти к профилю оценщика»… */
export const goLabel = (t: IssueTarget) => (t.tab ? GO_LABEL[t.tab] : "Перейти к профилю оценщика");

/** Тексты, которые редактируются в карточке объекта (остальные — в задании). */
const PROPERTY_TEXTS = new Set(["description", "building.description", "encumbrances"]);

export function issueTarget(i: Pick<CheckIssue, "section" | "field">): IssueTarget {
  const f = i.field;
  if (f?.startsWith("comparable.")) return { tab: "comparables", field: f, source: "Аналоги" };
  if (f?.startsWith("adjustment.")) return { tab: "adjustments", field: f, source: "Корректировки" };
  switch (i.section) {
    case "assignment": return { tab: "assignment", field: f, source: "Задание" };
    case "property": return { tab: "property", field: f, source: "Объект" };
    case "text": return PROPERTY_TEXTS.has(f ?? "") ? { tab: "property", field: f, source: "Объект · тексты" } : { tab: "assignment", field: f, source: "Задание · тексты" };
    case "appraiser": return { tab: null, href: "/app/profile", field: f, source: "Профиль оценщика" };
    case "comparables": return { tab: "comparables", field: f, source: "Аналоги" };
    case "adjustments": return { tab: "adjustments", field: f, source: "Корректировки" };
    case "calculation": return { tab: "calculation", field: f, source: "Расчёт" };
    case "report": return { tab: "report", field: f, source: "Отчёт" };
    default: return { tab: "checks", source: "Проверки" };
  }
}

/** Кандидаты селектора для поля: точное поле, затем его «владелец» (карточка аналога и т. п.). */
export function fieldCandidates(field: string): string[] {
  const out = [field];
  const m = field.match(/^(comparable|adjustment)\.([^.]+)\./);
  if (m) out.push(`${m[1]}.${m[2]}`);
  return out;
}
