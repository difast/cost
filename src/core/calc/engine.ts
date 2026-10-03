// Расчётное ядро сравнительного подхода.
// Чистые функции без доступа к БД. Одинаковый вход → одинаковый результат (детерминизм).
// Все промежуточные значения округляются до копеек на каждом шаге — так любую цифру
// таблицы можно проверить вручную на калькуляторе, и итог «сходится» с таблицей.

import { d, round, roundToStep, type Dec, D } from "./decimal";
import { fmtNumber, fmtPercent } from "../format";
import type {
  CalcInput,
  CalcResult,
  CalcComparableResult,
  CalcStep,
  CalcStats,
  CalcSettings,
} from "./types";

export const ENGINE_VERSION = "comparative-1.0.0";

export class CalcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalcError";
  }
}

const n = (v: Dec | string, dp = 2) => fmtNumber(v, dp);

function assertPositive(v: string, what: string) {
  let x: Dec;
  try {
    x = d(v);
  } catch {
    throw new CalcError(`${what}: некорректное число «${v}»`);
  }
  if (!x.isFinite() || x.lte(0)) throw new CalcError(`${what}: должно быть больше нуля`);
}

function assertAdjustment(v: string, what: string) {
  let x: Dec;
  try {
    x = d(v);
  } catch {
    throw new CalcError(`${what}: некорректное значение корректировки «${v}»`);
  }
  if (!x.isFinite() || x.lte(-1)) throw new CalcError(`${what}: корректировка должна быть больше −100 %`);
}

/** Цепочка корректировок одного аналога. */
export function applyAdjustments(
  unitPrice: Dec,
  adjustments: CalcInput["comparables"][number]["adjustments"],
  mode: CalcSettings["adjustmentMode"],
): CalcStep[] {
  const sorted = [...adjustments].sort((a, b) => a.stage - b.stage || a.order - b.order || a.code.localeCompare(b.code));
  const steps: CalcStep[] = [];
  let current = unitPrice;

  const stage1 = mode === "staged" ? sorted.filter((a) => a.stage <= 1) : sorted;
  const stage2 = mode === "staged" ? sorted.filter((a) => a.stage > 1) : [];

  for (const a of stage1) {
    const v = d(a.value);
    const after = round(current.mul(d(1).plus(v)), 2);
    steps.push({
      code: a.code,
      name: a.name,
      value: v.toString(),
      before: current.toFixed(2),
      after: after.toFixed(2),
      delta: after.minus(current).toFixed(2),
      formula: `${n(current)} × (1 ${v.isNeg() ? "−" : "+"} ${fmtPercent(v.abs())}) = ${n(after)}`,
    });
    current = after;
  }

  // Вторая группа: каждая корректировка считается от базы (цены после 1-й группы)
  // и складывается — эквивалент множителя (1 + Σ корр).
  const base = current;
  for (const a of stage2) {
    const v = d(a.value);
    const delta = round(base.mul(v), 2);
    const after = current.plus(delta);
    steps.push({
      code: a.code,
      name: a.name,
      value: v.toString(),
      before: current.toFixed(2),
      after: after.toFixed(2),
      delta: delta.toFixed(2),
      formula: `${n(current)} ${delta.isNeg() ? "−" : "+"} ${n(base)} × ${fmtPercent(v.abs())} = ${n(after)}`,
    });
    current = after;
  }
  return steps;
}

/** Распределение округлённых весов методом наибольшего остатка: сумма ровно 1. */
export function roundWeights(raw: Dec[], dp: number): Dec[] {
  if (raw.length === 0) return [];
  const scale = d(10).pow(dp);
  const total = raw.reduce((s, w) => s.plus(w), d(0));
  const normalized = raw.map((w) => w.div(total));
  const scaled = normalized.map((w) => w.mul(scale));
  const floors = scaled.map((w) => w.floor());
  let remaining = scale.minus(floors.reduce((s, f) => s.plus(f), d(0))).toNumber();
  const order = scaled
    .map((w, i) => ({ i, rem: w.minus(w.floor()) }))
    .sort((a, b) => b.rem.comparedTo(a.rem) || a.i - b.i);
  const result = [...floors];
  for (let k = 0; remaining > 0; k = (k + 1) % order.length, remaining--) {
    result[order[k].i] = result[order[k].i].plus(1);
  }
  return result.map((f) => f.div(scale));
}

function computeWeights(
  comps: Array<{ id: string; gross: Dec }>,
  settings: CalcSettings,
): { weights: Dec[]; formulas: string[] } {
  const count = comps.length;
  const dp = settings.weightDecimals;
  switch (settings.weightMethod) {
    case "equal": {
      const w = roundWeights(comps.map(() => d(1)), dp);
      return { weights: w, formulas: w.map(() => `1 / ${count}`) };
    }
    case "inverse_gross": {
      const inv = comps.map((c) => d(1).div(d(1).plus(c.gross)));
      const sumInv = inv.reduce((s, x) => s.plus(x), d(0));
      const w = roundWeights(inv, dp);
      return {
        weights: w,
        formulas: comps.map(
          (c, i) => `(1 / (1 + ${fmtNumber(c.gross, 4)})) / ${fmtNumber(sumInv, 6)} = ${fmtNumber(inv[i], 6)} / ${fmtNumber(sumInv, 6)}`,
        ),
      };
    }
    case "linear_gross": {
      const S = comps.reduce((s, c) => s.plus(c.gross), d(0));
      if (count === 1 || S.isZero()) {
        const w = roundWeights(comps.map(() => d(1)), dp);
        return { weights: w, formulas: w.map(() => `1 / ${count} (Σ корректировок = 0)`) };
      }
      const raw = comps.map((c) => S.minus(c.gross).div(S.mul(count - 1)));
      const w = roundWeights(raw, dp);
      return {
        weights: w,
        formulas: comps.map(
          (c) => `(${fmtNumber(S, 4)} − ${fmtNumber(c.gross, 4)}) / ((${count} − 1) × ${fmtNumber(S, 4)})`,
        ),
      };
    }
    case "manual": {
      const mw = settings.manualWeights ?? {};
      const raw = comps.map((c) => {
        const v = mw[c.id];
        if (v === undefined || v === "") throw new CalcError(`Не задан ручной вес для аналога ${c.id}`);
        const x = d(v);
        if (x.isNeg()) throw new CalcError("Вес не может быть отрицательным");
        return round(x, dp);
      });
      const sum = raw.reduce((s, x) => s.plus(x), d(0));
      if (!sum.eq(1)) {
        throw new CalcError(`Сумма ручных весов должна быть равна 1, сейчас ${fmtNumber(sum, dp)}`);
      }
      return { weights: raw, formulas: raw.map(() => "задан оценщиком") };
    }
  }
}

export function computeStats(values: Dec[]): CalcStats {
  const count = values.length;
  if (count === 0) {
    return { count: 0, min: "0", max: "0", mean: "0", median: "0", range: "0", stdev: "0", cv: "0", maxMinRatio: "0" };
  }
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const min = sorted[0];
  const max = sorted[count - 1];
  const mean = sorted.reduce((s, x) => s.plus(x), d(0)).div(count);
  const median = count % 2 === 1 ? sorted[(count - 1) / 2] : sorted[count / 2 - 1].plus(sorted[count / 2]).div(2);
  const variance =
    count > 1 ? sorted.reduce((s, x) => s.plus(x.minus(mean).pow(2)), d(0)).div(count - 1) : d(0);
  const stdev = variance.sqrt();
  const cv = mean.isZero() ? d(0) : stdev.div(mean);
  return {
    count,
    min: min.toFixed(2),
    max: max.toFixed(2),
    mean: round(mean, 2).toFixed(2),
    median: round(median, 2).toFixed(2),
    range: max.minus(min).toFixed(2),
    stdev: round(stdev, 2).toFixed(2),
    cv: round(cv, 4).toFixed(4),
    maxMinRatio: min.isZero() ? "0" : round(max.div(min), 4).toFixed(4),
  };
}

export function calculate(input: CalcInput): CalcResult {
  const settings = input.settings;
  assertPositive(input.subjectArea, "Площадь объекта оценки");
  if (input.comparables.length === 0) throw new CalcError("Нет аналогов для расчёта");
  if (!/^\d+$/.test(String(settings.weightDecimals)) || settings.weightDecimals > 8)
    throw new CalcError("Некорректная точность весов");

  const area = round(input.subjectArea, 2);
  const warnings: string[] = [];

  const partial = input.comparables.map((c) => {
    assertPositive(c.price, `${c.label}: цена`);
    assertPositive(c.area, `${c.label}: площадь`);
    for (const a of c.adjustments) assertAdjustment(a.value, `${c.label}: ${a.name}`);
    const price = round(c.price, 2);
    const cArea = round(c.area, 2);
    const unitPrice = round(price.div(cArea), 2);
    const steps = applyAdjustments(unitPrice, c.adjustments, settings.adjustmentMode);
    const adjusted = steps.length ? d(steps[steps.length - 1].after) : unitPrice;
    const gross = c.adjustments.reduce((s, a) => s.plus(d(a.value).abs()), d(0));
    return {
      c,
      price,
      cArea,
      unitPrice,
      steps,
      adjusted,
      gross,
      count: c.adjustments.filter((a) => !d(a.value).isZero()).length,
    };
  });

  const { weights, formulas } = computeWeights(
    partial.map((p) => ({ id: p.c.id, gross: p.gross })),
    settings,
  );

  const comparables: CalcComparableResult[] = partial.map((p, i) => {
    const contribution = round(p.adjusted.mul(weights[i]), 2);
    return {
      id: p.c.id,
      label: p.c.label,
      price: p.price.toFixed(2),
      area: p.cArea.toFixed(2),
      unitPrice: p.unitPrice.toFixed(2),
      unitPriceFormula: `${n(p.price)} / ${n(p.cArea)} = ${n(p.unitPrice)}`,
      steps: p.steps,
      adjustedUnitPrice: p.adjusted.toFixed(2),
      totalChange: round(p.adjusted.div(p.unitPrice).minus(1), 6).toString(),
      grossAdjustment: round(p.gross, 6).toString(),
      adjustmentCount: p.count,
      weight: weights[i].toFixed(settings.weightDecimals),
      weightFormula: formulas[i],
      contribution: contribution.toFixed(2),
    };
  });

  const weightsSum = weights.reduce((s, w) => s.plus(w), d(0));
  const weighted = comparables.reduce((s, c) => s.plus(c.contribution), d(0));
  const rawValue = round(weighted.mul(area), 2);
  const finalValue = roundToStep(rawValue, settings.roundingStep);
  const finalUnitPrice = round(finalValue.div(area), 2);

  const stats = computeStats(partial.map((p) => p.adjusted));
  if (d(stats.cv).gt(settings.cvThreshold)) {
    warnings.push(
      `Коэффициент вариации скорректированных цен ${fmtPercent(stats.cv)} превышает ${fmtPercent(settings.cvThreshold, 0)} — выборка неоднородна`,
    );
  }
  for (const c of comparables) {
    if (d(c.grossAdjustment).gt(settings.grossAdjustmentThreshold)) {
      warnings.push(
        `${c.label}: суммарная корректировка ${fmtPercent(c.grossAdjustment)} превышает ${fmtPercent(settings.grossAdjustmentThreshold, 0)}`,
      );
    }
  }
  if (comparables.length < 3) warnings.push("Использовано менее трёх аналогов");

  return {
    engineVersion: ENGINE_VERSION,
    settings,
    subjectArea: area.toFixed(2),
    comparables,
    weightsSum: weightsSum.toFixed(settings.weightDecimals),
    weightedUnitPrice: weighted.toFixed(2),
    weightedUnitPriceFormula: comparables.map((c) => `${n(c.adjustedUnitPrice)} × ${c.weight.replace(".", ",")}`).join(" + ") + ` = ${n(weighted)}`,
    rawValue: rawValue.toFixed(2),
    rawValueFormula: `${n(weighted)} × ${n(area)} = ${n(rawValue)}`,
    finalValue: finalValue.toFixed(2),
    finalValueFormula: d(settings.roundingStep).gt(0)
      ? `округление ${n(rawValue)} до ${fmtNumber(settings.roundingStep, 0)} ₽ = ${n(finalValue)}`
      : `без округления = ${n(finalValue)}`,
    finalUnitPrice: finalUnitPrice.toFixed(2),
    stats,
    warnings,
  };
}

// Нужен в нескольких местах для сравнения значений
export const decEq = (a: string, b: string) => new D(a).eq(new D(b));
