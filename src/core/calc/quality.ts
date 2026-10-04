// Контроль качества расчёта: показатели выборки до и после корректировок.
// Считается только из результата расчётного ядра — те же числа видят интерфейс, проверки, отчёт и XLSX.

import { d } from "./decimal";
import { computeStats } from "./engine";
import type { CalcResult } from "./types";

/** Рост коэффициента вариации (п. п.), начиная с которого разброс считается увеличившимся. */
export const DISPERSION_GROWTH_PP = "0.01";
export const DISPERSION_MESSAGE = "После корректировок разброс цен увеличился. Проверьте выбор аналогов и применённые корректировки.";
/** Проверки не блокируют работу: при ошибках действие выполняется только после явного подтверждения оценщика. */
export const ISSUES_MESSAGE = "Есть замечания, требующие внимания.";

export interface CalcQuality {
  count: number;
  rawMin: string;
  rawMax: string;
  adjustedMin: string;
  adjustedMax: string;
  rawMean: string;
  adjustedMean: string;
  weighted: string;
  /** Наибольшая и наименьшая отдельная корректировка (доля) с указанием аналога и фактора. */
  maxAdjustment: { value: string; label: string; factor: string } | null;
  minAdjustment: { value: string; label: string; factor: string } | null;
  /** Итоговое изменение цены и валовая корректировка по аналогам. */
  perComparable: Array<{ label: string; totalChange: string; grossAdjustment: string; count: number }>;
  maxGross: string;
  cvBefore: string;
  cvAfter: string;
  rangeBefore: string;
  rangeAfter: string;
  dispersionGrew: boolean;
}

export function calcQuality(r: CalcResult): CalcQuality {
  const raw = computeStats(r.comparables.map((c) => d(c.unitPrice)));
  const adj = r.stats;
  let max: CalcQuality["maxAdjustment"] = null;
  let min: CalcQuality["minAdjustment"] = null;
  for (const c of r.comparables) {
    for (const s of c.steps) {
      if (d(s.value).isZero()) continue;
      if (!max || d(s.value).gt(max.value)) max = { value: s.value, label: c.label, factor: s.name };
      if (!min || d(s.value).lt(min.value)) min = { value: s.value, label: c.label, factor: s.name };
    }
  }
  const grosses = r.comparables.map((c) => d(c.grossAdjustment));
  return {
    count: r.comparables.length,
    rawMin: raw.min,
    rawMax: raw.max,
    adjustedMin: adj.min,
    adjustedMax: adj.max,
    rawMean: raw.mean,
    adjustedMean: adj.mean,
    weighted: r.weightedUnitPrice,
    maxAdjustment: max,
    minAdjustment: min,
    perComparable: r.comparables.map((c) => ({ label: c.label, totalChange: c.totalChange, grossAdjustment: c.grossAdjustment, count: c.adjustmentCount })),
    maxGross: grosses.length ? grosses.reduce((m, x) => (x.gt(m) ? x : m)).toString() : "0",
    cvBefore: raw.cv,
    cvAfter: adj.cv,
    rangeBefore: raw.range,
    rangeAfter: adj.range,
    dispersionGrew: r.comparables.length >= 2 && d(adj.cv).minus(raw.cv).gte(DISPERSION_GROWTH_PP),
  };
}
