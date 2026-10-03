import Decimal from "decimal.js";

// Отдельный экземпляр Decimal с фиксированной конфигурацией —
// расчёт не зависит от глобальных настроек и полностью детерминирован.
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;
export type Num = Dec | string | number;

export const d = (v: Num): Dec => new D(v as Decimal.Value);

/** Округление до N знаков (ROUND_HALF_UP, «бухгалтерское»). */
export const round = (v: Num, dp: number): Dec => d(v).toDecimalPlaces(dp, D.ROUND_HALF_UP);

/** Округление до шага (например, до 1 000 ₽). */
export const roundToStep = (v: Num, step: Num): Dec => {
  const s = d(step);
  if (s.lte(0)) return d(v);
  return d(v).div(s).toDecimalPlaces(0, D.ROUND_HALF_UP).mul(s);
};
