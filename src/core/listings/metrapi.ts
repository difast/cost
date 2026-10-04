// Контракт Metrapi (https://api.metrapi.ru, документация API от 02.10.2026):
// формирование параметров GET /v1/items и нормализация объявления во внутреннюю модель.
// Чистые функции без сети — покрыты тестами. Поля и значения фильтров — строго из документации.

import type { Listing, ListingQuery, ListingSourceRef, ListingWithRaw } from "./model";

export const METRAPI_PROVIDER = "metrapi";

/** Значения фильтра house_type Metrapi ↔ коды материала стен в сервисе. */
export const METRAPI_HOUSE_TYPE: Record<string, string> = {
  "Кирпичный": "brick",
  "Панельный": "panel",
  "Монолитный": "monolith",
  "Монолитно-кирпичный": "monolith_brick",
  "Блочный": "block",
  "Деревянный": "wood",
};

/** Значения фильтра renovation Metrapi ↔ коды отделки в сервисе.
 *  Соответствие классов ремонта — решение сервиса, исходное значение всегда сохраняется. */
export const METRAPI_RENOVATION: Record<string, string> = {
  "Без отделки": "none",
  "Требует ремонта": "needs_repair",
  "Косметический": "standard",
  "Евроремонт": "improved",
  "Дизайнерский": "designer",
};

const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
const WALL_TO_METRAPI = invert(METRAPI_HOUSE_TYPE);
const FINISHING_TO_METRAPI = invert(METRAPI_RENOVATION);

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const int = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" ? String(v) : null);

/** Параметры запроса GET /v1/items. Фильтры комбинируются по И; мультизначения — повтором параметра. */
export function buildItemsParams(q: ListingQuery): URLSearchParams {
  const p = new URLSearchParams();
  p.set("deal_type", "sale");
  p.set("realty_type", "flat");
  const set = (k: string, v: string | number | null | undefined) => {
    if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  };
  set("region", q.region);
  set("locality", q.locality);
  set("district", q.district);
  set("q", q.q);
  for (const r of q.rooms ?? []) p.append("rooms", String(r));
  set("area_min", q.areaMin);
  set("area_max", q.areaMax);
  set("floor_min", q.floorMin);
  set("floor_max", q.floorMax);
  set("floors_min", q.floorsMin);
  set("floors_max", q.floorsMax);
  set("price_min", q.priceMin);
  set("price_max", q.priceMax);
  set("date_from", q.dateFrom);
  set("date_to", q.dateTo);
  set("build_year_min", q.buildYearMin);
  set("build_year_max", q.buildYearMax);
  for (const w of q.wallMaterials ?? []) if (WALL_TO_METRAPI[w]) p.append("house_type", WALL_TO_METRAPI[w]);
  for (const f of q.finishings ?? []) if (FINISHING_TO_METRAPI[f]) p.append("renovation", FINISHING_TO_METRAPI[f]);
  for (const s of q.sources ?? []) p.append("source", s);
  if (q.secondaryOnly) p.set("exclude_build_status", "new");
  if (q.dedupe) p.set("dedupe", "true");
  p.set("limit", String(Math.min(Math.max(q.limit ?? 200, 1), 1000)));
  return p;
}

/** Нормализация объявления Metrapi. Неизвестные/пустые поля — null; исходный объект сохраняется в raw. */
export function normalizeMetrapiItem(raw: Record<string, unknown>): ListingWithRaw | null {
  const source = str(raw.source);
  const sourceId = str(raw.source_id);
  if (!source || !sourceId) return null;
  const price = num(raw.price);
  const area = num(raw.area_total);
  const houseTypeRaw = str(raw.house_type);
  const renovationRaw = str(raw.renovation);
  const amenities = Array.isArray(raw.amenities) ? raw.amenities.filter((x): x is string => typeof x === "string") : [];
  const lat = num(raw.lat);
  const lon = num(raw.lon);
  const sources: ListingSourceRef[] = Array.isArray(raw.sources)
    ? (raw.sources as Array<Record<string, unknown>>).map((s) => ({ source: str(s.source) ?? "", price: num(s.price), url: str(s.url) })).filter((s) => s.source)
    : [];
  const listing: Listing = {
    provider: METRAPI_PROVIDER,
    externalId: `${source}:${sourceId}`,
    source,
    sourceId,
    url: str(raw.url),
    title: str(raw.title),
    description: str(raw.description),
    address: str(raw.address),
    region: str(raw.region),
    locality: str(raw.locality),
    district: str(raw.district),
    lat: lat !== null && Math.abs(lat) <= 90 ? lat : null,
    lon: lon !== null && Math.abs(lon) <= 180 ? lon : null,
    price,
    unitPrice: price !== null && area !== null && area > 0 ? Math.round((price / area) * 100) / 100 : null,
    area,
    livingArea: num(raw.area_living),
    kitchenArea: num(raw.area_kitchen),
    rooms: int(raw.rooms),
    floor: int(raw.floor),
    floors: int(raw.floors_total),
    buildYear: int(raw.build_year),
    houseTypeRaw,
    wallMaterial: houseTypeRaw ? METRAPI_HOUSE_TYPE[houseTypeRaw] ?? null : null,
    renovationRaw,
    finishing: renovationRaw ? METRAPI_RENOVATION[renovationRaw] ?? null : null,
    // Отдельного поля «мебель» в API нет: признак есть, только если мебель перечислена в удобствах.
    furniture: amenities.some((a) => /мебел/i.test(a)) ? true : null,
    buildStatus: str(raw.build_status),
    metroName: str(raw.metro),
    metroMinutes: int(raw.metro_minutes),
    metroMode: str(raw.metro_mode),
    publishedAt: str(raw.published_at),
    updatedAt: str(raw.updated_at),
    photos: Array.isArray(raw.photos) ? raw.photos.filter((x): x is string => typeof x === "string").slice(0, 12) : [],
    sellerType: str(raw.seller_type),
    saleType: str(raw.sale_type),
    sources,
    groupId: str(raw.group_id),
  };
  return { ...listing, raw };
}

/** Разбор тела ответа /v1/items: { count, items, next_cursor? }. */
export function parseItemsResponse(json: unknown): { count: number | null; items: ListingWithRaw[]; nextCursor: string | null } {
  const o = (json ?? {}) as { count?: unknown; items?: unknown; next_cursor?: unknown };
  const items = Array.isArray(o.items) ? o.items.map((x) => normalizeMetrapiItem((x ?? {}) as Record<string, unknown>)).filter((x): x is ListingWithRaw => !!x) : [];
  return { count: num(o.count), items, nextCursor: str(o.next_cursor) };
}

/** Описание ошибки Metrapi по коду ответа (раздел «Коды ответов»). */
export function metrapiErrorText(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown })?.detail;
  const reason = typeof detail === "object" && detail ? (detail as { reason?: string }).reason : typeof detail === "string" ? detail : null;
  switch (status) {
    case 400: return `Metrapi: недопустимое сочетание параметров${reason ? ` (${reason})` : ""}`;
    case 401: return "Metrapi: не передан ключ API — задайте METRAPI_API_KEY";
    case 403: return "Metrapi: ключ API неверный или функция не входит в доступ";
    case 404: return "Metrapi: объявление не найдено или скрыто из выдачи";
    case 422: return `Metrapi: параметр не прошёл проверку${reason ? ` (${reason})` : typeof detail === "object" ? ` (${JSON.stringify(detail)})` : ""}`;
    case 429: return reason === "too_soon" ? "Metrapi: слишком частые запросы, повторите через несколько секунд" : "Metrapi: исчерпана суточная квота запросов";
    case 503: return "Metrapi временно недоступен, повторите позже";
    default: return `Metrapi вернул ошибку (HTTP ${status})`;
  }
}
