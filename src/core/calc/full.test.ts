// Полный расчёт: от выбранных аналогов до итоговой стоимости; снимок и его неизменность.
import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import { d } from "./decimal";
import { DEFAULT_SETTINGS, type CalcInput } from "./types";
import { calcQuality } from "./quality";
import { WEIGHT_METHODS } from "./weights";
import { runChecks, calcInputFromSnapshot } from "../checks";
import { sampleSnapshot } from "../__fixtures__/sample";

const adj = (code: string, value: string, stage = 2, order = 10) => ({ code, name: code, value, stage, order });
const input = (over: Partial<CalcInput> = {}): CalcInput => ({
  subjectArea: "42.9",
  settings: { ...DEFAULT_SETTINGS },
  comparables: [
    { id: "a", label: "Аналог 1", price: "9900000", area: "45", adjustments: [adj("bargain", "-0.05", 1, 1), adj("wall", "0.05"), adj("floor", "-0.06"), adj("finishing", "-0.13")] },
    { id: "b", label: "Аналог 2", price: "9500000", area: "40", adjustments: [adj("bargain", "-0.05", 1, 1), adj("wall", "0"), adj("floor", "0.0638")] },
    { id: "c", label: "Аналог 3", price: "10300000", area: "44", adjustments: [adj("bargain", "-0.05", 1, 1)] },
  ],
  ...over,
});

describe("полный расчёт", () => {
  const r = calculate(input());
  const [a, b, c] = r.comparables;

  it("цепочка последовательная и мультипликативная: P₁ = P × K₁, P₂ = P₁ × K₂ …", () => {
    expect(a.unitPrice).toBe("220000.00");
    // внутри группы порядок — по sortOrder, затем по коду фактора (детерминированно)
    expect(a.steps.map((s) => s.code)).toEqual(["bargain", "finishing", "floor", "wall"]);
    expect(a.steps.map((s) => s.after)).toEqual(["209000.00", "181830.00", "170920.20", "179466.21"]);
    expect(a.adjustedUnitPrice).toBe("179466.21");
    // ≠ простой сумме: 220 000 × (1 − 0,05 + 0,05 − 0,06 − 0,13)
    expect(d("220000").mul("0.81").toFixed(2)).not.toBe(a.adjustedUnitPrice);
  });
  it("знак: положительная корректировка повышает цену, отрицательная — понижает, 0 % не меняет", () => {
    const up = b.steps.find((s) => s.code === "floor")!;
    expect(d(up.after).gt(up.before)).toBe(true);
    const down = a.steps.find((s) => s.code === "finishing")!;
    expect(d(down.after).lt(down.before)).toBe(true);
    const zero = b.steps.find((s) => s.code === "wall")!;
    expect(zero.after).toBe(zero.before);
    expect(b.adjustmentCount).toBe(2);
  });
  it("веса: сумма ровно 1, вклад = скорр. цена × вес, вес объяснён формулой", () => {
    expect(d(r.weightsSum).eq(1)).toBe(true);
    for (const x of r.comparables) {
      expect(d(x.contribution).eq(d(x.adjustedUnitPrice).mul(x.weight).toDecimalPlaces(2))).toBe(true);
      expect(x.weightFormula).toMatch(/1 \+/);
    }
    // меньше валовая корректировка — больше вес
    expect(d(c.weight).gt(a.weight)).toBe(true);
    expect(WEIGHT_METHODS[r.settings.weightMethod].formula).toContain("Σ|корр|");
  });
  it("итог: Σ вкладов → × площадь → округление до шага", () => {
    const sum = r.comparables.reduce((s, x) => s.plus(x.contribution), d(0));
    expect(sum.toFixed(2)).toBe(r.weightedUnitPrice);
    expect(d(r.weightedUnitPrice).mul("42.9").toDecimalPlaces(2).toFixed(2)).toBe(r.rawValue);
    expect(d(r.finalValue).mod(1000).isZero()).toBe(true);
    expect(d(r.finalValue).minus(r.rawValue).abs().lte(500)).toBe(true);
    const noRound = calculate(input({ settings: { ...DEFAULT_SETTINGS, roundingStep: "0" } }));
    expect(noRound.finalValue).toBe(noRound.rawValue);
  });
  it("ручные веса: не заданы → явная ошибка, а не скрытое значение", () => {
    expect(() => calculate(input({ settings: { ...DEFAULT_SETTINGS, weightMethod: "manual", manualWeights: { a: "0.5", b: "0.5" } } }))).toThrow(/Не задан ручной вес/);
    expect(() => calculate(input({ settings: { ...DEFAULT_SETTINGS, weightMethod: "manual", manualWeights: { a: "0.5", b: "0.3", c: "0.1" } } }))).toThrow(/Сумма ручных весов/);
  });
  it("контроль расчёта: диапазоны, крайние корректировки, разброс до и после", () => {
    const q = calcQuality(r);
    expect(q.count).toBe(3);
    expect(q.maxAdjustment?.value).toBe("0.0638");
    expect(q.minAdjustment?.value).toBe("-0.13");
    expect(q.rawMin).toBe("220000.00");
    expect(q.rawMax).toBe("237500.00");
    expect(q.adjustedMin).toBe(a.adjustedUnitPrice);
  });
});

describe("снимок расчёта", () => {
  it("подтверждённый результат воспроизводится по снимку и не меняется при изменении исходных данных", () => {
    const snap = sampleSnapshot();
    const stored = runChecks(snap).result!;
    const frozen = JSON.parse(JSON.stringify(snap)); // так снимок хранится в CalculationVersion
    // данные оценки изменились после подтверждения
    snap.comparables[0].price = "12000000";
    const live = runChecks(snap).result!;
    expect(live.finalValue).not.toBe(stored.finalValue);
    // старый снимок даёт прежний результат, сверка с сохранённым — без расхождений
    const again = runChecks(frozen, { storedResult: stored });
    expect(again.result!.finalValue).toBe(stored.finalValue);
    expect(again.issues.some((i) => i.code === "STORED_RESULT_MISMATCH")).toBe(false);
    // порядок ключей после хранения в JSONB не влияет на сверку
    const shuffled = Object.fromEntries(Object.entries(stored).reverse());
    expect(runChecks(frozen, { storedResult: shuffled as typeof stored }).issues.some((i) => i.code === "STORED_RESULT_MISMATCH")).toBe(false);
    // подмена сохранённого результата обнаруживается
    const tampered = { ...stored, finalValue: "1" };
    expect(runChecks(frozen, { storedResult: tampered }).issues.some((i) => i.code === "STORED_RESULT_MISMATCH")).toBe(true);
  });
  it("в расчёт попадают только аналоги «Использовать»", () => {
    const snap = sampleSnapshot();
    snap.comparables[2].included = false;
    expect(calcInputFromSnapshot(snap).comparables.map((x) => x.id)).toEqual(["c1", "c2"]);
  });
});
