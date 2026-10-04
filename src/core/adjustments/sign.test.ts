// Правило знака корректировки по всем факторам: равны → 0, аналог лучше → «−», аналог хуже → «+».
import { describe, expect, it } from "vitest";
import { suggestForComparable, type DirectoryEdition, type DirectoryFactor } from "./suggest";
import { comparisonOfAdjustment, compareByCoefficients, expectedSign, signMatches, type Comparison } from "./sign";
import type { ObjectFeatures } from "./attributes";
import { sampleSnapshot } from "../__fixtures__/sample";
import { runChecks } from "../checks";

// Тестовая редакция: коэффициенты условные, только для проверки знака (не данные справочника).
const cat = (code: string, attribute: string, cats: Array<[string, string]>, params: Record<string, unknown> = {}): DirectoryFactor => ({
  code, name: code, kind: "category", attribute, stage: 2, sortOrder: 1, params, enabled: true, categories: cats.map(([c, k]) => ({ code: c, label: c, coefficient: k })),
});
const edition: DirectoryEdition = {
  id: "t", code: "test", name: "Тест", edition: "1", isDemo: true, licenseType: "demo",
  factors: [
    { code: "bargain", name: "Торг", kind: "discount", stage: 1, sortOrder: 1, value: "-0.05", params: {}, enabled: true, categories: [] },
    cat("floor", "floor_category", [["first", "0.94"], ["middle", "1"], ["last", "0.97"]]),
    cat("wall", "wall_material", [["panel", "0.95"], ["brick", "1"], ["monolith", "1.02"]]),
    cat("finishing", "finishing", [["none", "0.9"], ["standard", "1"], ["improved", "1.07"]]),
    cat("furniture", "furniture", [["no", "0.96"], ["yes", "1"]]),
    cat("transport", "metro_distance", [["near", "1"], ["mid", "0.95"], ["far", "0.9"]], { buckets: [{ code: "near", maxM: 500 }, { code: "mid", maxM: 1500 }, { code: "far", maxM: null }] }),
    cat("date", "field:market_quarter", [["2026Q2", "0.97"], ["2026Q3", "1"]]),
    cat("location", "field:location_class", [["center", "1.1"], ["middle", "1"], ["outskirts", "0.9"]]),
    { code: "area", name: "Площадь", kind: "power", attribute: "area", stage: 2, sortOrder: 2, params: { exponent: "-0.1" }, enabled: true, categories: [] },
  ],
};
const subject: ObjectFeatures = { floor: 5, floors: 9, wallMaterial: "brick", finishing: "standard", furniture: false, metroDistanceM: 800, area: "45", extra: { market_quarter: "2026Q3", location_class: "middle" } };
const val = (comp: ObjectFeatures, code: string) => suggestForComparable(edition, subject, { ...subject, ...comp, extra: { ...subject.extra, ...comp.extra } }).find((a) => a.factorCode === code)!.suggestedValue!;
const sign = (v: string) => Math.sign(Number(v));

describe("правило знака", () => {
  const table: Array<[string, string, ObjectFeatures, Comparison]> = [
    ["этаж: равны", "floor", {}, "equal"],
    ["этаж: аналог на первом (хуже)", "floor", { floor: 1 }, "analog_worse"],
    ["материал: аналог монолит (лучше)", "wall", { wallMaterial: "monolith" }, "analog_better"],
    ["материал: аналог панель (хуже)", "wall", { wallMaterial: "panel" }, "analog_worse"],
    ["отделка: аналог улучшенная (лучше)", "finishing", { finishing: "improved" }, "analog_better"],
    ["отделка: аналог без отделки (хуже)", "finishing", { finishing: "none" }, "analog_worse"],
    ["мебель: у аналога есть (лучше)", "furniture", { furniture: true }, "analog_better"],
    ["мебель: равны", "furniture", {}, "equal"],
    ["транспорт: аналог ближе к метро (лучше)", "transport", { metroDistanceM: 300 }, "analog_better"],
    ["транспорт: аналог дальше (хуже)", "transport", { metroDistanceM: 2500 }, "analog_worse"],
    ["дата: предложение прошлого квартала (цены ниже — хуже)", "date", { extra: { market_quarter: "2026Q2" } }, "analog_worse"],
    ["местоположение: аналог в центре (лучше)", "location", { extra: { location_class: "center" } }, "analog_better"],
    ["площадь: аналог больше (цена 1 м² ниже — хуже)", "area", { area: "60" }, "analog_worse"],
    ["площадь: аналог меньше (лучше)", "area", { area: "35" }, "analog_better"],
    ["площадь: равны", "area", {}, "equal"],
    ["торг: предложение дороже сделки", "bargain", {}, "analog_better"],
  ];
  for (const [name, code, comp, expected] of table) {
    it(name, () => {
      const v = val(comp, code);
      expect(comparisonOfAdjustment(v)).toBe(expected);
      expect(sign(v)).toBe(expectedSign(expected));
    });
  }

  it("сравнение по коэффициентам", () => {
    expect(compareByCoefficients("1", "1")).toBe("equal");
    expect(compareByCoefficients("1", "1.07")).toBe("analog_better");
    expect(compareByCoefficients("1", "0.9")).toBe("analog_worse");
  });

  it("0 допустим всегда, противоположный знак — нет", () => {
    expect(signMatches("0", "analog_better")).toBe(true);
    expect(signMatches("-0.05", "analog_better")).toBe(true);
    expect(signMatches("0.05", "analog_better")).toBe(false);
    expect(signMatches("0.05", "analog_worse")).toBe(true);
  });

  it("проверка расчёта: применённый знак противоречит сравнению — ошибка ADJ_SIGN", () => {
    const s = sampleSnapshot();
    const a = s.comparables[0].adjustments.find((x) => x.suggestedValue && Number(x.suggestedValue) !== 0)!;
    Object.assign(a, { value: String(-Number(a.suggestedValue)), overridden: true, comment: "проверка знака" });
    expect(runChecks(s).issues.some((i) => i.code === "ADJ_SIGN" && i.field === `adjustment.${a.id}`)).toBe(true);
  });
});
