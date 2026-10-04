import { describe, expect, it } from "vitest";
import { compareWithSubject, rowForAdjustment, NO_DATA } from "./compare";

const subject = { address: "г. Москва, ул. А, 1", district: "Тверской", area: "42.9", rooms: 2, floor: 7, floors: 9, wallMaterial: "brick", yearBuilt: 1980, finishing: "standard", houseCondition: "good", furniture: false, metroName: null, metroDistanceM: 600, rights: "Собственность", valuationDate: "2026-09-28T00:00:00.000Z" };
const comp = { address: "г. Москва, ул. Б, 2", district: "Тверской", area: "54", rooms: 2, floor: 1, floors: 9, wallMaterial: "panel", houseType: "Панельный", yearBuilt: null, finishing: "designer", houseCondition: null, furniture: null, metroDistanceM: null, rights: null, offerDate: "2026-09-18", distanceM: 850, metroName: "Тверская", metroMinutes: 7, metroMode: "walk" };

describe("сравнение объекта и аналога", () => {
  const rows = compareWithSubject(subject, comp);
  const row = (k: string) => rows.find((r) => r.key === k)!;
  it("разница и подсветка", () => {
    expect(row("area").differs).toBe(true);
    expect(row("area").diff).toContain("+11,1");
    expect(row("rooms").diff).toBe("=");
    expect(row("floor").diff).toBe("средний этаж → первый этаж");
    expect(row("wall").diff).toBe("отличается");
    expect(row("location").diff).toBe("тот же район");
    expect(row("date").diff).toBe("10 дн. до даты оценки");
    expect(row("distance").comparable).toBe("850 м");
  });
  it("отсутствующие данные не додумываются", () => {
    expect(row("year").comparable).toBe(NO_DATA);
    expect(row("condition").comparable).toBe(NO_DATA);
    expect(row("condition").differs).toBeNull();
    expect(row("furniture").comparable).toBe(NO_DATA);
    expect(row("transport").comparable).toContain("7 мин пешком (по объявлению)");
  });
  it("корректировка попадает в строку по признаку справочника, коду или типу фактора", () => {
    expect(rowForAdjustment(rows, { factorCode: "x", ruleSnapshot: { factor: { attribute: "floor_category", kind: "category" } } })?.key).toBe("floor");
    expect(rowForAdjustment(rows, { factorCode: "location", ruleSnapshot: { factor: { kind: "manual" } } })?.key).toBe("location");
    expect(rowForAdjustment(rows, { factorCode: "bargain", ruleSnapshot: { factor: { kind: "discount" } } })?.key).toBe("bargain");
  });
});
