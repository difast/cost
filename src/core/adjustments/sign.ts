// Правило знака корректировки — единое для всех факторов (этаж, материал, площадь, отделка, мебель,
// местоположение, торг, дата, транспорт…). Корректировка приводит цену аналога к объекту оценки:
//   K = k(объект) / k(аналог), корректировка = K − 1;
//   объект и аналог равны            → 0;
//   аналог лучше объекта (k аналога больше) → корректировка отрицательная (цену аналога снижаем);
//   аналог хуже объекта (k аналога меньше)  → корректировка положительная (цену аналога повышаем).

import { d } from "../calc/decimal";

export type Comparison = "equal" | "analog_better" | "analog_worse";

export const COMPARISON_LABEL: Record<Comparison, string> = {
  equal: "равны",
  analog_better: "аналог лучше объекта",
  analog_worse: "аналог хуже объекта",
};

/** Сравнение по коэффициентам признака (k объекта, k аналога). */
export function compareByCoefficients(kSubject: string | number, kAnalog: string | number): Comparison {
  const c = d(kAnalog).comparedTo(d(kSubject));
  return c === 0 ? "equal" : c > 0 ? "analog_better" : "analog_worse";
}

/** Сравнение по самой корректировке (K − 1): знак корректировки однозначно задаёт сравнение. */
export function comparisonOfAdjustment(value: string | number): Comparison {
  const v = d(value);
  return v.isZero() ? "equal" : v.isNeg() ? "analog_better" : "analog_worse";
}

/** Ожидаемый знак корректировки для результата сравнения. */
export function expectedSign(c: Comparison): -1 | 0 | 1 {
  return c === "equal" ? 0 : c === "analog_better" ? -1 : 1;
}

/** Согласуется ли знак применённой корректировки со сравнением (0 допустим всегда — «не требуется» / экспертно). */
export function signMatches(value: string | number, c: Comparison): boolean {
  const v = d(value);
  if (v.isZero()) return true;
  return (v.isNeg() ? -1 : 1) === expectedSign(c);
}
