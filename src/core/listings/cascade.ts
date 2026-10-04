// Каскадный поиск аналогов: сначала строгие условия, затем — автоматическое и видимое ослабление.
//
// Уровни условий (по важности):
//   1 — населённый пункт и улица;
//   2 — тип объекта (квартира), количество комнат, площадь;
//   3 — этаж, этажность, материал стен, состояние (отделка), расстояние до объекта.
// Ослабляются в обратном порядке: сначала уровень 3, затем улица, затем уровень 2.
// Условия уровня 3 применяются на нашей стороне к полученной выборке — их ослабление не требует
// повторного запроса к поставщику. Значение «нет данных» у объявления условию не противоречит.
// После фильтрации объявления ранжируются по сходству с объектом оценки.

import { distanceM } from "../geo";
import { applyLocalFilters, type LocalFilterStats, type RankedListing } from "./filter";
import type { ListingQuery, ListingWithRaw } from "./model";

export const ZERO_FOUND_MESSAGE = "По заданным параметрам найдено 0 объектов. Расширяем поиск.";

export type Fetcher = (q: ListingQuery) => Promise<{ count: number | null; items: ListingWithRaw[] }>;

export interface CascadeStep {
  /** Что запрошено / применено на шаге. */
  label: string;
  /** Ослабленные на шаге условия (пусто — первый, строгий шаг). */
  relaxed: string[];
  /** Получено от поставщика (null — шаг без нового запроса). */
  received: number | null;
  /** Осталось после условий шага. */
  kept: number;
}

export interface CascadeResult {
  items: RankedListing[];
  stats: LocalFilterStats;
  total: number | null;
  steps: CascadeStep[];
  /** Все ослабленные условия по порядку. */
  relaxed: string[];
  /** Сообщение для интерфейса (если поиск расширялся). */
  message: string | null;
  /** Итоговый уровень: какие условия действовали для итоговой выборки. */
  applied: string[];
}

/** Характеристики объекта оценки для ранжирования. */
export interface SubjectForRanking {
  rooms: number | null;
  area: number | null;
  floor: number | null;
  floors: number | null;
  wallMaterial: string | null;
  finishing: string | null;
}

const fmtR = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км` : `${m} м`);

/** Условия уровня 3, заданные в запросе. */
export function level3Conditions(q: ListingQuery): string[] {
  const out: string[] = [];
  if (q.floorMin != null || q.floorMax != null) out.push("этаж");
  if (q.floorsMin != null || q.floorsMax != null) out.push("этажность");
  if (q.wallMaterials?.length) out.push("материал стен");
  if (q.finishings?.length) out.push("состояние (отделка)");
  if (q.center && q.radiusM) out.push(`расстояние ≤ ${fmtR(q.radiusM)}`);
  return out;
}

function level2Conditions(q: ListingQuery): string[] {
  const out: string[] = [];
  if (q.rooms?.length) out.push("комнаты");
  if (q.areaMin != null || q.areaMax != null) out.push("площадь");
  return out;
}

const within = (v: number | null, min: number | null | undefined, max: number | null | undefined) =>
  v === null || ((min == null || v >= min) && (max == null || v <= max));

/** Условия уровня 3 на нашей стороне. Нет данных у объявления — условие не нарушено. */
export function passesLevel3(l: ListingWithRaw, q: ListingQuery): boolean {
  if (!within(l.floor, q.floorMin, q.floorMax)) return false;
  if (!within(l.floors, q.floorsMin, q.floorsMax)) return false;
  if (q.wallMaterials?.length && l.wallMaterial !== null && !q.wallMaterials.includes(l.wallMaterial)) return false;
  if (q.finishings?.length && l.finishing !== null && !q.finishings.includes(l.finishing)) return false;
  if (q.center && q.radiusM && l.lat !== null && l.lon !== null && distanceM(q.center, { lat: l.lat, lon: l.lon }) > q.radiusM) return false;
  return true;
}

const floorClass = (floor: number | null, floors: number | null) => (floor === null ? null : floor === 1 ? "first" : floors !== null && floor === floors ? "last" : "middle");

/** Штраф несходства с объектом (меньше — ближе). Нет данных — умеренный штраф. */
export function similarityPenalty(l: RankedListing, s: SubjectForRanking): number {
  let p = 0;
  const UNKNOWN = 0.5;
  p += l.distanceM === null ? 1.5 : Math.min(l.distanceM / 1000, 5);
  if (s.rooms !== null) p += l.rooms === null ? UNKNOWN : Math.min(Math.abs(l.rooms - s.rooms), 3);
  if (s.area) p += l.area === null ? UNKNOWN : Math.min(Math.abs(l.area - s.area) / s.area / 0.1, 3);
  const sc = floorClass(s.floor, s.floors);
  if (sc) {
    const lc = floorClass(l.floor, l.floors);
    p += lc === null ? UNKNOWN : lc === sc ? 0 : 1;
  }
  if (s.floors) p += l.floors === null ? UNKNOWN : Math.min(Math.abs(l.floors - s.floors) / 5, 2);
  if (s.wallMaterial) p += l.wallMaterial === null ? UNKNOWN : l.wallMaterial === s.wallMaterial ? 0 : 1;
  if (s.finishing) p += l.finishing === null ? UNKNOWN : l.finishing === s.finishing ? 0 : 0.7;
  return Math.round(p * 1000) / 1000;
}

export function rankBySimilarity(items: RankedListing[], s: SubjectForRanking): RankedListing[] {
  return items
    .map((l) => ({ l, p: similarityPenalty(l, s) }))
    .sort((a, b) => a.p - b.p || String(b.l.publishedAt ?? "").localeCompare(String(a.l.publishedAt ?? "")))
    .map((x) => x.l);
}

/** Название улицы без типа («Тверская улица», «ул. Тверская» → «Тверская») — для текстового поиска по адресу. */
export function streetQuery(street: string): string {
  const t = street
    .replace(/(^|[\s,])(улица|ул\.?|проспект|пр-т\.?|просп\.?|переулок|пер\.?|бульвар|б-р\.?|шоссе|ш\.?|площадь|пл\.?|набережная|наб\.?|проезд|пр\.?|тупик|аллея|линия)(?=[\s,]|$)/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t || street.trim();
}

/** Запрос к поставщику без условий уровня 3 (они применяются локально). */
function apiQuery(q: ListingQuery, opts: { street: boolean; level2: boolean }): ListingQuery {
  const text = [opts.street && q.street ? streetQuery(q.street) : null, q.q].filter(Boolean).join(" ") || null;
  return {
    ...q,
    q: text,
    street: null,
    rooms: opts.level2 ? q.rooms : [],
    areaMin: opts.level2 ? q.areaMin : null,
    areaMax: opts.level2 ? q.areaMax : null,
    floorMin: null, floorMax: null, floorsMin: null, floorsMax: null,
    wallMaterials: [], finishings: [],
    radiusM: null,
  };
}

export async function cascadeSearch(q: ListingQuery, subject: SubjectForRanking, fetch: Fetcher, minResults = 3): Promise<CascadeResult> {
  const steps: CascadeStep[] = [];
  const relaxed: string[] = [];
  const l3 = level3Conditions(q);
  const l2 = level2Conditions(q);
  const city = q.locality || q.region || "населённый пункт не указан";
  const street = q.street?.trim() || null;

  // этапы запросов к поставщику: город+улица+ур.2 → город+улица → город+ур.2 → город
  const plan: Array<{ street: boolean; level2: boolean; relax: string[] }> = [];
  if (street) {
    plan.push({ street: true, level2: true, relax: [] });
    if (l2.length) plan.push({ street: true, level2: false, relax: l2 });
    plan.push({ street: false, level2: true, relax: [`улица «${street}»`] });
  } else plan.push({ street: false, level2: true, relax: [] });
  if (l2.length) plan.push({ street: false, level2: false, relax: l2 });

  let last: { items: RankedListing[]; stats: LocalFilterStats; total: number | null; applied: string[] } | null = null;
  const seenRelax = new Set<string>();
  const addRelax = (xs: string[]) => xs.forEach((x) => !seenRelax.has(x) && (seenRelax.add(x), relaxed.push(x)));

  for (const stage of plan) {
    if (stage.relax.length) addRelax(stage.relax);
    const aq = apiQuery(q, stage);
    const { count, items } = await fetch(aq);
    const applied = [`город: ${city}`, ...(stage.street && street ? [`улица: ${street}`] : []), ...(stage.level2 ? l2 : [])];
    const label = applied.join(", ");

    // строгий уровень 3, затем без него (без нового запроса)
    const strict = items.filter((l) => passesLevel3(l, q));
    const tryLocal = (list: ListingWithRaw[]) => applyLocalFilters(list, { ...q, radiusM: null });
    const s = tryLocal(strict);
    steps.push({ label: l3.length ? `${label} + ${l3.join(", ")}` : label, relaxed: stage.relax, received: items.length, kept: s.items.length });
    if (s.items.length >= minResults) {
      last = { ...s, total: count, applied: [...applied, ...l3] };
      break;
    }
    if (l3.length) {
      const loose = tryLocal(items);
      addRelax(l3);
      steps.push({ label, relaxed: l3, received: null, kept: loose.items.length });
      if (loose.items.length >= minResults) {
        last = { ...loose, total: count, applied };
        break;
      }
      if (!last || loose.items.length > last.items.length) last = { ...loose, total: count, applied };
    } else if (!last || s.items.length > last.items.length) last = { ...s, total: count, applied };
  }

  const final = last ?? { items: [], stats: { received: 0, kept: 0, noCoords: 0, tooFar: 0, unitPrice: 0, furniture: 0 }, total: null, applied: [] };
  // кандидаты дальше радиуса не отбрасывались при ослаблении — но число «дальше радиуса» полезно в статистике
  if (q.center && q.radiusM) final.stats = { ...final.stats, tooFar: final.items.filter((l) => l.distanceM !== null && l.distanceM > q.radiusM!).length };
  const firstEmpty = steps.length > 0 && steps[0].kept === 0;
  // ослаблено итогово: условия строгого запроса, которых нет в итоговой выборке (история — в steps)
  const strict = [...(street ? [`улица «${street}»`] : []), ...l2, ...l3];
  const finalRelaxed = final.items.length ? strict.filter((c) => !final.applied.includes(c) && !(c.startsWith("улица") && final.applied.some((a) => a.startsWith("улица")))) : relaxed;
  return {
    items: rankBySimilarity(final.items, subject),
    stats: final.stats,
    total: final.total,
    steps,
    relaxed: finalRelaxed,
    applied: final.applied,
    message: finalRelaxed.length ? `${firstEmpty ? ZERO_FOUND_MESSAGE : `По заданным параметрам найдено меньше ${minResults} объектов. Поиск расширен.`} Ослаблены условия: ${finalRelaxed.join("; ")}.` : null,
  };
}
