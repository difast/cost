// Аналитика по аналогам пользователя. Чистые функции — без БД, детерминированно, с тестами.

import { d, round, type Dec } from "./calc/decimal";

export interface AnalyticsRow {
  id: string;
  assessmentId: string;
  assessmentNumber: string;
  address: string | null;
  sourceName: string | null;
  /** Дата предложения или, если её нет, дата получения данных (ISO). */
  date: string | null;
  price: string;
  area: string;
  rooms: number | null;
  included: boolean;
  /** Из последней зафиксированной версии расчёта, если аналог в неё попал. */
  adjustedUnitPrice: string | null;
  totalChange: string | null;
}

export interface Stats {
  count: number;
  mean: string | null;
  median: string | null;
  min: string | null;
  max: string | null;
  p25: string | null;
  p75: string | null;
}

export const unitPrice = (r: Pick<AnalyticsRow, "price" | "area">): Dec => d(r.price).div(r.area);

function quantile(sorted: Dec[], q: number): Dec {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo].plus(sorted[hi].minus(sorted[lo]).mul(pos - lo));
}

export function stats(values: Dec[]): Stats {
  if (!values.length) return { count: 0, mean: null, median: null, min: null, max: null, p25: null, p75: null };
  const s = [...values].sort((a, b) => a.comparedTo(b));
  const f = (x: Dec) => round(x, 2).toFixed(2);
  return {
    count: s.length,
    mean: f(s.reduce((a, b) => a.plus(b), d(0)).div(s.length)),
    median: f(quantile(s, 0.5)),
    min: f(s[0]),
    max: f(s[s.length - 1]),
    p25: f(quantile(s, 0.25)),
    p75: f(quantile(s, 0.75)),
  };
}

/** Регион/город по адресу: первая часть до запятой без «г.», «город», «обл.». */
export function regionOf(address: string | null): string {
  if (!address) return "Не указан";
  const first = address.split(",")[0].trim();
  const cleaned = first.replace(/^(г\.|город|гор\.)\s*/i, "").trim();
  return cleaned || "Не указан";
}

export const monthKey = (iso: string) => iso.slice(0, 7);

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const names = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${names[m - 1]} ${y}`;
}

export interface MonthPoint { month: string; count: number; median: string; mean: string }

/** Динамика: медиана и среднее цены 1 м² по месяцам (месяцы без данных пропускаются). */
export function monthly(rows: AnalyticsRow[]): MonthPoint[] {
  const by = new Map<string, Dec[]>();
  for (const r of rows) {
    if (!r.date) continue;
    const k = monthKey(r.date);
    by.set(k, [...(by.get(k) ?? []), unitPrice(r)]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => {
      const s = stats(v);
      return { month, count: s.count, median: s.median!, mean: s.mean! };
    });
}

export interface GroupStat extends Stats { key: string }

export function groupBy(rows: AnalyticsRow[], keyOf: (r: AnalyticsRow) => string): GroupStat[] {
  const by = new Map<string, Dec[]>();
  for (const r of rows) {
    const k = keyOf(r);
    by.set(k, [...(by.get(k) ?? []), unitPrice(r)]);
  }
  return [...by.entries()].map(([key, v]) => ({ key, ...stats(v) })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "ru"));
}

export interface Bin { from: string; to: string; count: number }

/** Гистограмма распределения цены 1 м² с «круглой» шириной интервала. */
export function histogram(values: Dec[], target = 8): Bin[] {
  if (!values.length) return [];
  const s = [...values].sort((a, b) => a.comparedTo(b));
  const min = s[0], max = s[s.length - 1];
  const span = max.minus(min);
  if (span.isZero()) return [{ from: min.toFixed(0), to: max.toFixed(0), count: s.length }];
  const raw = span.div(target).toNumber();
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((x) => x >= raw) ?? 10 * mag;
  const start = Math.floor(min.toNumber() / step) * step;
  const bins: Bin[] = [];
  for (let from = start; from <= max.toNumber(); from += step) {
    const to = from + step;
    const count = s.filter((v) => v.gte(from) && (v.lt(to) || (to > max.toNumber() && v.lte(to)))).length;
    bins.push({ from: String(from), to: String(to), count });
  }
  return bins;
}

export interface PeriodComparison { a: Stats; b: Stats; medianChange: string | null; meanChange: string | null }

export function comparePeriods(rows: AnalyticsRow[], a: [string, string], b: [string, string]): PeriodComparison {
  const pick = ([from, to]: [string, string]) => rows.filter((r) => r.date && r.date.slice(0, 10) >= from && r.date.slice(0, 10) <= to).map(unitPrice);
  const sa = stats(pick(a));
  const sb = stats(pick(b));
  const ch = (x: string | null, y: string | null) => (x && y && !d(x).isZero() ? round(d(y).div(x).minus(1), 4).toString() : null);
  return { a: sa, b: sb, medianChange: ch(sa.median, sb.median), meanChange: ch(sa.mean, sb.mean) };
}

// ───────── Демонстрационные данные (детерминированные, никогда не сохраняются)

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function demoRows(today = "2026-10-01"): AnalyticsRow[] {
  const rnd = prng(20261001);
  const regions: Array<[string, number]> = [["г. Москва", 228000], ["г. Санкт-Петербург", 176000], ["г. Казань", 138000], ["г. Екатеринбург", 129000]];
  const sources = ["ЦИАН", "Авито", "Домклик"];
  const rows: AnalyticsRow[] = [];
  const end = new Date(`${today}T00:00:00Z`);
  for (let i = 0; i < 160; i++) {
    const [city, base] = regions[Math.floor(rnd() * regions.length)];
    const monthsAgo = Math.floor(rnd() * 12);
    const dt = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - monthsAgo, 1 + Math.floor(rnd() * 27)));
    const trend = 1 + (11 - monthsAgo) * 0.006;
    const rooms = 1 + Math.floor(rnd() * 3);
    const area = 30 + rooms * 14 + Math.round(rnd() * 12);
    const unit = base * trend * (0.86 + rnd() * 0.28) * (rooms === 1 ? 1.06 : 1);
    rows.push({
      id: `demo-${i}`,
      assessmentId: `demo-a-${i % 9}`,
      assessmentNumber: `Д-${String((i % 9) + 1).padStart(3, "0")}`,
      address: `${city}, демонстрационный адрес ${i + 1}`,
      sourceName: sources[Math.floor(rnd() * sources.length)],
      date: dt.toISOString(),
      price: String(Math.round((unit * area) / 1000) * 1000),
      area: String(area),
      rooms,
      included: rnd() > 0.15,
      adjustedUnitPrice: null,
      totalChange: String(round(-0.04 - rnd() * 0.08, 4)),
    });
  }
  return rows;
}
