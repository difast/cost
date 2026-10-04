import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { metrapiItem, metrapiSearch } from "./metrapi";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  process.env.METRAPI_API_KEY = "metrapi_test";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.METRAPI_API_KEY;
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("клиент Metrapi", () => {
  it("ключ в заголовке X-Api-Key, запрос к /v1/items; 429 too_soon → ожидание retry_after и повтор; интервал ≥ 2 с", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ detail: { reason: "too_soon", retry_after: 0 } }, 429))
      .mockResolvedValueOnce(json({ count: 1, items: [{ source: "cian", source_id: "7", price: 1, area_total: 1 }] }));
    const t0 = Date.now();
    const r = await metrapiSearch({ locality: "Москва" });
    expect(r.items[0].externalId).toBe("cian:7");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/api\.metrapi\.ru\/v1\/items\?/);
    expect((init as RequestInit).headers).toMatchObject({ "X-Api-Key": "metrapi_test" });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(1900); // второй запрос — не раньше чем через 2 с
  }, 15_000);

  it("без ключа запрос не отправляется", async () => {
    delete process.env.METRAPI_API_KEY;
    await expect(metrapiSearch({ locality: "Москва" })).rejects.toThrow(/METRAPI_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404 по объявлению → null; суточная квота → понятная ошибка", async () => {
    fetchMock.mockResolvedValueOnce(json({ item: null, detail: "not_found" }, 404));
    expect(await metrapiItem("avito", "1")).toBeNull();
    fetchMock.mockResolvedValueOnce(json({ detail: "daily limit exceeded" }, 429));
    await expect(metrapiSearch({ locality: "Москва" })).rejects.toThrow(/квота/);
  }, 15_000);
});
