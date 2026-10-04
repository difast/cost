// Адаптер официальных HTTP API Яндекс Карт:
//   • HTTP Геокодер — адрес → координаты, координаты → адрес, ближайшие станции метро;
//     https://yandex.ru/dev/geocode/doc/ru/
//   • API Поиска по организациям — организации вокруг точки.
//     https://yandex.ru/dev/geosearch/doc/ru/
// Ключ берётся только из окружения (YANDEX_API_KEY) и никогда не передаётся в браузер.

import { HttpError } from "@/server/http";
import { distanceM, type GeoPoint } from "@/core/geo";

export { distanceM, type GeoPoint };

const GEOCODER_URL = process.env.YANDEX_GEOCODER_URL || "https://geocode-maps.yandex.ru/1.x/";
const SEARCH_URL = process.env.YANDEX_SEARCH_URL || "https://search-maps.yandex.ru/v1/";
const TIMEOUT_MS = 10_000;

/** Ключ геокодера. */
const geocoderKey = () => process.env.YANDEX_API_KEY?.trim() || "";
/** Ключ поиска по организациям. В Кабинете разработчика это отдельный продукт —
 *  если для него выпущен отдельный ключ, его можно задать в YANDEX_SEARCH_API_KEY. */
const searchKey = () => process.env.YANDEX_SEARCH_API_KEY?.trim() || geocoderKey();

export const yandexConfigured = () => Boolean(geocoderKey());


export interface GeocodeResult extends GeoPoint {
  /** Адрес в написании геокодера. */
  formatted: string;
  /** Тип найденного объекта: house, street, locality… */
  kind: string;
  /** Точность: exact, number, near, range, street, other. */
  precision: string;
  /** Компоненты адреса: province (субъект), area, locality (населённый пункт), district, street, house… */
  components: Array<{ kind: string; name: string }>;
}

export interface Place extends GeoPoint {
  name: string;
  /** Вид организации (рубрика Яндекса) или тип объекта. */
  type: string | null;
  address: string | null;
  /** Расстояние по прямой от объекта оценки, м. */
  distanceM: number;
  yandexId?: string | null;
}

function requireKey(key: string, what: string) {
  if (!key) throw new HttpError(503, `${what} не настроен: задайте YANDEX_API_KEY в переменных окружения`);
}

async function getJson(url: URL, what: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" }, cache: "no-store" });
  } catch (e) {
    console.error(`${what}: сетевая ошибка`, e);
    throw new HttpError(502, `${what} недоступен. Повторите попытку позже.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(502, `${what}: ключ API отклонён (HTTP ${res.status}). Проверьте, что ключ активен и подключён к этому сервису Яндекса.`);
  }
  if (res.status === 429) throw new HttpError(502, `${what}: превышен лимит запросов по ключу API.`);
  if (!res.ok) throw new HttpError(502, `${what} вернул ошибку (HTTP ${res.status}).`);
  try {
    return await res.json();
  } catch {
    throw new HttpError(502, `${what} вернул некорректный ответ.`);
  }
}

// ── Геокодер ────────────────────────────────────────────────────────────────

interface GeoObject {
  name?: string;
  description?: string;
  Point?: { pos?: string };
  metaDataProperty?: { GeocoderMetaData?: { kind?: string; precision?: string; text?: string; Address?: { formatted?: string; Components?: Array<{ kind?: string; name?: string }> } } };
}

function parsePos(pos: string | undefined): GeoPoint | null {
  const [lon, lat] = (pos ?? "").split(" ").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/** Разбор ответа HTTP Геокодера (format=json). */
export function parseGeocoderResponse(json: unknown): GeoObject[] {
  const members = (json as { response?: { GeoObjectCollection?: { featureMember?: Array<{ GeoObject?: GeoObject }> } } })?.response?.GeoObjectCollection?.featureMember;
  return Array.isArray(members) ? members.map((m) => m.GeoObject).filter((g): g is GeoObject => !!g) : [];
}

async function geocoderRequest(params: Record<string, string>) {
  requireKey(geocoderKey(), "Геокодер Яндекса");
  const url = new URL(GEOCODER_URL);
  url.searchParams.set("apikey", geocoderKey());
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "ru_RU");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return parseGeocoderResponse(await getJson(url, "Геокодер Яндекса"));
}

function toGeocodeResult(g: GeoObject): GeocodeResult | null {
  const pt = parsePos(g.Point?.pos);
  if (!pt) return null;
  const meta = g.metaDataProperty?.GeocoderMetaData;
  const components = (meta?.Address?.Components ?? []).filter((c) => c.kind && c.name).map((c) => ({ kind: c.kind!, name: c.name! }));
  return { ...pt, formatted: meta?.Address?.formatted || meta?.text || g.name || "", kind: meta?.kind ?? "other", precision: meta?.precision ?? "other", components };
}

/** Прямое геокодирование: адрес → координаты. */
export async function geocode(address: string): Promise<GeocodeResult | null> {
  const [first] = await geocoderRequest({ geocode: address, results: "1" });
  return first ? toGeocodeResult(first) : null;
}

/** Обратное геокодирование: координаты → адрес (ближайший дом). */
export async function reverseGeocode(p: GeoPoint): Promise<GeocodeResult | null> {
  const [first] = await geocoderRequest({ geocode: `${p.lon},${p.lat}`, sco: "longlat", kind: "house", results: "1" });
  if (first) return toGeocodeResult(first);
  // за пределами застройки дома может не быть — берём любой ближайший топоним
  const [any] = await geocoderRequest({ geocode: `${p.lon},${p.lat}`, sco: "longlat", results: "1" });
  return any ? toGeocodeResult(any) : null;
}

/** Ближайшие станции метро (обратное геокодирование с kind=metro). */
export async function nearestMetro(p: GeoPoint, maxDistanceM: number, limit: number): Promise<Place[]> {
  const items = await geocoderRequest({ geocode: `${p.lon},${p.lat}`, sco: "longlat", kind: "metro", results: String(Math.max(limit * 2, 5)) });
  return items
    .map((g): Place | null => {
      const pt = parsePos(g.Point?.pos);
      if (!pt) return null;
      return { ...pt, name: g.name ?? "Станция метро", type: "Станция метро", address: g.description ?? null, distanceM: distanceM(p, pt) };
    })
    .filter((x): x is Place => !!x && x.distanceM <= maxDistanceM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

// ── Поиск по организациям ───────────────────────────────────────────────────

interface SearchFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    description?: string;
    CompanyMetaData?: { id?: string; name?: string; address?: string; Categories?: Array<{ name?: string; class?: string }> };
  };
}

/** Разбор ответа API Поиска по организациям (GeoJSON FeatureCollection). */
export function parseSearchResponse(json: unknown, center: GeoPoint): Place[] {
  const features = (json as { features?: SearchFeature[] })?.features;
  if (!Array.isArray(features)) return [];
  return features
    .map((f): Place | null => {
      const c = f.geometry?.coordinates;
      if (!Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
      const pt = { lon: c[0], lat: c[1] };
      const meta = f.properties?.CompanyMetaData;
      return {
        ...pt,
        name: meta?.name || f.properties?.name || "Без названия",
        type: meta?.Categories?.map((x) => x.name).filter(Boolean).join(", ") || null,
        address: meta?.address || f.properties?.description || null,
        distanceM: distanceM(center, pt),
        yandexId: meta?.id ?? null,
      };
    })
    .filter((x): x is Place => !!x);
}

/** Организации по запросу в квадрате вокруг точки (без выхода за его пределы). */
export async function searchOrganizations(text: string, center: GeoPoint, radiusM: number, results = 20): Promise<Place[]> {
  requireKey(searchKey(), "Поиск по организациям Яндекса");
  const latSpan = (2 * radiusM) / 111_320;
  const lonSpan = latSpan / Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01);
  const url = new URL(SEARCH_URL);
  url.searchParams.set("apikey", searchKey());
  url.searchParams.set("text", text);
  url.searchParams.set("lang", "ru_RU");
  url.searchParams.set("type", "biz");
  url.searchParams.set("ll", `${center.lon},${center.lat}`);
  url.searchParams.set("spn", `${lonSpan.toFixed(6)},${latSpan.toFixed(6)}`);
  url.searchParams.set("rspn", "1");
  url.searchParams.set("results", String(results));
  return parseSearchResponse(await getJson(url, "Поиск по организациям Яндекса"), center);
}
