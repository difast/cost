// Каталог проверок для интерфейса: группирует коды, которые выдаёт runChecks,
// в именованные пункты контроля качества. Логика проверок здесь не меняется —
// пункт считается пройденным, если по его кодам нет замечаний.

import type { CheckIssue } from "./index";

export type Step = "assignment" | "property" | "comparables" | "adjustments" | "calculation" | "appraiser";
export type ItemStatus = "passed" | "warning" | "error" | "pending";

export interface CatalogItem {
  id: string;
  title: string;
  /** Что проверяется — показывается как причина при замечании. */
  hint: string;
  step: Step;
  codes: string[];
  /** Для общего кода REQUIRED — раздел, к которому относится пункт. */
  section?: CheckIssue["section"];
  /** Пункт имеет смысл только при наличии расчёта. */
  needsResult?: boolean;
}

export const CHECK_CATALOG: CatalogItem[] = [
  { id: "assignment_required", step: "assignment", title: "Задание на оценку заполнено", hint: "Заказчик, договор, цель, вид стоимости, права и даты обязательны для отчёта", codes: ["REQUIRED"], section: "assignment" },
  { id: "dates", step: "assignment", title: "Даты оценки, осмотра и отчёта согласованы", hint: "Дата отчёта не раньше даты оценки, осмотр не позже даты оценки", codes: ["INSPECTION_AFTER_VALUATION", "REPORT_BEFORE_VALUATION", "CONTRACT_DATE"] },
  { id: "property_required", step: "property", title: "Характеристики объекта заполнены", hint: "Адрес, кадастровый номер, площадь, этаж, этажность, комнаты и материал стен", codes: ["REQUIRED", "FLOOR_GT_FLOORS", "LIVING_GT_TOTAL"], section: "property" },
  { id: "cadastral", step: "property", title: "Кадастровый номер соответствует объекту", hint: "Формат номера и совпадение с выпиской ЕГРН", codes: ["CADASTRAL_FORMAT", "CADASTRAL_MISMATCH"] },
  { id: "area", step: "property", title: "Площадь объекта согласована", hint: "Площадь в карточке, в выписке ЕГРН и в расчёте совпадает", codes: ["AREA_MISMATCH", "AREA_CALC_MISMATCH"] },
  { id: "address_floor", step: "property", title: "Адрес и этаж совпадают с выпиской", hint: "Сверка карточки объекта с загруженной выпиской ЕГРН", codes: ["ADDRESS_MISMATCH", "FLOOR_MISMATCH"] },
  { id: "texts", step: "assignment", title: "В текстах нет данных другого объекта", hint: "Чужие кадастровые номера, даты оценки и площади в допущениях и описаниях", codes: ["TEXT_FOREIGN_CADASTRAL", "TEXT_FOREIGN_VALUATION_DATE", "TEXT_SUSPICIOUS_DATE", "TEXT_FOREIGN_AREA"] },
  { id: "appraiser_profile", step: "appraiser", title: "Профиль оценщика заполнен", hint: "ФИО, СРО, номер в реестре, аттестат и полис", codes: ["APPRAISER_MISSING", "REQUIRED"], section: "appraiser" },
  { id: "appraiser_docs", step: "appraiser", title: "Документы оценщика действуют", hint: "Аттестат и полисы действуют на дату оценки и дату отчёта", codes: ["DOC_EXPIRED", "DOC_EXPIRED_REPORT", "DOC_EXPIRING", "INSURANCE_NOT_STARTED"] },
  { id: "comparables_count", step: "comparables", title: "Достаточно аналогов", hint: "В расчёт включено не менее трёх аналогов", codes: ["FEW_COMPARABLES"] },
  { id: "comparables_sources", step: "comparables", title: "У аналогов есть источник, дата и адрес", hint: "Каждая цифра расчёта должна иметь источник", codes: ["COMPARABLE_NO_SOURCE", "COMPARABLE_NO_DATE", "COMPARABLE_NO_ADDRESS"] },
  { id: "comparables_screens", step: "comparables", title: "Скриншоты объявлений приложены", hint: "Скриншоты попадают в приложение к отчёту", codes: ["COMPARABLE_NO_SCREENSHOT"] },
  { id: "comparables_dates", step: "comparables", title: "Предложения актуальны на дату оценки", hint: "Дата предложения не позже даты оценки и не старше шести месяцев", codes: ["COMPARABLE_AFTER_VALUATION", "COMPARABLE_STALE"] },
  { id: "comparables_quality", step: "comparables", title: "Аналоги корректны и не дублируются", hint: "Этаж не больше этажности, нет повторов и самого объекта оценки", codes: ["COMPARABLE_FLOOR", "COMPARABLE_DUPLICATE", "COMPARABLE_IS_SUBJECT", "COMPARABLE_IN_REVIEW"] },
  { id: "adj_justified", step: "adjustments", title: "Ручные корректировки обоснованы", hint: "Изменение значения справочника требует обоснования", codes: ["ADJ_NO_COMMENT", "ADJ_NO_BASIS", "ADJ_NOT_REQUIRED_NO_REASON", "ADJ_NOT_REQUIRED_VALUE"] },
  { id: "adj_sign", step: "adjustments", title: "Знак корректировок соответствует сравнению", hint: "Аналог хуже объекта — корректировка положительная, лучше — отрицательная", codes: ["ADJ_SIGN"] },
  { id: "adj_data", step: "adjustments", title: "Корректировки рассчитаны по актуальным характеристикам", hint: "Значения в расчёте совпадают с карточками объекта и аналога; после ручной правки характеристики не менялись", codes: ["ADJ_VALUE_MISMATCH", "ADJ_BASIS_CHANGED"] },
  { id: "adj_range", step: "adjustments", title: "Корректировки в пределах справочника", hint: "Значения не выходят за диапазон и рассчитаны по данным", codes: ["ADJ_OUT_OF_RANGE", "ADJ_NOT_DETERMINED", "ADJ_LARGE"] },
  { id: "directory", step: "adjustments", title: "Справочник корректировок подтверждён", hint: "Используется одна редакция; демонстрационный справочник требует проверки", codes: ["ADJ_EDITION_MIXED", "DIRECTORY_DEMO"] },
  { id: "calc_chain", step: "calculation", title: "Цепочка корректировок сходится", hint: "Каждый шаг: цена до + изменение = цена после", codes: ["CALC_ERROR", "CHAIN_MISMATCH", "CHAIN_TOTAL", "STORED_RESULT_MISMATCH"], needsResult: true },
  { id: "weights", step: "calculation", title: "Веса аналогов сходятся", hint: "Сумма весов равна 1, сумма вкладов равна средневзвешенной цене", codes: ["WEIGHTS_SUM", "WEIGHTED_MISMATCH"], needsResult: true },
  { id: "total", step: "calculation", title: "Итог = цена за м² × площадь", hint: "Итоговая стоимость согласована с ценой за м² и площадью", codes: ["TOTAL_MISMATCH", "RAW_MISMATCH"], needsResult: true },
  { id: "sample", step: "calculation", title: "Выборка однородна", hint: "Коэффициент вариации и суммарные корректировки в допустимых пределах", codes: ["CALC_WARNING"], needsResult: true },
  { id: "dispersion", step: "calculation", title: "Корректировки не увеличивают разброс цен", hint: "Коэффициент вариации скорректированных цен не выше, чем у исходных", codes: ["DISPERSION_GROWTH"], needsResult: true },
];

export interface ChecklistItem extends CatalogItem {
  status: ItemStatus;
  issues: CheckIssue[];
}

export interface Checklist {
  items: ChecklistItem[];
  passed: number;
  warnings: number;
  errors: number;
  pending: number;
  total: number;
  /** Замечания, которые не попали ни в один пункт каталога (страховка от новых кодов). */
  other: CheckIssue[];
}

function matches(item: CatalogItem, issue: CheckIssue) {
  if (!item.codes.includes(issue.code)) return false;
  if (issue.code === "REQUIRED") return item.section === issue.section;
  return true;
}

export function buildChecklist(issues: CheckIssue[], hasResult: boolean): Checklist {
  const used = new Set<CheckIssue>();
  const items: ChecklistItem[] = CHECK_CATALOG.map((item) => {
    const mine = issues.filter((i) => matches(item, i));
    mine.forEach((i) => used.add(i));
    let status: ItemStatus = "passed";
    if (mine.some((i) => i.severity === "error")) status = "error";
    else if (mine.some((i) => i.severity === "warning")) status = "warning";
    else if (item.needsResult && !hasResult) status = "pending";
    return { ...item, status, issues: mine };
  });
  const count = (s: ItemStatus) => items.filter((i) => i.status === s).length;
  return {
    items,
    passed: count("passed"),
    warnings: count("warning"),
    errors: count("error"),
    pending: count("pending"),
    total: items.length,
    other: issues.filter((i) => !used.has(i)),
  };
}
