import { describe, it, expect } from "vitest";
import { calculate, roundWeights, computeStats, CalcError } from "./engine";
import { d } from "./decimal";
import { DEFAULT_SETTINGS, type CalcInput } from "./types";

const base = (over: Partial<CalcInput> = {}): CalcInput => ({
  subjectArea: "42.9",
  settings: { ...DEFAULT_SETTINGS, weightMethod: "equal" },
  comparables: [
    {
      id: "a1",
      label: "Аналог 1",
      price: "10000000",
      area: "45",
      adjustments: [
        { code: "bargain", name: "Торг", value: "-0.05", stage: 1, order: 1 },
        { code: "floor", name: "Этаж", value: "0.06", stage: 2, order: 2 },
      ],
    },
    { id: "a2", label: "Аналог 2", price: "9500000", area: "40", adjustments: [] },
    { id: "a3", label: "Аналог 3", price: "9900000", area: "43.5", adjustments: [] },
  ],
  ...over,
});

describe("цена за м² и последовательные корректировки", () => {
  it("каждый шаг округляется до копеек и проверяем вручную", () => {
    const r = calculate(base());
    const a1 = r.comparables[0];
    expect(a1.unitPrice).toBe("222222.22"); // 10 000 000 / 45
    expect(a1.steps[0].after).toBe("211111.11"); // 222 222,22 × 0,95 = 211 111,109
    expect(a1.steps[1].after).toBe("223777.78"); // 211 111,11 × 1,06 = 223 777,7766
    expect(a1.adjustedUnitPrice).toBe("223777.78");
    expect(a1.grossAdjustment).toBe("0.11");
    // каждый шаг: after = before + delta
    for (const s of a1.steps) expect(d(s.before).plus(s.delta).toFixed(2)).toBe(s.after);
  });

  it("корректировки упорядочиваются по группе и порядку, а не по порядку ввода", () => {
    const inp = base();
    inp.comparables[0].adjustments.reverse();
    const r = calculate(inp);
    expect(r.comparables[0].steps.map((s) => s.code)).toEqual(["bargain", "floor"]);
  });

  it("режим staged: 2-я группа складывается от базы после торга", () => {
    const inp = base({ settings: { ...DEFAULT_SETTINGS, adjustmentMode: "staged", weightMethod: "equal" } });
    inp.comparables[0].adjustments.push({ code: "wall", name: "Материал", value: "-0.05", stage: 2, order: 3 });
    const r = calculate(inp);
    const a1 = r.comparables[0];
    // база = 211 111,11; +6 % = +12 666,67; −5 % = −10 555,56
    expect(a1.steps[1].delta).toBe("12666.67");
    expect(a1.steps[2].delta).toBe("-10555.56");
    expect(a1.adjustedUnitPrice).toBe("213222.22");
  });
});

describe("веса", () => {
  it("равные веса трёх аналогов в сумме дают ровно 1", () => {
    const r = calculate(base());
    expect(r.comparables.map((c) => c.weight)).toEqual(["0.3334", "0.3333", "0.3333"]);
    expect(r.weightsSum).toBe("1.0000");
  });

  it("roundWeights: метод наибольшего остатка", () => {
    const w = roundWeights([d(1), d(1), d(1)], 2);
    expect(w.map((x) => x.toFixed(2))).toEqual(["0.34", "0.33", "0.33"]);
    expect(w.reduce((s, x) => s.plus(x), d(0)).toString()).toBe("1");
  });

  it("inverse_gross: аналог с меньшей суммарной корректировкой получает больший вес", () => {
    const r = calculate(base({ settings: { ...DEFAULT_SETTINGS, weightMethod: "inverse_gross" } }));
    const [w1, w2, w3] = r.comparables.map((c) => d(c.weight));
    expect(w1.lt(w2)).toBe(true);
    expect(w2.eq(w3)).toBe(true);
    expect(r.weightsSum).toBe("1.0000");
    // 1/1.11 = 0.9009009; Σ = 2.9009009; w1 = 0.31056 → 0.3106 (с учётом остатков)
    expect(r.comparables[0].weight).toBe("0.3106");
  });

  it("linear_gross: (S − s_i) / ((n − 1)·S)", () => {
    const inp = base({ settings: { ...DEFAULT_SETTINGS, weightMethod: "linear_gross" } });
    inp.comparables[1].adjustments = [{ code: "x", name: "x", value: "0.09", stage: 2, order: 1 }];
    // s = [0.11, 0.09, 0], S = 0.20 → w = [0.09/0.4, 0.11/0.4, 0.2/0.4] = [0.225, 0.275, 0.5]
    const r = calculate(inp);
    expect(r.comparables.map((c) => c.weight)).toEqual(["0.2250", "0.2750", "0.5000"]);
  });

  it("manual: сумма весов ≠ 1 — ошибка, без скрытой нормализации", () => {
    const inp = base({
      settings: { ...DEFAULT_SETTINGS, weightMethod: "manual", manualWeights: { a1: "0.5", a2: "0.3", a3: "0.3" } },
    });
    expect(() => calculate(inp)).toThrow(CalcError);
  });
});

describe("итог", () => {
  it("итог = средневзвешенная цена × площадь, затем округление до шага", () => {
    const r = calculate(base());
    // скорр. цены: 223 777,78; 237 500,00; 227 586,21
    expect(r.comparables[1].adjustedUnitPrice).toBe("237500.00");
    expect(r.comparables[2].adjustedUnitPrice).toBe("227586.21");
    // вклады: 223777,78×0,3334=74607,51; 237500×0,3333=79158,75; 227586,21×0,3333=75854,48
    expect(r.comparables.map((c) => c.contribution)).toEqual(["74607.51", "79158.75", "75854.48"]);
    expect(r.weightedUnitPrice).toBe("229620.74");
    expect(r.rawValue).toBe("9850729.75"); // 229 620,74 × 42,9
    expect(r.finalValue).toBe("9851000.00");
    expect(r.finalUnitPrice).toBe("229627.04"); // 9 851 000 / 42,9
    // сумма вкладов = средневзвешенная цена (таблица «сходится»)
    const sum = r.comparables.reduce((s, c) => s.plus(c.contribution), d(0));
    expect(sum.toFixed(2)).toBe(r.weightedUnitPrice);
  });

  it("детерминизм: повторный расчёт даёт идентичный результат", () => {
    expect(JSON.stringify(calculate(base()))).toBe(JSON.stringify(calculate(base())));
  });

  it("валидация входа", () => {
    expect(() => calculate(base({ subjectArea: "0" }))).toThrow(/Площадь/);
    expect(() => calculate(base({ comparables: [] }))).toThrow(/Нет аналогов/);
    const bad = base();
    bad.comparables[0].adjustments[0].value = "-1.2";
    expect(() => calculate(bad)).toThrow(/−100/);
  });

  it("предупреждение при большом разбросе и больших корректировках", () => {
    const inp = base();
    inp.comparables[0].adjustments.push({ code: "big", name: "Большая", value: "0.4", stage: 2, order: 9 });
    inp.comparables[1].price = "30000000";
    const r = calculate(inp);
    expect(r.warnings.some((w) => w.includes("вариации"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("суммарная корректировка"))).toBe(true);
  });
});

describe("статистика", () => {
  it("медиана, среднее, CV", () => {
    const s = computeStats([d(100), d(200), d(300), d(400)]);
    expect(s.median).toBe("250.00");
    expect(s.mean).toBe("250.00");
    expect(s.min).toBe("100.00");
    expect(s.max).toBe("400.00");
    expect(s.stdev).toBe("129.10");
    expect(s.cv).toBe("0.5164");
  });
});
