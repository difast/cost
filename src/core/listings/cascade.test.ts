// Каскадный поиск аналогов: строгие условия → автоматическое и видимое ослабление → ранжирование.
import { describe, expect, it, vi } from "vitest";
import { cascadeSearch, level3Conditions, passesLevel3, rankBySimilarity, similarityPenalty, streetQuery, ZERO_FOUND_MESSAGE, type Fetcher } from "./cascade";
import { normalizeMetrapiItem } from "./metrapi";
import type { ListingQuery, ListingWithRaw } from "./model";

// Объявления — тестовые объекты в формате Metrapi (не реальные данные).
const item = (id: string, extra: Record<string, unknown>) => normalizeMetrapiItem({ source: "avito", source_id: id, price: 10_000_000, area_total: 45, rooms: 2, floor: 3, floors_total: 9, house_type: "Панельный", address: "Москва, ул. Тестовая, 1", ...extra })!;

const center = { lat: 55.75, lon: 37.6 };
const base: ListingQuery = { locality: "Москва", street: "Тестовая улица", center, radiusM: 1000, rooms: [2], areaMin: 40, areaMax: 50, wallMaterials: ["panel"] };
const subject = { rooms: 2, area: 45, floor: 3, floors: 9, wallMaterial: "panel", finishing: null };

/** Поставщик-заглушка: фильтрует по q (улица), комнатам и площади — как API. */
function fakeApi(all: ListingWithRaw[]): Fetcher & ReturnType<typeof vi.fn> {
  return vi.fn(async (q: ListingQuery) => {
    const items = all.filter((l) =>
      (!q.q || (l.address ?? "").toLowerCase().includes(q.q.toLowerCase())) &&
      (!q.rooms?.length || (l.rooms !== null && q.rooms.includes(l.rooms))) &&
      (q.areaMin == null || (l.area ?? 0) >= q.areaMin) && (q.areaMax == null || (l.area ?? 0) <= q.areaMax));
    return { count: items.length, items };
  }) as Fetcher & ReturnType<typeof vi.fn>;
}

describe("каскадный поиск", () => {
  it("город + улица находят достаточно — без ослабления, один запрос", async () => {
    const api = fakeApi([1, 2, 3, 4].map((n) => item(`s${n}`, { lat: 55.751, lon: 37.601 + n / 10000 })));
    const r = await cascadeSearch(base, subject, api);
    expect(api).toHaveBeenCalledTimes(1);
    expect(api.mock.calls[0][0]).toMatchObject({ locality: "Москва", q: "Тестовая", rooms: [2], areaMin: 40, wallMaterials: [], radiusM: null });
    expect(r.items).toHaveLength(4);
    expect(r.relaxed).toEqual([]);
    expect(r.message).toBeNull();
  });

  it("уровень 3 ослабляется на нашей стороне без нового запроса", async () => {
    const api = fakeApi([1, 2, 3].map((n) => item(`b${n}`, { lat: 55.751, lon: 37.6, house_type: "Кирпичный" })));
    const r = await cascadeSearch(base, subject, api);
    expect(api).toHaveBeenCalledTimes(1);
    expect(r.items).toHaveLength(3);
    expect(r.relaxed).toEqual(["материал стен", "расстояние ≤ 1 км"]);
    expect(r.message).toContain(ZERO_FOUND_MESSAGE);
    expect(r.steps.map((s) => s.kept)).toEqual([0, 3]);
  });

  it("на улице ничего нет — поиск расширяется до города, это видно в шагах", async () => {
    const other = [1, 2, 3].map((n) => item(`o${n}`, { address: "Москва, Другая улица, 5", lat: 55.752, lon: 37.601 }));
    const api = fakeApi(other);
    const r = await cascadeSearch(base, subject, api);
    expect(r.items).toHaveLength(3);
    expect(r.message!.startsWith(ZERO_FOUND_MESSAGE)).toBe(true);
    expect(r.relaxed).toContain("улица «Тестовая улица»");
    expect(r.applied).toContain("город: Москва");
    expect(r.applied.some((a) => a.startsWith("улица"))).toBe(false);
  });

  it("ничего не найдено даже в городе — пустой результат и сообщение, без исключения", async () => {
    const api = fakeApi([]);
    const r = await cascadeSearch(base, subject, api);
    expect(r.items).toEqual([]);
    expect(r.message).toContain(ZERO_FOUND_MESSAGE);
    expect(r.relaxed).toEqual(expect.arrayContaining(["комнаты", "площадь", "улица «Тестовая улица»"]));
    expect(api.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("без улицы — сразу город + уровень 2", async () => {
    const api = fakeApi([1, 2, 3].map((n) => item(`c${n}`, { lat: 55.751, lon: 37.6 })));
    const r = await cascadeSearch({ ...base, street: null }, subject, api);
    expect(api.mock.calls[0][0].q).toBeNull();
    expect(r.items).toHaveLength(3);
  });

  it("неизвестные значения условиям не противоречат", () => {
    const unknown = item("u", { floor: null, floors_total: null, house_type: null });
    expect(passesLevel3(unknown, { ...base, floorMin: 2, floorMax: 5, floorsMin: 5 })).toBe(true);
    const nocoords = item("n", {});
    expect(passesLevel3(nocoords, base)).toBe(true);
    const far = item("f", { lat: 55.8, lon: 37.7 });
    expect(passesLevel3(far, base)).toBe(false);
  });

  it("ранжирование по сходству: ближе и похожее — выше", () => {
    const near = { ...item("near", { lat: 55.7505, lon: 37.6 }), distanceM: 55 };
    const farBig = { ...item("far", { area_total: 70, rooms: 3, house_type: "Кирпичный" }), distanceM: 1800 };
    const unknown = { ...item("unk", { rooms: null, house_type: null }), distanceM: null };
    expect(similarityPenalty(near, subject)).toBeLessThan(similarityPenalty(farBig, subject));
    expect(rankBySimilarity([farBig, unknown, near], subject).map((l) => l.sourceId)).toEqual(["near", "unk", "far"]);
  });

  it("уровни условий и название улицы для текстового поиска", () => {
    expect(level3Conditions(base)).toEqual(["материал стен", "расстояние ≤ 1 км"]);
    expect(streetQuery("Тверская улица")).toBe("Тверская");
    expect(streetQuery("ул. Новый Арбат")).toBe("Новый Арбат");
    expect(streetQuery("проспект Мира")).toBe("Мира");
  });
});

describe("итоговые ослабленные условия", () => {
  it("условия, вернувшиеся на следующем шаге, не считаются ослабленными", async () => {
    // на улице пусто; в городе с комнатами и площадью — достаточно
    const city = [1, 2, 3].map((n) => item(`k${n}`, { address: "Москва, Другая улица, 5", lat: 55.7505, lon: 37.6 }));
    const r = await cascadeSearch(base, subject, fakeApi(city));
    expect(r.relaxed).toEqual(["улица «Тестовая улица»"]);
    expect(r.applied).toEqual(expect.arrayContaining(["город: Москва", "комнаты", "площадь", "материал стен"]));
  });
});
