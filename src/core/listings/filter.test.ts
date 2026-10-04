import { describe, expect, it } from "vitest";
import { applyLocalFilters } from "./filter";
import { normalizeMetrapiItem } from "./metrapi";

const item = (id: string, extra: Record<string, unknown>) => normalizeMetrapiItem({ source: "avito", source_id: id, price: 10_000_000, area_total: 50, ...extra })!;

describe("фильтры на стороне сервиса", () => {
  const center = { lat: 55.75, lon: 37.6 };
  const items = [
    item("near", { lat: 55.751, lon: 37.601, published_at: "2026-09-01" }),
    item("far", { lat: 55.8, lon: 37.7 }),
    item("nocoords", {}),
    item("expensive", { lat: 55.7505, lon: 37.6005, price: 20_000_000 }),
    item("furn", { lat: 55.7502, lon: 37.6002, amenities: ["Мебель"] }),
  ];
  it("радиус, отсутствие координат, цена за м², мебель; сортировка по расстоянию", () => {
    const r = applyLocalFilters(items, { center, radiusM: 2000, unitPriceMax: 300_000, furniture: "no" });
    expect(r.items.map((x) => x.sourceId)).toEqual(["near"]);
    expect(r.stats).toMatchObject({ received: 5, kept: 1, tooFar: 1, noCoords: 1, unitPrice: 1, furniture: 1 });
    expect(r.items[0].distanceM).toBeGreaterThan(100);
  });
  it("без радиуса объявления без координат остаются, в конце списка", () => {
    const r = applyLocalFilters(items, { center });
    expect(r.items.at(-1)?.sourceId).toBe("nocoords");
    expect(r.items[0].sourceId).toBe("furn");
  });
});
