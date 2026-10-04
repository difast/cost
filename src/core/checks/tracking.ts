// Статус «Исправлено» в контроле качества: замечание было в прошлой проверке и пропало после изменения данных.
// Чистая функция над сохранённым состоянием (Calculation.qualityState).

import type { CheckIssue, Severity } from "./index";

export interface TrackedIssue {
  code: string;
  severity: Severity;
  section: CheckIssue["section"];
  field?: string;
  message: string;
  firstSeenAt: string;
  fixedAt?: string;
}
export interface QualityState { items?: Record<string, TrackedIssue> }

export type QualityStatus = Severity | "fixed";
export interface QualityItem extends TrackedIssue { key: string; status: QualityStatus }

/** Исправленные замечания хранятся 14 дней. */
const KEEP_FIXED_MS = 14 * 24 * 3600 * 1000;

/** Ключ замечания: код + поле (или текст, если поля нет) — значения в тексте могут меняться. */
export const issueKey = (i: Pick<CheckIssue, "code" | "section" | "field" | "message">) => `${i.code}|${i.section}|${i.field ?? i.message}`;

export function trackIssues(prev: QualityState | null | undefined, issues: CheckIssue[], now = new Date()): { state: QualityState; items: QualityItem[]; changed: boolean } {
  const before = prev?.items ?? {};
  const items: Record<string, TrackedIssue> = {};
  const at = now.toISOString();
  for (const i of issues) {
    const key = issueKey(i);
    if (items[key]) continue;
    items[key] = { code: i.code, severity: i.severity, section: i.section, field: i.field, message: i.message, firstSeenAt: before[key]?.firstSeenAt ?? at };
  }
  for (const [key, old] of Object.entries(before)) {
    if (items[key]) continue;
    const fixedAt = old.fixedAt ?? at;
    if (now.getTime() - new Date(fixedAt).getTime() <= KEEP_FIXED_MS) items[key] = { ...old, fixedAt };
  }
  const state: QualityState = { items };
  const changed = JSON.stringify(Object.keys(items).sort().map((k) => [k, items[k].fixedAt ?? null, items[k].message])) !==
    JSON.stringify(Object.keys(before).sort().map((k) => [k, before[k].fixedAt ?? null, before[k].message]));
  const list: QualityItem[] = Object.entries(items).map(([key, t]) => ({ ...t, key, status: t.fixedAt ? "fixed" : t.severity }));
  const rank: Record<QualityStatus, number> = { error: 0, warning: 1, info: 2, fixed: 3 };
  list.sort((a, b) => rank[a.status] - rank[b.status]);
  return { state, items: list, changed };
}
