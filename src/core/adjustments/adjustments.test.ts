// Корректировки: знак, нулевая корректировка, мультипликативное применение, ручное изменение,
// отсутствие основания, выход за диапазон, ошибки данных, разброс.
import { describe, expect, it } from "vitest";
import { suggestForComparable, type DirectoryEdition, type DirectoryFactor } from "./suggest";
import { applyAdjustments } from "../calc/engine";
import { d } from "../calc/decimal";
import { runChecks, DISPERSION_MESSAGE } from "../checks";
import { sampleSnapshot } from "../__fixtures__/sample";

const factor = (f: Partial<DirectoryFactor> & Pick<DirectoryFactor, "code" | "kind">): DirectoryFactor => ({
  name: f.code, stage: 2, sortOrder: 10, params: {}, enabled: true, categories: [], ...f,
});
const edition = (factors: DirectoryFactor[]): DirectoryEdition => ({ id: "e1", code: "t", name: "Тест", edition: "1", isDemo: false, licenseType: "own", factors });
const floorF = factor({
  code: "floor", kind: "category", attribute: "floor_category",
  categories: [{ code: "first", label: "Первый", coefficient: "0.94" }, { code: "middle", label: "Средний", coefficient: "1" }, { code: "last", label: "Последний", coefficient: "0.97" }],
});
const finishF = factor({
  code: "finishing", kind: "category", attribute: "finishing",
  categories: [{ code: "standard", label: "Стандарт", coefficient: "1" }, { code: "designer", label: "Дизайнерский", coefficient: "1.12" }],
  minValue: "-0.15", maxValue: "0.15",
});
const one = (f: DirectoryFactor, subject: object, comparable: object) => suggestForComparable(edition([f]), subject, comparable)[0];

describe("автоматические корректировки", () => {
  it("аналог хуже объекта (первый этаж против среднего) → положительная: K = 1 / 0,94", () => {
    const s = one(floorF, { floor: 7, floors: 9 }, { floor: 1, floors: 9 });
    expect(s.coefficient).toBe("1.06383");
    expect(s.suggestedValue).toBe("0.0638");
  });
  it("аналог лучше объекта (дизайнерский ремонт против стандартного) → отрицательная", () => {
    const s = one(finishF, { finishing: "standard" }, { finishing: "designer" });
    expect(d(s.suggestedValue!).isNeg()).toBe(true);
    expect(s.suggestedValue).toBe("-0.1071"); // 1 / 1.12 − 1
  });
  it("одинаковые характеристики → 0 %", () => {
    expect(one(floorF, { floor: 5, floors: 9 }, { floor: 4, floors: 12 }).suggestedValue).toBe("0");
    expect(one(finishF, { finishing: "standard" }, { finishing: "standard" }).suggestedValue).toBe("0");
  });
  it("нет данных → значение не придумывается (null)", () => {
    const s = one(finishF, { finishing: "standard" }, { finishing: null });
    expect(s.suggestedValue).toBeNull();
    expect(s.explanation).toMatch(/Нет данных/);
  });
  it("формульный фактор: K = (So/Sa)^(-0.12), корректировка = K − 1", () => {
    const s = one(factor({ code: "area", kind: "formula", params: { expression: "(So / Sa)^(-0.12)" } }), { area: "42.9" }, { area: "54" });
    expect(s.coefficient).toBe("1.027998"); // (42,9 / 54)^(−0,12)
    expect(s.suggestedValue).toBe("0.028");
  });
  it("корректировки применяются последовательно и мультипликативно: P₁ = P·K₁, P₂ = P₁·K₂", () => {
    const steps = applyAdjustments(d("220000"), [
      { code: "bargain", name: "Торг", value: "-0.05", stage: 1, order: 1 },
      { code: "floor", name: "Этаж", value: "0.06", stage: 2, order: 2 },
      { code: "finishing", name: "Отделка", value: "-0.13", stage: 2, order: 3 },
    ], "sequential");
    expect(steps.map((s) => s.after)).toEqual(["209000.00", "221540.00", "192739.80"]);
    // не простая сумма процентов: 220 000 × (1 − 0,05 + 0,06 − 0,13) = 193 600 ≠ 192 739,80
    expect(d("220000").mul(d(1).minus("0.05").plus("0.06").minus("0.13")).toFixed(2)).not.toBe(steps[2].after);
  });
});

describe("проверки корректировок", () => {
  const issues = (mut: (s: ReturnType<typeof sampleSnapshot>) => void) => {
    const s = sampleSnapshot();
    mut(s);
    return runChecks(s).issues;
  };
  const codes = (mut: (s: ReturnType<typeof sampleSnapshot>) => void) => issues(mut).map((i) => i.code);

  it("ручное изменение без обоснования блокирует отчёт; с обоснованием — допустимо", () => {
    expect(codes((s) => Object.assign(s.comparables[0].adjustments[1], { value: "-0.04", overridden: true, comment: null }))).toContain("ADJ_NO_COMMENT");
    const ok = issues((s) => Object.assign(s.comparables[0].adjustments[1], { value: "-0.04", overridden: true, comment: "Этаж выше среднего по дому" }));
    expect(ok.filter((i) => i.severity === "error")).toEqual([]);
  });
  it("ошибка знака: аналог хуже (по справочнику +6 %), а применено −3 %", () => {
    const r = issues((s) => Object.assign(s.comparables[0].adjustments[1], { suggestedValue: "0.06", value: "-0.03", overridden: true, comment: "ошибочно" }));
    const sign = r.find((i) => i.code === "ADJ_SIGN");
    expect(sign?.severity).toBe("error");
    expect(sign?.message).toMatch(/хуже/);
  });
  it("нет основания: фактор не рассчитан из-за отсутствия данных — предупреждение; «Не требуется» без обоснования — ошибка", () => {
    expect(codes((s) => Object.assign(s.comparables[0].adjustments[1], { suggestedValue: null, value: "0" }))).toContain("ADJ_NOT_DETERMINED");
    expect(codes((s) => Object.assign(s.comparables[0].adjustments[1], { suggestedValue: null, value: "0", notRequired: true, comment: null }))).toContain("ADJ_NOT_REQUIRED_NO_REASON");
    const ok = codes((s) => Object.assign(s.comparables[0].adjustments[1], { suggestedValue: null, value: "0", notRequired: true, comment: "Признак не влияет на цену в этом сегменте" }));
    expect(ok).not.toContain("ADJ_NOT_DETERMINED");
    expect(ok).not.toContain("ADJ_NOT_REQUIRED_NO_REASON");
  });
  it("выход за диапазон справочника — предупреждение", () => {
    const r = issues((s) => Object.assign(s.comparables[0].adjustments[1], { minValue: "-0.05", maxValue: "0.05" }));
    expect(r.find((i) => i.code === "ADJ_OUT_OF_RANGE")?.severity).toBe("warning");
  });
  it("ошибка данных: характеристика в расчёте не совпадает с карточкой аналога", () => {
    const r = issues((s) => Object.assign(s.comparables[0].adjustments[1], {
      comparableValue: "1/9 (Первый)", subjectValue: "1/9 (Первый)",
      ruleSnapshot: { sourceCode: "demo", edition: "2026.1", factor: { kind: "category", attribute: "floor_category" } },
    }));
    expect(r.filter((i) => i.code === "ADJ_VALUE_MISMATCH").length).toBeGreaterThan(0);
  });
  it("характеристики изменились после ручного изменения — ошибка", () => {
    expect(codes((s) => Object.assign(s.comparables[0].adjustments[1], {
      value: "-0.04", overridden: true, comment: "обосновано", subjectValue: "5/9", comparableValue: "1/9",
      basisSnapshot: { subjectValue: "5/9", comparableValue: "3/9", suggestedValue: "-0.06" },
    }))).toContain("ADJ_BASIS_CHANGED");
  });
  it("разброс после корректировок вырос — предупреждение с понятным текстом", () => {
    const r = issues((s) => {
      // одинаковые исходные цены, разные корректировки → разброс растёт
      for (const c of s.comparables) Object.assign(c, { price: "10000000", area: "50" });
      s.comparables[0].adjustments[1].value = "0.2";
      s.comparables[0].adjustments[1].suggestedValue = "0.2";
    });
    const w = r.find((i) => i.code === "DISPERSION_GROWTH");
    expect(w?.severity).toBe("warning");
    expect(w?.message).toContain(DISPERSION_MESSAGE);
  });
});
