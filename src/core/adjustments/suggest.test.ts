import { describe, it, expect } from "vitest";
import { suggestForComparable, type DirectoryEdition } from "./suggest";
import { floorCategory } from "./attributes";

const edition: DirectoryEdition = {
  id: "s1", code: "demo", name: "Демо", edition: "2026.1", isDemo: true, licenseType: "demo",
  factors: [
    { code: "bargain", name: "Торг", kind: "discount", stage: 1, sortOrder: 1, value: "-0.05", minValue: "-0.08", maxValue: "-0.03", params: {}, enabled: true, categories: [] },
    {
      code: "floor", name: "Этаж", kind: "category", attribute: "floor_category", stage: 2, sortOrder: 2, params: {}, enabled: true,
      categories: [
        { code: "first", label: "Первый", coefficient: "0.94" },
        { code: "middle", label: "Средний", coefficient: "1" },
        { code: "last", label: "Последний", coefficient: "0.97" },
      ],
    },
    {
      code: "furniture", name: "Мебель", kind: "category", attribute: "furniture", stage: 2, sortOrder: 3, params: {}, enabled: true,
      categories: [
        { code: "no", label: "Без мебели", coefficient: "0.96" },
        { code: "yes", label: "С мебелью", coefficient: "1" },
      ],
    },
    { code: "area", name: "Площадь", kind: "power", attribute: "area", stage: 2, sortOrder: 4, params: { exponent: "-0.1" }, enabled: true, categories: [] },
    { code: "location", name: "Местоположение", kind: "manual", stage: 2, sortOrder: 5, params: {}, enabled: true, categories: [] },
    { code: "off", name: "Выключен", kind: "manual", stage: 2, sortOrder: 6, params: {}, enabled: false, categories: [] },
  ],
};

describe("floorCategory", () => {
  it("первый/средний/последний", () => {
    expect(floorCategory(1, 9)).toBe("first");
    expect(floorCategory(5, 9)).toBe("middle");
    expect(floorCategory(9, 9)).toBe("last");
    expect(floorCategory(5, null)).toBeNull();
  });
});

describe("suggestForComparable", () => {
  const r = suggestForComparable(
    edition,
    { floor: 1, floors: 9, furniture: false, area: "42.9" },
    { floor: 5, floors: 9, furniture: true, area: "45" },
  );
  const by = (c: string) => r.find((x) => x.factorCode === c)!;

  it("торг из справочника", () => expect(by("bargain").suggestedValue).toBe("-0.05"));
  it("первый этаж объекта vs средний аналога = −6 %", () => expect(by("floor").suggestedValue).toBe("-0.06"));
  it("мебель у аналога, у объекта нет = −4 %", () => expect(by("furniture").suggestedValue).toBe("-0.04"));
  it("площадь степенной функцией", () => expect(by("area").suggestedValue).toBe("0.0048"));
  it("ручной фактор = 0", () => expect(by("location").suggestedValue).toBe("0"));
  it("выключенные факторы не предлагаются", () => expect(r.find((x) => x.factorCode === "off")).toBeUndefined());
  it("снимок правила содержит редакцию справочника", () => {
    expect(by("floor").ruleSnapshot).toMatchObject({ edition: "2026.1", isDemo: true });
  });
  it("нет данных → null", () => {
    const x = suggestForComparable(edition, { floor: null }, { floor: 2, floors: 5 });
    expect(x.find((a) => a.factorCode === "floor")!.suggestedValue).toBeNull();
  });
});
