import { describe, expect, it } from "vitest";
import { buildItemsParams, metrapiErrorText, normalizeMetrapiItem, parseItemsResponse } from "./metrapi";

// Пример ответа GET /v1/items из документации Metrapi (раздел «Быстрый старт»)
const DOC_EXAMPLE = {
  count: 128,
  items: [
    {
      source: "avito", deal_type: "sale", realty_type: "flat", address: "Москва, ул. Тверская, 12", city: "msk", price: 14200000,
      rooms: 2, area_total: 54.0, floor: 5, floors_total: 9, metro: "Тверская", metro_minutes: 7, metro_mode: "walk",
      lat: 55.7645, lon: 37.6062, url: "https://www.avito.ru/...", published_at: "2026-06-18",
    },
  ],
};

describe("Metrapi: контракт", () => {
  it("параметры /v1/items: только документированные фильтры, мультизначения повтором", () => {
    const p = buildItemsParams({ locality: "Москва", rooms: [1, 2], areaMin: 40, areaMax: 60, wallMaterials: ["panel", "brick"], finishings: ["improved"], sources: ["avito", "cian"], secondaryOnly: true, dedupe: true, dateFrom: "2026-04-01", limit: 5000 });
    expect(p.get("deal_type")).toBe("sale");
    expect(p.get("realty_type")).toBe("flat");
    expect(p.get("locality")).toBe("Москва");
    expect(p.getAll("rooms")).toEqual(["1", "2"]);
    expect(p.getAll("house_type")).toEqual(["Панельный", "Кирпичный"]);
    expect(p.getAll("renovation")).toEqual(["Евроремонт"]);
    expect(p.getAll("source")).toEqual(["avito", "cian"]);
    expect(p.get("exclude_build_status")).toBe("new");
    expect(p.get("dedupe")).toBe("true");
    expect(p.get("date_from")).toBe("2026-04-01");
    expect(p.get("limit")).toBe("1000"); // максимум API
    expect(p.has("lat")).toBe(false); // фильтра по координатам в API нет — радиус считается у нас
  });

  it("нормализация примера из документации", () => {
    const r = parseItemsResponse({ ...DOC_EXAMPLE, items: [{ ...DOC_EXAMPLE.items[0], source_id: "1234567890" }] });
    expect(r.count).toBe(128);
    const l = r.items[0];
    expect(l).toMatchObject({
      provider: "metrapi", externalId: "avito:1234567890", source: "avito", address: "Москва, ул. Тверская, 12",
      price: 14200000, area: 54, unitPrice: 262962.96, rooms: 2, floor: 5, floors: 9, lat: 55.7645, lon: 37.6062,
      metroName: "Тверская", metroMinutes: 7, metroMode: "walk", publishedAt: "2026-06-18",
    });
    // поля, которых в ответе нет, не додумываются
    expect(l.wallMaterial).toBeNull();
    expect(l.finishing).toBeNull();
    expect(l.furniture).toBeNull();
    expect(l.buildYear).toBeNull();
    expect(l.raw.price).toBe(14200000); // исходные данные сохранены
  });

  it("объявление без source_id не принимается (нельзя сослаться на источник)", () => {
    expect(normalizeMetrapiItem(DOC_EXAMPLE.items[0])).toBeNull();
  });

  it("тип дома, ремонт и мебель — из документированных значений", () => {
    const l = normalizeMetrapiItem({ source: "cian", source_id: "1", house_type: "Монолитно-кирпичный", renovation: "Требует ремонта", amenities: ["Холодильник", "Мебель на кухне"] })!;
    expect(l.wallMaterial).toBe("monolith_brick");
    expect(l.finishing).toBe("needs_repair");
    expect(l.furniture).toBe(true);
    const n = normalizeMetrapiItem({ source: "cian", source_id: "2", house_type: "Неизвестный", amenities: ["Интернет"] })!;
    expect(n.wallMaterial).toBeNull();
    expect(n.houseTypeRaw).toBe("Неизвестный");
    expect(n.furniture).toBeNull(); // удобства без мебели ≠ «мебели нет»
  });

  it("коды ошибок из документации", () => {
    expect(metrapiErrorText(401, null)).toMatch(/METRAPI_API_KEY/);
    expect(metrapiErrorText(403, null)).toMatch(/неверный/);
    expect(metrapiErrorText(429, { detail: { reason: "too_soon", retry_after: 2 } })).toMatch(/частые/);
    expect(metrapiErrorText(429, { detail: "daily limit exceeded" })).toMatch(/квота/);
    expect(metrapiErrorText(400, { detail: { reason: "cursor_dedupe" } })).toMatch(/cursor_dedupe/);
  });
});
