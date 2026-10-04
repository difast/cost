// HTTP-клиент Metrapi. Ключ — только из окружения (METRAPI_API_KEY), передаётся в заголовке X-Api-Key
// и никогда не уходит в браузер. Лимит частоты по документации: /v1/items и /v1/item/{…} —
// не чаще 1 запроса в 2 секунды на ключ (общий счётчик). При 429 too_soon ждём retry_after из тела.

import { HttpError } from "@/server/http";
import { metrapiErrorText, parseItemsResponse, buildItemsParams, normalizeMetrapiItem } from "@/core/listings/metrapi";
import type { ListingQuery, ListingWithRaw } from "@/core/listings/model";

const BASE_URL = () => (process.env.METRAPI_API_URL || "https://api.metrapi.ru").replace(/\/+$/, "");
const apiKey = () => process.env.METRAPI_API_KEY?.trim() || "";
const TIMEOUT_MS = 25_000;
const READ_GAP_MS = 2_000;
const MAX_RETRY_WAIT_S = 10;

export const metrapiConfigured = () => Boolean(apiKey());

// Очередь запросов чтения: следующий запрос стартует не раньше чем через 2 с после предыдущего.
let readChain: Promise<void> = Promise.resolve();
let lastReadAt = 0;
function throttleRead(): Promise<void> {
  const slot = readChain.then(async () => {
    const wait = lastReadAt + READ_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastReadAt = Date.now();
  });
  readChain = slot.catch(() => undefined);
  return slot;
}

async function request(path: string, params?: URLSearchParams, attempt = 0): Promise<unknown> {
  if (!apiKey()) throw new HttpError(503, "Metrapi не настроен: задайте METRAPI_API_KEY в переменных окружения");
  await throttleRead();
  const url = `${BASE_URL()}${path}${params && [...params].length ? `?${params}` : ""}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "X-Api-Key": apiKey(), Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    console.error("Metrapi: сетевая ошибка", e);
    throw new HttpError(502, "Metrapi недоступен. Повторите попытку позже.");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.status === 429 && attempt === 0) {
    const retry = Number((body as { detail?: { retry_after?: unknown } })?.detail?.retry_after);
    if (Number.isFinite(retry) && retry >= 0 && retry <= MAX_RETRY_WAIT_S) {
      await new Promise((r) => setTimeout(r, retry * 1000 + 100));
      return request(path, params, 1);
    }
  }
  if (!res.ok) {
    if (res.status === 404 && path.startsWith("/v1/item/")) return null;
    throw new HttpError(res.status === 429 || res.status === 503 ? 503 : 502, metrapiErrorText(res.status, body));
  }
  return body;
}

/** Поиск объявлений: GET /v1/items. */
export async function metrapiSearch(q: ListingQuery): Promise<{ count: number | null; items: ListingWithRaw[] }> {
  const json = await request("/v1/items", buildItemsParams(q));
  const r = parseItemsResponse(json);
  return { count: r.count, items: r.items };
}

/** Одно объявление: GET /v1/item/{source}/{source_id}. null — не найдено или скрыто. */
export async function metrapiItem(source: string, sourceId: string): Promise<ListingWithRaw | null> {
  const json = await request(`/v1/item/${encodeURIComponent(source)}/${encodeURIComponent(sourceId)}`);
  if (!json) return null;
  const o = json as { item?: unknown };
  // ответ может содержать объект объявления напрямую или в поле item (404 приходит как { item: null })
  const raw = (o && typeof o === "object" && "item" in o ? o.item : json) as Record<string, unknown> | null;
  return raw ? normalizeMetrapiItem(raw) : null;
}

let sourcesCache: { at: number; list: Array<{ code: string; name: string; status: string }> } | null = null;

/** Список площадок: GET /v1/sources (кэш на сутки). */
export async function metrapiSources(): Promise<Array<{ code: string; name: string; status: string }>> {
  if (sourcesCache && Date.now() - sourcesCache.at < 86_400_000) return sourcesCache.list;
  const json = (await request("/v1/sources")) as { sources?: Array<{ code?: string; name?: string; status?: string }> } | null;
  const list = (json?.sources ?? []).filter((s) => s.code).map((s) => ({ code: s.code!, name: s.name ?? s.code!, status: s.status ?? "" }));
  sourcesCache = { at: Date.now(), list };
  return list;
}
