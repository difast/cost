// Сравнение «объект оценки ↔ аналог» по характеристикам.
// Каждая строка связана с факторами справочника по признаку (attribute) или типу фактора,
// поэтому новые факторы попадают в нужную строку без изменения кода сравнения.
// Отсутствующие данные не додумываются — «Нет данных».

import { FINISHING, FLOOR_CATEGORY, HOUSE_CONDITION, WALL_MATERIALS, floorCategory } from "../adjustments/attributes";
import { fmtDate, fmtNumber } from "../format";

export const NO_DATA = "Нет данных";

export interface CompareSubject {
  address: string | null;
  district: string | null;
  area: string | null;
  rooms: number | null;
  floor: number | null;
  floors: number | null;
  wallMaterial: string | null;
  yearBuilt: number | null;
  finishing: string | null;
  houseCondition: string | null;
  furniture: boolean | null;
  metroName: string | null;
  metroDistanceM: number | null;
  rights: string | null;
  valuationDate: string | null;
}

export interface CompareComparable {
  address: string | null;
  district: string | null;
  area: string;
  rooms: number | null;
  floor: number | null;
  floors: number | null;
  wallMaterial: string | null;
  houseType: string | null;
  yearBuilt: number | null;
  finishing: string | null;
  houseCondition: string | null;
  furniture: boolean | null;
  metroDistanceM: number | null;
  rights: string | null;
  offerDate: string | null;
  distanceM: number | null;
  /** Данные источника, которых нет в карточке: станция и минуты до метро. */
  metroName?: string | null;
  metroMinutes?: number | null;
  metroMode?: string | null;
}

export interface CompareRow {
  key: string;
  label: string;
  subject: string;
  comparable: string;
  /** Описание разницы; "=" — совпадает; "" — сравнить нельзя. */
  diff: string;
  /** Отличается ли характеристика (для подсветки). null — нет данных для сравнения. */
  differs: boolean | null;
  /** Признаки справочника, к которым относится строка. */
  attributes: string[];
  /** Коды и типы факторов, к которым относится строка (если признака нет). */
  factorCodes: string[];
  factorKinds: string[];
}

const nd = (v: unknown) => (v === null || v === undefined || v === "" ? NO_DATA : String(v));
const lbl = (dict: Record<string, string>, v: string | null) => (v ? dict[v] ?? v : NO_DATA);
const yesNo = (v: boolean | null) => (v === true ? "Есть" : v === false ? "Нет" : NO_DATA);

function numDiff(a: number | null, b: number | null, unit = "", dp = 0): { diff: string; differs: boolean | null } {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return { diff: "", differs: null };
  const delta = b - a;
  if (delta === 0) return { diff: "=", differs: false };
  const pct = a !== 0 ? ` (${delta > 0 ? "+" : "−"}${fmtNumber(Math.abs(delta / a) * 100, 1, true)} %)` : "";
  return { diff: `${delta > 0 ? "+" : "−"}${fmtNumber(Math.abs(delta), dp, true)}${unit}${pct}`, differs: true };
}

function textDiff(a: string, b: string): { diff: string; differs: boolean | null } {
  if (a === NO_DATA || b === NO_DATA) return { diff: "", differs: null };
  return a === b ? { diff: "=", differs: false } : { diff: "отличается", differs: true };
}

const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

export function compareWithSubject(s: CompareSubject, c: CompareComparable): CompareRow[] {
  const rows: CompareRow[] = [];
  const add = (r: Omit<CompareRow, "attributes" | "factorCodes" | "factorKinds"> & Partial<Pick<CompareRow, "attributes" | "factorCodes" | "factorKinds">>) =>
    rows.push({ attributes: [], factorCodes: [], factorKinds: [], ...r });

  const sArea = s.area !== null ? Number(s.area) : null;
  const cArea = Number(c.area);
  add({ key: "area", label: "Общая площадь", subject: sArea !== null ? `${fmtNumber(sArea, 2, true)} м²` : NO_DATA, comparable: `${fmtNumber(cArea, 2, true)} м²`, ...numDiff(sArea, cArea, " м²", 2), attributes: ["area"], factorCodes: ["area"] });
  add({ key: "rooms", label: "Количество комнат", subject: nd(s.rooms), comparable: nd(c.rooms), ...numDiff(s.rooms, c.rooms), attributes: ["rooms"] });

  const sfc = floorCategory(s.floor, s.floors);
  const cfc = floorCategory(c.floor, c.floors);
  const floorD = !sfc || !cfc ? { diff: "", differs: null } : sfc === cfc ? { diff: `= ${FLOOR_CATEGORY[sfc].toLowerCase()}`, differs: false } : { diff: `${FLOOR_CATEGORY[sfc].toLowerCase()} → ${FLOOR_CATEGORY[cfc].toLowerCase()}`, differs: true };
  add({ key: "floor", label: "Этаж", subject: nd(s.floor), comparable: nd(c.floor), ...floorD, attributes: ["floor_category"] });
  add({ key: "floors", label: "Этажность дома", subject: nd(s.floors), comparable: nd(c.floors), ...numDiff(s.floors, c.floors) });

  const sw = lbl(WALL_MATERIALS, s.wallMaterial), cw = lbl(WALL_MATERIALS, c.wallMaterial);
  add({ key: "wall", label: "Материал стен", subject: sw, comparable: cw, ...textDiff(sw, cw), attributes: ["wall_material"] });
  add({ key: "house_type", label: "Тип дома (по данным источника)", subject: sw, comparable: nd(c.houseType), diff: "", differs: null });
  add({ key: "year", label: "Год постройки", subject: nd(s.yearBuilt), comparable: nd(c.yearBuilt), ...numDiff(s.yearBuilt, c.yearBuilt) });

  const sf = lbl(FINISHING, s.finishing), cf = lbl(FINISHING, c.finishing);
  add({ key: "finishing", label: "Отделка", subject: sf, comparable: cf, ...textDiff(sf, cf), attributes: ["finishing"] });
  const sh = lbl(HOUSE_CONDITION, s.houseCondition), ch = lbl(HOUSE_CONDITION, c.houseCondition);
  add({ key: "condition", label: "Состояние дома", subject: sh, comparable: ch, ...textDiff(sh, ch), attributes: ["house_condition"] });
  const sm = yesNo(s.furniture), cm = yesNo(c.furniture);
  add({ key: "furniture", label: "Мебель", subject: sm, comparable: cm, ...textDiff(sm, cm), attributes: ["furniture"] });

  const sd = s.district ?? null, cd = c.district ?? null;
  add({
    key: "location", label: "Местоположение", subject: nd(sd ?? s.address), comparable: nd(cd ?? c.address),
    ...(sd && cd ? (sd === cd ? { diff: "тот же район", differs: false } : { diff: "другой район", differs: true }) : { diff: "", differs: null }),
    factorCodes: ["location"],
  });
  add({ key: "distance", label: "Расстояние до объекта оценки", subject: "—", comparable: c.distanceM !== null ? `${fmtNumber(c.distanceM, 0)} м` : NO_DATA, diff: "", differs: null });

  const metroSrc = c.metroMinutes !== null && c.metroMinutes !== undefined ? `${c.metroName ? `${c.metroName}, ` : ""}${c.metroMinutes} мин ${c.metroMode === "transport" ? "транспортом" : "пешком"} (по объявлению)` : null;
  add({
    key: "transport", label: "Транспортная доступность (до метро)",
    subject: s.metroDistanceM !== null ? `${fmtNumber(s.metroDistanceM, 0)} м${s.metroName ? ` · ${s.metroName}` : ""}` : NO_DATA,
    comparable: c.metroDistanceM !== null ? `${fmtNumber(c.metroDistanceM, 0)} м${metroSrc ? ` · ${metroSrc}` : ""}` : metroSrc ?? NO_DATA,
    ...numDiff(s.metroDistanceM, c.metroDistanceM, " м"),
    attributes: ["metro_distance"],
  });

  const offer = c.offerDate;
  add({
    key: "date", label: "Дата предложения", subject: s.valuationDate ? `оценка ${fmtDate(s.valuationDate)}` : NO_DATA, comparable: offer ? fmtDate(offer) : NO_DATA,
    ...(offer && s.valuationDate ? { diff: `${Math.abs(daysBetween(offer, s.valuationDate))} дн. ${daysBetween(offer, s.valuationDate) >= 0 ? "до" : "после"} даты оценки`, differs: daysBetween(offer, s.valuationDate) !== 0 } : { diff: "", differs: null }),
    factorCodes: ["market_conditions"],
  });
  add({ key: "bargain", label: "Условия сделки (торг)", subject: "Сделка", comparable: "Предложение", diff: "цена предложения", differs: true, factorKinds: ["discount"] });
  const sr = nd(s.rights), cr = nd(c.rights);
  add({ key: "rights", label: "Передаваемые права", subject: sr, comparable: cr, ...textDiff(sr, cr), attributes: ["rights"] });
  return rows;
}

/** Строка сравнения, к которой относится корректировка (по признаку, коду или типу фактора). */
export function rowForAdjustment(rows: CompareRow[], adj: { factorCode: string; ruleSnapshot: object | null }): CompareRow | null {
  const f = (adj.ruleSnapshot as { factor?: { attribute?: string | null; kind?: string } } | null)?.factor;
  return (
    (f?.attribute ? rows.find((r) => r.attributes.includes(f.attribute!)) : undefined) ??
    rows.find((r) => r.factorCodes.includes(adj.factorCode)) ??
    (f?.kind ? rows.find((r) => r.factorKinds.includes(f.kind!)) : undefined) ??
    null
  );
}
