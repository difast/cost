import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { distanceM, geocode, geocodeMany, nearestMetro, parseGeocoderResponse, parseSearchResponse, reverseGeocode, searchOrganizations } from "./yandex";
import { collectInfrastructure } from "@/server/services/infrastructure";
import { INFRA_CATEGORIES } from "@/core/infrastructure";

// Ответы в формате, описанном в документации Яндекса (структура полей, не реальные данные).
const geoResp = (objs: Array<{ name: string; pos: string; kind?: string; precision?: string; formatted?: string; description?: string }>) => ({
  response: {
    GeoObjectCollection: {
      metaDataProperty: { GeocoderResponseMetaData: { request: "q", found: String(objs.length), results: "10" } },
      featureMember: objs.map((o) => ({
        GeoObject: {
          name: o.name,
          description: o.description,
          Point: { pos: o.pos },
          metaDataProperty: { GeocoderMetaData: { kind: o.kind ?? "house", precision: o.precision ?? "exact", text: `Россия, ${o.formatted ?? o.name}`, Address: { formatted: o.formatted ?? o.name } } },
        },
      })),
    },
  },
});
const bizResp = (items: Array<{ name: string; lon: number; lat: number; address: string; category: string }>) => ({
  type: "FeatureCollection",
  features: items.map((i, n) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [i.lon, i.lat] },
    properties: { name: i.name, description: i.address, CompanyMetaData: { id: String(n), name: i.name, address: i.address, Categories: [{ class: "x", name: i.category }] } },
  })),
});

const C = { lat: 55.75, lon: 37.6 };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.YANDEX_API_KEY = "test-key";
  delete process.env.YANDEX_SEARCH_API_KEY;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.YANDEX_API_KEY;
});
const respond = (body: unknown, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const lastUrl = () => new URL(String(fetchMock.mock.calls.at(-1)![0]));

describe("расстояние", () => {
  it("по прямой, в метрах", () => {
    expect(distanceM(C, C)).toBe(0);
    // 0.01° широты ≈ 1112 м
    expect(distanceM(C, { lat: 55.76, lon: 37.6 })).toBeGreaterThan(1100);
    expect(distanceM(C, { lat: 55.76, lon: 37.6 })).toBeLessThan(1120);
  });
});

describe("геокодер", () => {
  it("адрес → координаты; ключ и параметры передаются в запросе", async () => {
    respond(geoResp([{ name: "улица Новый Арбат, 24", pos: "37.587614 55.753083", formatted: "Москва, улица Новый Арбат, 24" }]));
    const r = await geocode("Москва, Новый Арбат, 24");
    expect(r).toEqual({ lat: 55.753083, lon: 37.587614, formatted: "Москва, улица Новый Арбат, 24", kind: "house", precision: "exact", components: [] });
    const u = lastUrl();
    expect(u.searchParams.get("apikey")).toBe("test-key");
    expect(u.searchParams.get("format")).toBe("json");
    expect(u.searchParams.get("geocode")).toBe("Москва, Новый Арбат, 24");
  });

  it("пустой ответ — null", async () => {
    respond(geoResp([]));
    expect(await geocode("нет такого")).toBeNull();
  });

  it("координаты → адрес: долгота первой, kind=house", async () => {
    respond(geoResp([{ name: "улица Новый Арбат, 24", pos: "37.587614 55.753083", formatted: "Москва, улица Новый Арбат, 24" }]));
    const r = await reverseGeocode({ lat: 55.753083, lon: 37.587614 });
    expect(r?.formatted).toBe("Москва, улица Новый Арбат, 24");
    expect(lastUrl().searchParams.get("geocode")).toBe("37.587614,55.753083");
    expect(lastUrl().searchParams.get("kind")).toBe("house");
  });

  it("метро: сортировка по расстоянию и отсечение по радиусу", async () => {
    respond(geoResp([
      { name: "метро Дальняя", pos: "37.7 55.75", kind: "metro", description: "Линия 2" },
      { name: "метро Ближняя", pos: "37.601 55.751", kind: "metro", description: "Линия 1" },
    ]));
    const r = await nearestMetro(C, 3000, 5);
    expect(r.map((x) => x.name)).toEqual(["метро Ближняя"]);
    expect(r[0].type).toBe("Станция метро");
    expect(lastUrl().searchParams.get("kind")).toBe("metro");
  });

  it("без ключа — понятная ошибка, запрос не отправляется", async () => {
    delete process.env.YANDEX_API_KEY;
    await expect(geocode("Москва")).rejects.toThrow(/YANDEX_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("отклонённый ключ — ошибка с кодом", async () => {
    respond({ message: "Invalid key" }, 403);
    await expect(geocode("Москва")).rejects.toThrow(/ключ API отклонён/);
  });
});

describe("поиск по организациям", () => {
  it("разбирает GeoJSON и считает расстояние", () => {
    const r = parseSearchResponse(bizResp([{ name: "Аптека 1", lon: 37.601, lat: 55.75, address: "ул. Тестовая, 1", category: "Аптека" }]), C);
    expect(r[0]).toMatchObject({ name: "Аптека 1", type: "Аптека", address: "ул. Тестовая, 1" });
    expect(r[0].distanceM).toBeGreaterThan(50);
    expect(parseGeocoderResponse({})).toEqual([]);
  });

  it("строгая область поиска вокруг точки", async () => {
    respond(bizResp([]));
    await searchOrganizations("аптека", C, 1000);
    const u = lastUrl();
    expect(u.searchParams.get("type")).toBe("biz");
    expect(u.searchParams.get("ll")).toBe("37.6,55.75");
    expect(u.searchParams.get("rspn")).toBe("1");
    expect(u.searchParams.get("text")).toBe("аптека");
  });

  it("отдельный ключ для поиска, если задан", async () => {
    process.env.YANDEX_SEARCH_API_KEY = "search-key";
    respond(bizResp([]));
    await searchOrganizations("школа", C, 1000);
    expect(lastUrl().searchParams.get("apikey")).toBe("search-key");
  });
});

describe("сбор инфраструктуры", () => {
  it("все категории; ошибка одной не ломает остальные; объекты дальше радиуса отбрасываются", async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const u = new URL(String(input));
      if (u.searchParams.get("kind") === "metro") return new Response(JSON.stringify(geoResp([{ name: "метро Ближняя", pos: "37.601 55.751", kind: "metro" }])));
      const text = u.searchParams.get("text");
      if (text === "больница") return new Response("{}", { status: 500 });
      return new Response(JSON.stringify(bizResp([
        { name: `${text} далеко`, lon: 37.7, lat: 55.8, address: "далеко", category: String(text) },
        { name: `${text} рядом`, lon: 37.6005, lat: 55.7505, address: "рядом", category: String(text) },
      ])));
    });
    const s = await collectInfrastructure(C);
    expect(s.categories.map((c) => c.key)).toEqual(INFRA_CATEGORIES.map((c) => c.key));
    const byKey = Object.fromEntries(s.categories.map((c) => [c.key, c]));
    expect(byKey.hospital.status).toBe("error");
    expect(byKey.pharmacy.items.map((i) => i.name)).toEqual(["аптека рядом"]);
    expect(byKey.metro.items[0].name).toBe("метро Ближняя");
    expect(s.center).toEqual(C);
  });
});

describe("геокодер: несколько результатов и ошибки API", () => {
  it("несколько вариантов адреса", async () => {
    respond(geoResp([
      { name: "Тверская улица, 1", pos: "37.61 55.757", formatted: "Москва, Тверская улица, 1" },
      { name: "Тверская улица, 1", pos: "35.9 56.86", formatted: "Тверь, Тверская улица, 1", precision: "street", kind: "street" },
    ]));
    const r = await geocodeMany("Тверская 1", 5);
    expect(r.map((x) => x.formatted)).toEqual(["Москва, Тверская улица, 1", "Тверь, Тверская улица, 1"]);
    expect(r[1].precision).toBe("street");
    expect(lastUrl().searchParams.get("results")).toBe("5");
  });
  it("лимит запросов (429) — понятная ошибка 429", async () => {
    respond({ message: "Too Many Requests" }, 429);
    await expect(geocode("Москва")).rejects.toMatchObject({ status: 429, message: expect.stringContaining("лимит запросов") });
  });
  it("ошибка сервиса (500) — ошибка 502 с кодом", async () => {
    respond({}, 500);
    await expect(geocode("Москва")).rejects.toMatchObject({ status: 502, message: expect.stringContaining("HTTP 500") });
  });
  it("таймаут — ошибка 504, без зависания", async () => {
    process.env.YANDEX_TIMEOUT_MS = "30";
    fetchMock.mockImplementationOnce((_u: unknown, init: { signal: AbortSignal }) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(init.signal.reason))));
    await expect(geocode("Москва")).rejects.toMatchObject({ status: 504, message: expect.stringContaining("не ответил") });
    delete process.env.YANDEX_TIMEOUT_MS;
  });
  it("сетевая ошибка — 502 «недоступен»", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(geocode("Москва")).rejects.toMatchObject({ status: 502, message: expect.stringContaining("недоступен") });
  });
  it("некорректный ответ — ошибка, а не падение", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    await expect(geocode("Москва")).rejects.toMatchObject({ status: 502 });
  });
});

describe("организации: пустой результат", () => {
  it("ни одной организации в радиусе — категории пустые, статус ok", async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const u = new URL(String(input));
      if (u.searchParams.get("kind") === "metro") return new Response(JSON.stringify(geoResp([])));
      return new Response(JSON.stringify(bizResp([])));
    });
    const s = await collectInfrastructure(C);
    expect(s.categories.every((c) => c.status === "empty" && c.items.length === 0)).toBe(true);
  });
  it("организация: название, тип, адрес, расстояние, координаты", () => {
    const [p] = parseSearchResponse(bizResp([{ name: "Аптека", lon: 37.601, lat: 55.751, address: "ул. Тестовая, 2", category: "Аптека" }]), C);
    expect(p).toMatchObject({ name: "Аптека", type: "Аптека", address: "ул. Тестовая, 2", lat: 55.751, lon: 37.601 });
    expect(p.distanceM).toBeGreaterThan(100);
  });
});
