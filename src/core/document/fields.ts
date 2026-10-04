// Динамические поля и блоки документа. Значения берутся из снимка оценки и результата
// расчётного ядра — того же источника, что у интерфейса, проверок, DOCX, PDF и XLSX.

import { amountInWords, fmtDate, fmtNumber, fmtRub } from "../format";
import { WALL_MATERIALS } from "../adjustments/attributes";
import { WEIGHT_METHODS } from "../calc/weights";
import type { BuildContext } from "../report/builder";
import type { CalcResult } from "../calc/types";

/** Контекст документа: результат расчёта может отсутствовать (расчёт ещё не выполнен). */
export type DocContext = Omit<BuildContext, "result" | "versionNumber"> & { result: CalcResult | null; versionNumber: number | null };

const v = (x: unknown) => (x === null || x === undefined || x === "" ? null : String(x));

export interface FieldDef {
  key: string;
  label: string;
  group: "Отчёт" | "Задание" | "Объект" | "Оценщик" | "Расчёт";
  resolve: (c: DocContext) => string | null;
}

export const FIELDS: FieldDef[] = [
  { key: "REPORT_NUMBER", label: "Номер отчёта", group: "Отчёт", resolve: (c) => v(c.snapshot.assessment.number) },
  { key: "REPORT_DATE", label: "Дата составления отчёта", group: "Отчёт", resolve: (c) => (c.snapshot.assessment.reportDate ? fmtDate(c.snapshot.assessment.reportDate) : null) },
  { key: "VALUATION_DATE", label: "Дата оценки", group: "Задание", resolve: (c) => (c.snapshot.assessment.valuationDate ? fmtDate(c.snapshot.assessment.valuationDate) : null) },
  { key: "INSPECTION_DATE", label: "Дата осмотра", group: "Задание", resolve: (c) => (c.snapshot.assessment.inspectionDate ? fmtDate(c.snapshot.assessment.inspectionDate) : null) },
  { key: "CUSTOMER", label: "Заказчик", group: "Задание", resolve: (c) => v(c.snapshot.assessment.customerName) },
  { key: "CONTRACT", label: "Договор", group: "Задание", resolve: (c) => (c.snapshot.assessment.contractNumber ? `№ ${c.snapshot.assessment.contractNumber}${c.snapshot.assessment.contractDate ? ` от ${fmtDate(c.snapshot.assessment.contractDate)}` : ""}` : null) },
  { key: "PURPOSE", label: "Цель оценки", group: "Задание", resolve: (c) => v(c.snapshot.assessment.purpose) },
  { key: "INTENDED_USE", label: "Предполагаемое использование", group: "Задание", resolve: (c) => v(c.snapshot.assessment.intendedUse) },
  { key: "VALUE_TYPE", label: "Вид стоимости", group: "Задание", resolve: (c) => v(c.snapshot.assessment.valueType) },
  { key: "RIGHTS_ASSESSED", label: "Оцениваемые права", group: "Задание", resolve: (c) => v(c.snapshot.assessment.rightsAssessed) },
  { key: "ASSUMPTIONS", label: "Допущения", group: "Задание", resolve: (c) => v(c.snapshot.assessment.assumptions) },
  { key: "LIMITING_CONDITIONS", label: "Ограничения", group: "Задание", resolve: (c) => v(c.snapshot.assessment.limitingConditions) },
  { key: "OBJECT_TYPE", label: "Вид объекта", group: "Объект", resolve: (c) => v(c.snapshot.property.objectType) },
  { key: "OBJECT_ADDRESS", label: "Адрес объекта", group: "Объект", resolve: (c) => v(c.snapshot.property.address) },
  { key: "CADASTRAL_NUMBER", label: "Кадастровый номер", group: "Объект", resolve: (c) => v(c.snapshot.property.cadastralNumber) },
  { key: "OBJECT_AREA", label: "Общая площадь", group: "Объект", resolve: (c) => (c.snapshot.property.area ? `${fmtNumber(c.snapshot.property.area, 2, true)} м²` : null) },
  { key: "OBJECT_ROOMS", label: "Количество комнат", group: "Объект", resolve: (c) => v(c.snapshot.property.rooms) },
  { key: "OBJECT_FLOOR", label: "Этаж / этажность", group: "Объект", resolve: (c) => (c.snapshot.property.floor ? `${c.snapshot.property.floor} / ${c.snapshot.building.floors ?? "—"}` : null) },
  { key: "WALL_MATERIAL", label: "Материал стен", group: "Объект", resolve: (c) => (c.snapshot.building.wallMaterial ? WALL_MATERIALS[c.snapshot.building.wallMaterial] ?? c.snapshot.building.wallMaterial : null) },
  { key: "YEAR_BUILT", label: "Год постройки", group: "Объект", resolve: (c) => v(c.snapshot.building.yearBuilt) },
  { key: "DISTRICT", label: "Район", group: "Объект", resolve: (c) => v(c.snapshot.property.district) },
  { key: "APPRAISER_NAME", label: "Оценщик", group: "Оценщик", resolve: (c) => v(c.snapshot.appraiser?.fullName) },
  { key: "APPRAISER_SRO", label: "СРО оценщика", group: "Оценщик", resolve: (c) => v(c.snapshot.appraiser?.sroName) },
  { key: "COMPARABLES_COUNT", label: "Количество аналогов в расчёте", group: "Расчёт", resolve: (c) => (c.result ? String(c.result.comparables.length) : null) },
  { key: "WEIGHT_METHOD", label: "Метод весов", group: "Расчёт", resolve: (c) => (c.result ? `${WEIGHT_METHODS[c.result.settings.weightMethod].label.toLowerCase()} (${WEIGHT_METHODS[c.result.settings.weightMethod].formula})` : null) },
  { key: "WEIGHTED_UNIT_PRICE", label: "Средневзвешенная цена 1 м²", group: "Расчёт", resolve: (c) => (c.result ? fmtRub(c.result.weightedUnitPrice, 2) : null) },
  { key: "FINAL_UNIT_PRICE", label: "Итоговая цена 1 м²", group: "Расчёт", resolve: (c) => (c.result ? fmtRub(c.result.finalUnitPrice, 2) : null) },
  { key: "FINAL_VALUE", label: "Итоговая стоимость", group: "Расчёт", resolve: (c) => (c.result ? fmtRub(c.result.finalValue) : null) },
  { key: "FINAL_VALUE_WORDS", label: "Итоговая стоимость прописью", group: "Расчёт", resolve: (c) => (c.result ? amountInWords(c.result.finalValue) : null) },
  { key: "ROUNDING", label: "Округление", group: "Расчёт", resolve: (c) => (c.result ? c.result.finalValueFormula : null) },
  { key: "DIRECTORY", label: "Справочник корректировок", group: "Расчёт", resolve: (c) => (c.snapshot.directory ? `${c.snapshot.directory.name}, ред. ${c.snapshot.directory.edition}${c.snapshot.directory.isDemo ? " (демонстрационные значения)" : ""}` : null) },
];
export const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

export interface BlockDef {
  key: string;
  label: string;
  /** Встроенный блок генератора отчёта. */
  builtin: string;
  options?: Record<string, unknown>;
  /** Требует результата расчёта. */
  needsResult: boolean;
  /** Можно ли редактировать содержимое (таблицы, абзацы). */
  editable: boolean;
}

export const BLOCKS: BlockDef[] = [
  { key: "SUMMARY_TABLE", label: "Основные факты и выводы", builtin: "summaryTable", needsResult: true, editable: true },
  { key: "ASSIGNMENT_TABLE", label: "Задание на оценку", builtin: "assignmentTable", needsResult: false, editable: true },
  { key: "APPRAISER_TABLE", label: "Сведения об оценщике", builtin: "appraiserTable", needsResult: false, editable: true },
  { key: "OBJECT_TABLE", label: "Таблица объекта", builtin: "propertyTable", needsResult: false, editable: true },
  { key: "BUILDING_TABLE", label: "Характеристики здания", builtin: "buildingTable", needsResult: false, editable: true },
  { key: "RIGHTS_TABLE", label: "Правовые сведения", builtin: "rightsTable", needsResult: false, editable: true },
  { key: "LOCATION_TABLE", label: "Местоположение", builtin: "locationTable", options: { infrastructure: false }, needsResult: false, editable: true },
  { key: "ENVIRONMENT_TABLE", label: "Инфраструктура окружения", builtin: "environmentTable", needsResult: false, editable: true },
  { key: "MARKET_ANALYSIS", label: "Анализ рынка", builtin: "marketAnalysis", needsResult: true, editable: true },
  { key: "COMPARABLES_TABLE", label: "Таблица аналогов", builtin: "comparablesTable", needsResult: true, editable: true },
  { key: "COMPARISON_TABLE", label: "Сравнительный анализ (корректировки по шагам)", builtin: "adjustmentsTable", needsResult: true, editable: true },
  { key: "ADJUSTMENTS_TABLE", label: "Таблица корректировок", builtin: "adjustmentsDetail", needsResult: true, editable: true },
  { key: "ADJUSTMENT_RATIONALE", label: "Обоснование корректировок", builtin: "adjustmentRationale", needsResult: true, editable: true },
  { key: "CALCULATION_CHAIN", label: "Цепочка расчёта по аналогам", builtin: "calculationChain", needsResult: true, editable: false },
  { key: "CALCULATION_TABLE", label: "Таблица расчёта", builtin: "calculationTable", needsResult: true, editable: true },
  { key: "WEIGHTS_TABLE", label: "Весовые коэффициенты", builtin: "weightsTable", needsResult: true, editable: false },
  { key: "RESULT_TABLE", label: "Расчёт итоговой стоимости", builtin: "resultCalculation", needsResult: true, editable: false },
  { key: "QUALITY_TABLE", label: "Контроль расчёта", builtin: "qualityTable", needsResult: true, editable: false },
  { key: "FINAL_VALUE", label: "Итоговая стоимость", builtin: "finalValue", needsResult: true, editable: false },
  { key: "SIGNATURE", label: "Подпись оценщика", builtin: "signature", needsResult: false, editable: false },
  { key: "SOURCES_TABLE", label: "Источники информации", builtin: "sourcesTable", needsResult: true, editable: true },
  { key: "NORMATIVE_TABLE", label: "Нормативные документы", builtin: "normativeTable", needsResult: false, editable: true },
  { key: "CALC_META", label: "Сведения о версии расчёта", builtin: "calcMeta", needsResult: true, editable: false },
  { key: "APPENDIX_SCREENSHOTS", label: "Копии объявлений", builtin: "appendixScreenshots", needsResult: true, editable: false },
  { key: "APPENDIX_PHOTOS", label: "Фотографии объекта", builtin: "appendixPhotos", needsResult: false, editable: false },
  { key: "APPENDIX_DOCUMENTS", label: "Копии документов", builtin: "appendixDocuments", needsResult: false, editable: false },
];
export const BLOCK_BY_KEY = new Map(BLOCKS.map((b) => [b.key, b]));
