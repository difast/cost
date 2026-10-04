import { describe, expect, it } from "vitest";
import { evalFormula, FormulaError, parseFormula, validateFormula } from "./formula";
import { FORMULA_VARIABLES } from "./attributes";

const ev = (src: string, vars: Record<string, number | string | null> = {}) => evalFormula(parseFormula(src), vars);

describe("формулы справочника", () => {
  it("коэффициент на площадь Ks = (So / Sa)^(-0.12)", () => {
    const k = ev("(So / Sa)^(-0.12)", { So: 42.9, Sa: 54 })!;
    // (42.9/54)^(-0.12) ≈ 1.02800
    expect(k.toDecimalPlaces(5).toString()).toBe("1.028");
    expect(ev("(So / Sa)^(-0.12)", { So: 50, Sa: 50 })!.toString()).toBe("1");
  });
  it("приоритет операций, унарный минус, функции", () => {
    expect(ev("1 + 2 * 3")!.toString()).toBe("7");
    expect(ev("2^3^2")!.toString()).toBe("512"); // правоассоциативно
    expect(ev("-2^2")!.toString()).toBe("-4");
    expect(ev("max(1, 2, 0.5) - min(3, 4) + abs(-1)")!.toString()).toBe("0");
    expect(ev("1.5 * 2")!.toString()).toBe("3");
    expect(ev("min(3,4)")!.toString()).toBe("3"); // запятая — разделитель аргументов, не десятичный знак
  });
  it("нет данных → null, а не 0", () => {
    expect(ev("(So / Sa)^(-0.1)", { So: 40, Sa: null })).toBeNull();
  });
  it("ошибки: деление на ноль, синтаксис, неизвестные переменные", () => {
    expect(() => ev("So / Sa", { So: 1, Sa: 0 })).toThrow(FormulaError);
    expect(() => parseFormula("(So / Sa")).toThrow(FormulaError);
    expect(() => parseFormula("So; drop")).toThrow(FormulaError);
    expect(() => parseFormula("eval(1)")).toThrow(FormulaError);
    expect(validateFormula("(So / Sa)^(-0.12)", FORMULA_VARIABLES)).toBeNull();
    expect(validateFormula("(So / Xa)^2", FORMULA_VARIABLES)).toMatch(/Xa/);
  });
});
