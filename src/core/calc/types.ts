// Типы расчётного ядра сравнительного подхода.
// Все числа на входе/выходе — строки (десятичная запись), чтобы исключить ошибки float.

export type AdjustmentMode =
  /** Все корректировки применяются последовательно (мультипликативно). */
  | "sequential"
  /** Корректировки 1-й группы (торг, права, условия рынка) — последовательно,
   *  2-й группы — суммируются и применяются одним множителем (1 + Σ). */
  | "staged";

export type WeightMethod =
  /** Равные веса 1/n. */
  | "equal"
  /** w_i ∝ 1 / (1 + Σ|корр_i|) — чем меньше суммарная корректировка, тем больше вес. */
  | "inverse_gross"
  /** w_i = (S − s_i) / ((n − 1)·S), где s_i = Σ|корр_i|, S = Σ s_i. */
  | "linear_gross"
  /** Веса заданы оценщиком. */
  | "manual";

export interface CalcSettings {
  adjustmentMode: AdjustmentMode;
  weightMethod: WeightMethod;
  /** Ручные веса (доли), ключ — id аналога. */
  manualWeights?: Record<string, string>;
  /** Шаг округления итоговой стоимости, ₽ (например, "1000"). 0 — без округления. */
  roundingStep: string;
  /** Знаков после запятой у весов (сумма весов всегда ровно 1). */
  weightDecimals: number;
  /** Порог коэффициента вариации (доля), выше — предупреждение об однородности выборки. */
  cvThreshold: string;
  /** Порог валовой (Σ|корр|) корректировки на аналог (доля). */
  grossAdjustmentThreshold: string;
}

export const DEFAULT_SETTINGS: CalcSettings = {
  adjustmentMode: "sequential",
  weightMethod: "inverse_gross",
  roundingStep: "1000",
  weightDecimals: 4,
  cvThreshold: "0.33",
  grossAdjustmentThreshold: "0.30",
};

export interface CalcAdjustmentInput {
  code: string;
  name: string;
  /** Доля: "-0.05" = −5 %. */
  value: string;
  /** 1 — корректировки первой группы (торг, права, условия рынка), 2 — по характеристикам. */
  stage: number;
  order: number;
}

export interface CalcComparableInput {
  id: string;
  label: string;
  price: string;
  area: string;
  adjustments: CalcAdjustmentInput[];
}

export interface CalcInput {
  subjectArea: string;
  comparables: CalcComparableInput[];
  settings: CalcSettings;
}

export interface CalcStep {
  code: string;
  name: string;
  /** Доля корректировки. */
  value: string;
  /** Цена до шага, ₽/м². */
  before: string;
  /** Цена после шага, ₽/м² (округлена до копеек). */
  after: string;
  /** Абсолютное изменение, ₽/м². */
  delta: string;
  formula: string;
}

export interface CalcComparableResult {
  id: string;
  label: string;
  price: string;
  area: string;
  /** Цена предложения за м² = цена / площадь. */
  unitPrice: string;
  unitPriceFormula: string;
  steps: CalcStep[];
  adjustedUnitPrice: string;
  /** Итоговое отклонение скорректированной цены от исходной, доля. */
  totalChange: string;
  /** Валовая корректировка Σ|корр|, доля. */
  grossAdjustment: string;
  /** Количество ненулевых корректировок. */
  adjustmentCount: number;
  weight: string;
  weightFormula: string;
  contribution: string;
}

export interface CalcStats {
  count: number;
  min: string;
  max: string;
  mean: string;
  median: string;
  range: string;
  stdev: string;
  /** Коэффициент вариации, доля. */
  cv: string;
  /** Отношение max/min. */
  maxMinRatio: string;
}

export interface CalcResult {
  engineVersion: string;
  settings: CalcSettings;
  subjectArea: string;
  comparables: CalcComparableResult[];
  weightsSum: string;
  /** Средневзвешенная цена за м², ₽ (до копеек). */
  weightedUnitPrice: string;
  weightedUnitPriceFormula: string;
  /** Стоимость до округления = средневзвешенная цена × площадь. */
  rawValue: string;
  rawValueFormula: string;
  /** Итоговая стоимость (округлена до шага). */
  finalValue: string;
  finalValueFormula: string;
  /** Итоговая цена за м² = итог / площадь. */
  finalUnitPrice: string;
  stats: CalcStats;
  warnings: string[];
}
