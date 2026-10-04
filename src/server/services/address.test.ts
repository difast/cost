// Подсказки адреса: ГАР → Яндекс Геокодер; сохранение разобранного адреса; карта без координат.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gar = vi.hoisted(() => ({ available: false, hits: [] as unknown[] }));
vi.mock("@/server/gar", () => ({ garAvailable: async () => gar.available, searchGar: async () => gar.hits }));

import { suggestAddresses } from "./address";
import { detailsFromYandex } from "@/core/address";
import { subjectPoint } from "@/components/workspace/mapPoints";

// Ответ в формате HTTP Геокодера (структура по документации, данные тестовые).
const geo = (objs: Array<{ formatted: string; pos: string; precision?: string; components?: Array<{ kind: string; name: string }> }>) => ({
  response: { GeoObjectCollection: { featureMember: objs.map((o) => ({ GeoObject: { name: o.formatted, Point: { pos: o.pos }, metaDataProperty: { GeocoderMetaData: { kind: "house", precision: o.precision ?? "exact", Address: { formatted: o.formatted, Components: o.components ?? [] } } } } })) } },
});
const comps = [
  { kind: "country", name: "Россия" }, { kind: "province", name: "Центральный федеральный округ" }, { kind: "province", name: "Москва" },
  { kind: "locality", name: "Москва" }, { kind: "street", name: "Тестовая улица" }, { kind: "house", name: "1" },
];

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  process.env.YANDEX_API_KEY = "test-key";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  gar.available = false;
  gar.hits = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.YANDEX_API_KEY;
});

describe("подсказки адреса", () => {
  it("ГАР загружен и нашёл адрес — подсказки ГАР с идентификаторами, геокодер не вызывается", async () => {
    gar.available = true;
    gar.hits = [{ guid: "g-1", objectId: "100", fullAddress: "г. Москва, ул. Тестовая, д. 1", region: "Москва", municipality: null, locality: "Москва", street: "Тестовая", house: "1" }];
    const r = await suggestAddresses("тестовая 1", null);
    expect(r.items[0]).toMatchObject({ source: "gar", guid: "g-1", objectId: "100", street: "Тестовая", house: "1", lat: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ГАР не загружен — несколько вариантов геокодера с разобранным адресом и координатами; повтор берётся из кэша", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(geo([
      { formatted: "Москва, Тестовая улица, 1", pos: "37.6 55.75", components: comps },
      { formatted: "Тверь, Тестовая улица, 1", pos: "35.9 56.86", precision: "street" },
    ]))));
    const r = await suggestAddresses("Тестовая 1 кэш", null);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ source: "yandex", region: "Москва", locality: "Москва", street: "Тестовая улица", house: "1", lat: 55.75, lon: 37.6 });
    expect(r.items[1].precision).toBe("street");
    const again = await suggestAddresses("тестовая 1  КЭШ", null);
    expect(again.items).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ошибка или лимит геокодера — пустой список и предупреждение, без исключения", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    const r = await suggestAddresses("Лимитная 5", null);
    expect(r.items).toEqual([]);
    expect(r.warning).toContain("лимит запросов");
  });

  it("геокодер ничего не нашёл — пустой список без предупреждения", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(geo([]))));
    const r = await suggestAddresses("Несуществующая 999", null);
    expect(r).toMatchObject({ items: [], warning: null });
  });

  it("без ГАР и без ключа — предупреждение, ввод вручную остаётся", async () => {
    delete process.env.YANDEX_API_KEY;
    const r = await suggestAddresses("Тестовая 1 без ключа", null);
    expect(r.items).toEqual([]);
    expect(r.warning).toContain("YANDEX_API_KEY");
  });
});

describe("разобранный адрес и карта", () => {
  it("компоненты геокодера → регион, населённый пункт, улица, дом", () => {
    expect(detailsFromYandex("Москва, Тестовая улица, 1", comps, "2026-10-01T00:00:00Z")).toMatchObject({
      source: "yandex", normalized: "Москва, Тестовая улица, 1", region: "Москва", locality: "Москва", street: "Тестовая улица", house: "1", garGuid: null,
    });
  });
  it("карта без координат — метки объекта нет; с координатами — есть", () => {
    expect(subjectPoint(null, null, "адрес")).toBeNull();
    expect(subjectPoint("", "37.6", "адрес")).toBeNull();
    expect(subjectPoint("200", "37.6", "адрес")).toBeNull();
    expect(subjectPoint("55.753083", "37.587614", "Москва")).toMatchObject({ kind: "subject", lat: 55.753083, lon: 37.587614, title: "Объект оценки" });
  });
});
