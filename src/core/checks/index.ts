// Автоматический контроль согласованности оценки.
// Ошибки (error) блокируют формирование отчёта, предупреждения (warning) — нет.

import { d, round } from "../calc/decimal";
import { calculate, CalcError } from "../calc/engine";
import type { CalcInput, CalcResult } from "../calc/types";
import { fmtDate, fmtNumber, fmtPercent } from "../format";
import type { AssessmentSnapshot } from "../snapshot";

export type Severity = "error" | "warning" | "info";

export interface CheckIssue {
  code: string;
  severity: Severity;
  section: "assignment" | "property" | "appraiser" | "comparables" | "adjustments" | "calculation" | "text";
  message: string;
  /** Путь к полю для перехода из интерфейса. */
  field?: string;
}

export const CADASTRAL_RE = /\b\d{2}:\d{2}:\d{6,7}:\d{1,6}\b/g;
const CADASTRAL_STRICT = /^\d{2}:\d{2}:\d{6,7}:\d{1,6}$/;
const DATE_RE = /\b(\d{2})\.(\d{2})\.(\d{4})\b/g;
const AREA_RE = /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:кв\.?\s*м|м²|м2)/gi;

/** Входные данные расчёта из снимка (только включённые аналоги). */
export function calcInputFromSnapshot(s: AssessmentSnapshot): CalcInput {
  return {
    subjectArea: s.property.area ?? "0",
    settings: s.settings,
    comparables: s.comparables
      .filter((c) => c.included)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        label: c.label,
        price: c.price,
        area: c.area,
        adjustments: c.adjustments.map((a) => ({
          code: a.factorCode,
          name: a.factorName,
          value: a.value,
          stage: a.stage,
          order: a.sortOrder,
        })),
      })),
  };
}

const sameDay = (a: string | null, b: string | null) => !!a && !!b && a.slice(0, 10) === b.slice(0, 10);
const daysBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;

function normalizeAddress(a: string): string {
  return a
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\b(г|ул|д|кв|пр-т|просп|пер|корп|к|стр|обл|р-н)\.?(?=\s|,|$)/g, "")
    .replace(/[^a-zа-я0-9]+/g, "");
}

function requireField(issues: CheckIssue[], value: unknown, section: CheckIssue["section"], field: string, label: string) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    issues.push({ code: "REQUIRED", severity: "error", section, field, message: `Не заполнено обязательное поле: ${label}` });
  }
}

export interface CheckOptions {
  /** Сохранённый результат расчёта (из версии), сверяется с пересчётом. */
  storedResult?: CalcResult | null;
  /** Дата формирования отчёта (по умолчанию — reportDate или сегодня). */
  now?: string;
  /** Максимальный возраст предложения аналога относительно даты оценки, дней. */
  maxOfferAgeDays?: number;
}

export interface CheckReport {
  issues: CheckIssue[];
  errors: number;
  warnings: number;
  canGenerate: boolean;
  result: CalcResult | null;
}

export function runChecks(s: AssessmentSnapshot, opts: CheckOptions = {}): CheckReport {
  const issues: CheckIssue[] = [];
  const a = s.assessment;
  const p = s.property;
  const maxAge = opts.maxOfferAgeDays ?? 183;

  // 1. Обязательные поля задания
  requireField(issues, a.customerName, "assignment", "customerName", "Заказчик");
  requireField(issues, a.basis, "assignment", "basis", "Основание для проведения оценки");
  requireField(issues, a.contractNumber, "assignment", "contractNumber", "Номер договора");
  requireField(issues, a.contractDate, "assignment", "contractDate", "Дата договора");
  requireField(issues, a.purpose, "assignment", "purpose", "Цель оценки");
  requireField(issues, a.valueType, "assignment", "valueType", "Вид стоимости");
  requireField(issues, a.rightsAssessed, "assignment", "rightsAssessed", "Оцениваемые права");
  requireField(issues, a.valuationDate, "assignment", "valuationDate", "Дата оценки");
  requireField(issues, a.reportDate, "assignment", "reportDate", "Дата составления отчёта");

  // 2. Объект
  requireField(issues, p.address, "property", "address", "Адрес объекта");
  requireField(issues, p.cadastralNumber, "property", "cadastralNumber", "Кадастровый номер");
  requireField(issues, p.area, "property", "area", "Общая площадь");
  requireField(issues, p.floor, "property", "floor", "Этаж");
  requireField(issues, s.building.floors, "property", "building.floors", "Этажность дома");
  requireField(issues, p.rooms, "property", "rooms", "Количество комнат");
  requireField(issues, s.building.wallMaterial, "property", "building.wallMaterial", "Материал стен");

  if (p.cadastralNumber && !CADASTRAL_STRICT.test(p.cadastralNumber.trim())) {
    issues.push({ code: "CADASTRAL_FORMAT", severity: "error", section: "property", field: "cadastralNumber", message: `Некорректный формат кадастрового номера: ${p.cadastralNumber}` });
  }
  if (p.floor && s.building.floors && p.floor > s.building.floors) {
    issues.push({ code: "FLOOR_GT_FLOORS", severity: "error", section: "property", field: "floor", message: `Этаж (${p.floor}) больше этажности дома (${s.building.floors})` });
  }
  if (p.area && p.livingArea && d(p.livingArea).gt(p.area)) {
    issues.push({ code: "LIVING_GT_TOTAL", severity: "error", section: "property", field: "livingArea", message: "Жилая площадь больше общей" });
  }

  // 3. Сверка с выписками ЕГРН и иными источниками
  for (const src of s.sources) {
    const ex = (src.extracted ?? {}) as Record<string, unknown>;
    const label = `${src.title} (${fmtDate(src.retrievedAt)})`;
    if (typeof ex.cadastralNumber === "string" && p.cadastralNumber && ex.cadastralNumber.trim() !== p.cadastralNumber.trim()) {
      issues.push({ code: "CADASTRAL_MISMATCH", severity: "error", section: "property", field: "cadastralNumber", message: `Кадастровый номер ${p.cadastralNumber} не совпадает с источником «${label}»: ${ex.cadastralNumber}` });
    }
    if (ex.area !== undefined && ex.area !== null && p.area && !d(String(ex.area)).eq(d(p.area))) {
      issues.push({ code: "AREA_MISMATCH", severity: "error", section: "property", field: "area", message: `Площадь ${fmtNumber(p.area)} м² не совпадает с источником «${label}»: ${fmtNumber(String(ex.area))} м²` });
    }
    if (typeof ex.address === "string" && p.address && normalizeAddress(ex.address) !== normalizeAddress(p.address)) {
      issues.push({ code: "ADDRESS_MISMATCH", severity: "warning", section: "property", field: "address", message: `Адрес объекта отличается от адреса в источнике «${label}»: «${ex.address}»` });
    }
    if (typeof ex.floor === "number" && p.floor && ex.floor !== p.floor) {
      issues.push({ code: "FLOOR_MISMATCH", severity: "error", section: "property", field: "floor", message: `Этаж ${p.floor} не совпадает с источником «${label}»: ${ex.floor}` });
    }
  }

  // 4. Даты
  if (a.valuationDate) {
    if (a.inspectionDate && daysBetween(a.inspectionDate, a.valuationDate) < 0) {
      issues.push({ code: "INSPECTION_AFTER_VALUATION", severity: "warning", section: "assignment", field: "inspectionDate", message: `Дата осмотра (${fmtDate(a.inspectionDate)}) позже даты оценки (${fmtDate(a.valuationDate)})` });
    }
    if (a.reportDate && daysBetween(a.valuationDate, a.reportDate) < 0) {
      issues.push({ code: "REPORT_BEFORE_VALUATION", severity: "error", section: "assignment", field: "reportDate", message: `Дата составления отчёта (${fmtDate(a.reportDate)}) раньше даты оценки (${fmtDate(a.valuationDate)})` });
    }
    if (a.contractDate && daysBetween(a.contractDate, a.valuationDate) < -366) {
      issues.push({ code: "CONTRACT_DATE", severity: "warning", section: "assignment", field: "contractDate", message: "Дата договора более чем на год позже даты оценки — проверьте даты" });
    }
  }

  // 5. Оценщик
  const ap = s.appraiser;
  if (!ap) {
    issues.push({ code: "APPRAISER_MISSING", severity: "error", section: "appraiser", message: "Не заполнен профиль оценщика" });
  } else {
    requireField(issues, ap.fullName, "appraiser", "fullName", "ФИО оценщика");
    requireField(issues, ap.sroName, "appraiser", "sroName", "СРО оценщика");
    requireField(issues, ap.sroRegistryNumber, "appraiser", "sroRegistryNumber", "Номер в реестре СРО");
    requireField(issues, ap.qualificationCertNumber, "appraiser", "qualificationCertNumber", "Квалификационный аттестат");
    requireField(issues, ap.insurancePolicyNumber, "appraiser", "insurancePolicyNumber", "Полис страхования ответственности");
    const ref = a.valuationDate ?? opts.now ?? null;
    const reportRef = a.reportDate ?? opts.now ?? null;
    const docs: Array<[string | null, string]> = [
      [ap.qualificationCertValidUntil, "Квалификационный аттестат"],
      [ap.insuranceValidUntil, "Полис страхования оценщика"],
      [ap.legalEntityInsuranceValidUntil, "Полис страхования юридического лица"],
    ];
    for (const [until, label] of docs) {
      if (!until) continue;
      if (ref && daysBetween(until, ref) > 0) {
        issues.push({ code: "DOC_EXPIRED", severity: "error", section: "appraiser", message: `${label} истёк ${fmtDate(until)} — до даты оценки ${fmtDate(ref)}` });
      } else if (reportRef && daysBetween(until, reportRef) > 0) {
        issues.push({ code: "DOC_EXPIRED_REPORT", severity: "error", section: "appraiser", message: `${label} истёк ${fmtDate(until)} — до даты составления отчёта` });
      } else if (reportRef && daysBetween(reportRef, until) < 30) {
        issues.push({ code: "DOC_EXPIRING", severity: "warning", section: "appraiser", message: `${label} истекает ${fmtDate(until)}` });
      }
    }
    if (ap.insuranceValidFrom && ref && daysBetween(ref, ap.insuranceValidFrom) > 0) {
      issues.push({ code: "INSURANCE_NOT_STARTED", severity: "error", section: "appraiser", message: `Полис страхования начинает действовать ${fmtDate(ap.insuranceValidFrom)} — позже даты оценки` });
    }
  }

  // 6. Аналоги
  const included = s.comparables.filter((c) => c.included);
  if (included.length < 3) {
    issues.push({ code: "FEW_COMPARABLES", severity: included.length === 0 ? "error" : "warning", section: "comparables", message: `Включено аналогов: ${included.length}. Рекомендуется не менее трёх` });
  }
  const seen = new Map<string, string>();
  for (const c of included) {
    if (!c.sourceUrl && c.sourceKind !== "user_import") {
      issues.push({ code: "COMPARABLE_NO_SOURCE", severity: "error", section: "comparables", field: `comparable.${c.id}.sourceUrl`, message: `${c.label}: не указана ссылка на источник` });
    }
    if (!c.retrievedAt) {
      issues.push({ code: "COMPARABLE_NO_DATE", severity: "error", section: "comparables", field: `comparable.${c.id}.retrievedAt`, message: `${c.label}: не указана дата получения данных` });
    }
    if (!c.address) {
      issues.push({ code: "COMPARABLE_NO_ADDRESS", severity: "error", section: "comparables", message: `${c.label}: не указан адрес` });
    }
    if (!c.screenshotFileId) {
      issues.push({ code: "COMPARABLE_NO_SCREENSHOT", severity: "warning", section: "comparables", message: `${c.label}: нет скриншота объявления для приложения` });
    }
    const offer = c.offerDate ?? c.retrievedAt;
    if (offer && a.valuationDate) {
      const age = daysBetween(offer, a.valuationDate);
      if (age < -1) {
        issues.push({ code: "COMPARABLE_AFTER_VALUATION", severity: "warning", section: "comparables", message: `${c.label}: дата предложения ${fmtDate(offer)} позже даты оценки ${fmtDate(a.valuationDate)} — обоснуйте использование` });
      } else if (age > maxAge) {
        issues.push({ code: "COMPARABLE_STALE", severity: "warning", section: "comparables", message: `${c.label}: предложение старше ${maxAge} дней на дату оценки` });
      }
    }
    if (c.floor && c.floors && c.floor > c.floors) {
      issues.push({ code: "COMPARABLE_FLOOR", severity: "error", section: "comparables", message: `${c.label}: этаж больше этажности` });
    }
    const key = c.sourceUrl ? `url:${c.sourceUrl.trim()}` : `obj:${normalizeAddress(c.address ?? "")}|${c.area}|${c.price}`;
    if (seen.has(key)) {
      issues.push({ code: "COMPARABLE_DUPLICATE", severity: "warning", section: "comparables", message: `${c.label} дублирует ${seen.get(key)}` });
    } else seen.set(key, c.label);
    if (p.cadastralNumber && c.description?.includes(p.cadastralNumber)) {
      issues.push({ code: "COMPARABLE_IS_SUBJECT", severity: "warning", section: "comparables", message: `${c.label}: в описании указан кадастровый номер объекта оценки` });
    }
  }

  // 7. Корректировки
  for (const c of included) {
    for (const adj of c.adjustments) {
      const name = `${c.label} / ${adj.factorName}`;
      if (adj.overridden && !adj.comment?.trim()) {
        issues.push({ code: "ADJ_NO_COMMENT", severity: "error", section: "adjustments", field: `adjustment.${adj.id}`, message: `${name}: значение изменено вручную без обоснования` });
      }
      if (adj.suggestedValue === null && !adj.overridden && !d(adj.value).isZero()) {
        // неопределённая корректировка, введённая без обоснования
        issues.push({ code: "ADJ_NO_BASIS", severity: "warning", section: "adjustments", message: `${name}: значение не подтверждено справочником` });
      }
      if (adj.suggestedValue === null && !adj.overridden && d(adj.value).isZero() && adj.ruleSnapshot && (adj.ruleSnapshot as { factor?: { kind?: string } }).factor?.kind === "category") {
        issues.push({ code: "ADJ_NOT_DETERMINED", severity: "warning", section: "adjustments", message: `${name}: не хватает данных для расчёта корректировки (принят 0)` });
      }
      const v = d(adj.value);
      if ((adj.minValue !== null && v.lt(adj.minValue)) || (adj.maxValue !== null && v.gt(adj.maxValue))) {
        issues.push({ code: "ADJ_OUT_OF_RANGE", severity: "warning", section: "adjustments", message: `${name}: ${fmtPercent(adj.value)} вне диапазона справочника [${adj.minValue !== null ? fmtPercent(adj.minValue) : "−∞"}; ${adj.maxValue !== null ? fmtPercent(adj.maxValue) : "+∞"}]` });
      }
      const rs = adj.ruleSnapshot as { edition?: string; sourceCode?: string } | null;
      if (rs && s.directory && (rs.edition !== s.directory.edition || rs.sourceCode !== s.directory.code)) {
        issues.push({ code: "ADJ_EDITION_MIXED", severity: "warning", section: "adjustments", message: `${name}: корректировка получена из другой редакции справочника (${rs.sourceCode} ${rs.edition}) — обновите предложения` });
      }
    }
  }
  if (s.directory?.isDemo) {
    issues.push({ code: "DIRECTORY_DEMO", severity: "warning", section: "adjustments", message: `Используется демонстрационный справочник «${s.directory.name}» — значения не подтверждены источником, требуется проверка оценщиком` });
  }

  // 8. Остатки текста от другого объекта: чужие кадастровые номера, даты, площади в свободном тексте
  const texts: Array<[string, string | null]> = [
    ["Допущения", a.assumptions],
    ["Ограничения", a.limitingConditions],
    ["Описание объекта", p.description],
    ["Описание здания", s.building.description],
    ["Обременения", p.encumbrances],
    ["Основание", a.basis],
    ["Цель оценки", a.purpose],
    ["Предполагаемое использование", a.intendedUse],
  ];
  const allowedCad = new Set([p.cadastralNumber?.trim(), s.building.cadastralNumber?.trim()].filter(Boolean) as string[]);
  const allowedDates = new Set(
    [a.valuationDate, a.inspectionDate, a.reportDate, a.contractDate].filter(Boolean).map((x) => fmtDate(x)),
  );
  for (const [label, text] of texts) {
    if (!text) continue;
    for (const m of text.matchAll(CADASTRAL_RE)) {
      if (!allowedCad.has(m[0])) {
        issues.push({ code: "TEXT_FOREIGN_CADASTRAL", severity: "error", section: "text", message: `«${label}»: упомянут кадастровый номер ${m[0]}, не совпадающий с объектом оценки — возможно, остаток текста другого отчёта` });
      }
    }
    for (const m of text.matchAll(/дат[аеуы]\s+оценки[^0-9]{0,40}(\d{2}\.\d{2}\.\d{4})/gi)) {
      if (a.valuationDate && m[1] !== fmtDate(a.valuationDate)) {
        issues.push({ code: "TEXT_FOREIGN_VALUATION_DATE", severity: "error", section: "text", message: `«${label}»: указана дата оценки ${m[1]}, а в задании — ${fmtDate(a.valuationDate)}` });
      }
    }
    for (const m of text.matchAll(DATE_RE)) {
      const y = Number(m[3]);
      const vy = a.valuationDate ? new Date(a.valuationDate).getUTCFullYear() : null;
      if (vy && Math.abs(y - vy) >= 2 && !allowedDates.has(m[0])) {
        issues.push({ code: "TEXT_SUSPICIOUS_DATE", severity: "warning", section: "text", message: `«${label}»: дата ${m[0]} далека от даты оценки — проверьте актуальность текста` });
      }
    }
    if (label.startsWith("Описание объекта") || label === "Допущения") {
      for (const m of text.matchAll(AREA_RE)) {
        const val = m[1].replace(",", ".");
        const known = [p.area, p.livingArea, p.kitchenArea].filter(Boolean).map((x) => d(x!).toString());
        if (p.area && !known.includes(d(val).toString())) {
          issues.push({ code: "TEXT_FOREIGN_AREA", severity: "warning", section: "text", message: `«${label}»: указана площадь ${m[1]} м², не совпадающая с площадями объекта` });
        }
      }
    }
  }

  // 9. Расчёт
  let result: CalcResult | null = null;
  try {
    if (included.length > 0 && p.area) {
      result = calculate(calcInputFromSnapshot(s));
    }
  } catch (e) {
    if (e instanceof CalcError) {
      issues.push({ code: "CALC_ERROR", severity: "error", section: "calculation", message: e.message });
    } else throw e;
  }
  if (result) {
    if (!d(result.weightsSum).eq(1)) {
      issues.push({ code: "WEIGHTS_SUM", severity: "error", section: "calculation", message: `Сумма весов ${result.weightsSum} ≠ 1` });
    }
    const sumContrib = result.comparables.reduce((acc, c) => acc.plus(c.contribution), d(0));
    if (!sumContrib.eq(result.weightedUnitPrice)) {
      issues.push({ code: "WEIGHTED_MISMATCH", severity: "error", section: "calculation", message: "Сумма вкладов аналогов не равна средневзвешенной цене" });
    }
    for (const c of result.comparables) {
      let cur = d(c.unitPrice);
      for (const st of c.steps) {
        if (!cur.eq(st.before) || !cur.plus(st.delta).eq(st.after)) {
          issues.push({ code: "CHAIN_MISMATCH", severity: "error", section: "calculation", message: `${c.label}: цепочка корректировок не сходится на шаге «${st.name}»` });
        }
        cur = d(st.after);
      }
      if (!cur.eq(c.adjustedUnitPrice)) {
        issues.push({ code: "CHAIN_TOTAL", severity: "error", section: "calculation", message: `${c.label}: итог цепочки не равен скорректированной цене` });
      }
    }
    // итог = цена за м² × площадь (с точностью до шага округления)
    const step = d(s.settings.roundingStep || "0");
    const tolerance = step.gt(0) ? step.div(2) : d("0.01");
    const recomputed = d(result.finalUnitPrice).mul(result.subjectArea);
    if (recomputed.minus(result.finalValue).abs().gt(tolerance.plus(d(result.subjectArea).mul("0.005")))) {
      issues.push({ code: "TOTAL_MISMATCH", severity: "error", section: "calculation", message: `Итог ${fmtNumber(result.finalValue)} ≠ цена за м² × площадь (${fmtNumber(recomputed)})` });
    }
    if (!round(d(result.weightedUnitPrice).mul(result.subjectArea), 2).eq(result.rawValue)) {
      issues.push({ code: "RAW_MISMATCH", severity: "error", section: "calculation", message: "Стоимость до округления ≠ средневзвешенная цена × площадь" });
    }
    if (p.area && !d(result.subjectArea).eq(round(p.area, 2))) {
      issues.push({ code: "AREA_CALC_MISMATCH", severity: "error", section: "calculation", message: "Площадь в расчёте не совпадает с площадью объекта" });
    }
    for (const w of result.warnings) {
      issues.push({ code: "CALC_WARNING", severity: "warning", section: "calculation", message: w });
    }
    if (opts.storedResult) {
      if (JSON.stringify(opts.storedResult) !== JSON.stringify(result)) {
        issues.push({ code: "STORED_RESULT_MISMATCH", severity: "error", section: "calculation", message: "Сохранённый результат расчёта не совпадает с пересчётом по тем же данным — версия расчёта недостоверна" });
      }
    }
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  return { issues, errors, warnings, canGenerate: errors === 0 && !!result, result };
}

export const sameDate = sameDay;
