import { describe, it, expect } from "vitest";
import { comparePeriods, demoRows, histogram, monthly, regionOf, stats, unitPrice, groupBy, type AnalyticsRow } from "./analytics";
import { d } from "./calc/decimal";

const row = (id: string, price: string, area: string, date: string, address = "г. Москва, ул. А"): AnalyticsRow => ({
  id, assessmentId: "a", assessmentNumber: "1", address, sourceName: "ЦИАН", date, price, area, rooms: 2, included: true, adjustedUnitPrice: null, totalChange: null,
});

describe("аналитика", () => {
  it("статистика: медиана, квартили", () => {
    const s = stats([d(100), d(200), d(300), d(400)]);
    expect(s).toMatchObject({ count: 4, mean: "250.00", median: "250.00", min: "100.00", max: "400.00", p25: "175.00", p75: "325.00" });
    expect(stats([]).median).toBeNull();
  });

  it("регион по адресу", () => {
    expect(regionOf("г. Москва, ул. Тверская, 1")).toBe("Москва");
    expect(regionOf("Казань, ул. Баумана")).toBe("Казань");
    expect(regionOf(null)).toBe("Не указан");
  });

  it("динамика по месяцам", () => {
    const rows = [row("1", "10000000", "50", "2026-08-10"), row("2", "12000000", "50", "2026-08-20"), row("3", "11000000", "50", "2026-09-05")];
    const m = monthly(rows);
    expect(m.map((x) => x.month)).toEqual(["2026-08", "2026-09"]);
    expect(m[0].median).toBe("220000.00");
    expect(m[1].count).toBe(1);
  });

  it("сравнение периодов", () => {
    const rows = [row("1", "10000000", "50", "2026-07-10"), row("2", "11000000", "50", "2026-09-10")];
    const c = comparePeriods(rows, ["2026-07-01", "2026-07-31"], ["2026-09-01", "2026-09-30"]);
    expect(c.a.median).toBe("200000.00");
    expect(c.b.median).toBe("220000.00");
    expect(c.medianChange).toBe("0.1");
  });

  it("гистограмма покрывает все значения", () => {
    const vals = [d(101000), d(145000), d(199000), d(230000)];
    const h = histogram(vals, 5);
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(4);
  });

  it("группировка по региону", () => {
    const g = groupBy([row("1", "1", "1", "2026-01-01", "г. Казань, x"), row("2", "1", "1", "2026-01-01")], (r) => regionOf(r.address));
    expect(g.map((x) => x.key).sort()).toEqual(["Казань", "Москва"]);
  });

  it("демо-данные детерминированы", () => {
    expect(JSON.stringify(demoRows())).toBe(JSON.stringify(demoRows()));
    expect(unitPrice(demoRows()[0]).gt(0)).toBe(true);
  });
});
