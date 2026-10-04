// Поиск аналогов у внешнего поставщика (Metrapi) и включение объявления в оценку.
// UI не обращается к поставщику напрямую: только к этому сервису через собственный API.
// Результаты поиска кэшируются (ListingSearch) — повторный запрос с теми же параметрами
// не расходует квоту. Включённый в оценку аналог хранит снимок исходных и нормализованных
// данных и не меняется при изменении объявления у источника.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/http";
import { logEvent } from "@/server/audit";
import { stableStringify, sha256 } from "@/server/stable";
import { metrapiConfigured, metrapiItem, metrapiSearch } from "@/server/integrations/metrapi";
import { nearestMetro, yandexConfigured } from "@/server/integrations/yandex";
import { METRAPI_PROVIDER } from "@/core/listings/metrapi";
import { applyLocalFilters, type LocalFilterStats, type RankedListing } from "@/core/listings/filter";
import type { Listing, ListingQuery } from "@/core/listings/model";
import { distanceM, toPoint } from "@/core/geo";
import { syncAdjustments } from "./assessment";

const CACHE_TTL_MS = 6 * 3_600_000;
const MAX_STORED = 1000;

export const SOURCE_NAMES: Record<string, string> = {
  avito: "Авито", cian: "ЦИАН", domclick: "ДомКлик", yandex: "Яндекс Недвижимость", farpost: "FarPost", move: "Move.ru", sob: "sob.ru", youla: "Юла",
};
export const sourceName = (code: string) => SOURCE_NAMES[code] ?? code;

/** Объявление для клиента: без исходных данных поставщика. */
export type ListingView = Omit<Listing, never> & { distanceM: number | null; inAssessment: { comparableId: string; status: string } | null };

export interface SearchMeta {
  id: string;
  provider: string;
  query: ListingQuery;
  total: number | null;
  stats: LocalFilterStats;
  createdAt: string;
  expiresAt: string;
  fromCache: boolean;
}

function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = /(?:^|,\s*)(?:г\.?|город)\s*([А-ЯЁ][а-яё-]+(?:\s[А-ЯЁ][а-яё-]+)?)/u.exec(address);
  if (m) return m[1];
  const first = address.split(",")[0]?.trim();
  return first && /^[А-ЯЁ][а-яё-]+(?:[\s-][А-ЯЁ][а-яё-]+)?$/u.test(first) && !/обл|край|респ/i.test(first) ? first : null;
}

/** Параметры поиска по умолчанию — из характеристик объекта оценки. Оценщик может изменить любой. */
export async function defaultListingQuery(assessmentId: string): Promise<ListingQuery & { hints: string[] }> {
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { property: true, building: true } });
  const p = a.property, b = a.building;
  const hints: string[] = [];
  const comps = ((p?.provenance as Record<string, { components?: Array<{ kind: string; name: string }> }> | null)?.latitude?.components ?? []);
  const provinces = comps.filter((c) => c.kind === "province");
  const region = provinces.length ? provinces[provinces.length - 1].name : null;
  const locality = comps.find((c) => c.kind === "locality")?.name ?? cityFromAddress(p?.address);
  const center = toPoint(p?.latitude, p?.longitude);
  if (!center) hints.push("Координаты объекта не определены — фильтр по расстоянию недоступен. Определите их в разделе «Объект».");
  if (!locality && !region) hints.push("Не удалось определить населённый пункт — укажите его вручную.");
  const area = p?.area ? Number(p.area) : null;
  const ref = a.valuationDate ?? new Date();
  const from = new Date(ref.getTime() - 180 * 86_400_000);
  return {
    region: locality ? null : region,
    locality,
    center,
    radiusM: center ? 2000 : null,
    rooms: p?.rooms ? [p.rooms] : [],
    areaMin: area ? Math.floor(area * 0.8) : null,
    areaMax: area ? Math.ceil(area * 1.2) : null,
    floorMin: null, floorMax: null, floorsMin: null, floorsMax: null,
    priceMin: null, priceMax: null, unitPriceMin: null, unitPriceMax: null,
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: a.valuationDate && a.valuationDate < new Date() ? a.valuationDate.toISOString().slice(0, 10) : null,
    buildYearMin: null, buildYearMax: null,
    wallMaterials: b?.wallMaterial ? [b.wallMaterial] : [],
    finishings: [],
    furniture: "any",
    sources: [],
    secondaryOnly: true,
    dedupe: true,
    limit: 300,
    hints,
  };
}

function toMeta(s: { id: string; provider: string; query: unknown; total: number | null; results: unknown; createdAt: Date; expiresAt: Date }, fromCache: boolean): SearchMeta {
  const r = s.results as { stats: LocalFilterStats };
  return { id: s.id, provider: s.provider, query: s.query as ListingQuery, total: s.total, stats: r.stats, createdAt: s.createdAt.toISOString(), expiresAt: s.expiresAt.toISOString(), fromCache };
}

/** Поиск объявлений. Повтор с теми же параметрами в течение 6 ч берётся из кэша. */
export async function searchListings(assessmentId: string, userId: string, query: ListingQuery, force = false): Promise<SearchMeta> {
  if (!metrapiConfigured()) throw new HttpError(503, "Metrapi не настроен: задайте METRAPI_API_KEY в переменных окружения");
  const queryHash = sha256(stableStringify(query));
  if (!force) {
    const cached = await prisma.listingSearch.findFirst({ where: { assessmentId, provider: METRAPI_PROVIDER, queryHash, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    if (cached) return toMeta(cached, true);
  }
  const { count, items } = await metrapiSearch(query);
  const { items: kept, stats } = applyLocalFilters(items, query);
  const saved = await prisma.listingSearch.create({
    data: {
      assessmentId,
      provider: METRAPI_PROVIDER,
      queryHash,
      query: query as unknown as Prisma.InputJsonValue,
      total: count,
      results: { stats, items: kept.slice(0, MAX_STORED) } as unknown as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
  });
  // старые результаты этой оценки больше не нужны — храним последние 5 поисков
  const old = await prisma.listingSearch.findMany({ where: { assessmentId }, orderBy: { createdAt: "desc" }, skip: 5, select: { id: true } });
  if (old.length) await prisma.listingSearch.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  await logEvent({ assessmentId, userId, action: "update", entity: "listing_search", entityId: saved.id, summary: `Поиск аналогов в Metrapi: получено ${stats.received}${count !== null ? ` из ${count}` : ""}, после фильтров ${stats.kept}` });
  return toMeta(saved, false);
}

async function loadSearch(assessmentId: string, searchId?: string | null) {
  const s = searchId
    ? await prisma.listingSearch.findFirst({ where: { id: searchId, assessmentId } })
    : await prisma.listingSearch.findFirst({ where: { assessmentId }, orderBy: { createdAt: "desc" } });
  return s;
}

const strip = (l: RankedListing): Omit<RankedListing, "raw"> => {
  const { raw: _raw, ...rest } = l;
  return { ...rest, description: rest.description && rest.description.length > 1500 ? `${rest.description.slice(0, 1500)}…` : rest.description };
};

/** Страница результатов последнего (или указанного) поиска + точки для карты. */
export async function listingsPage(assessmentId: string, opts: { searchId?: string | null; offset: number; limit: number; focus?: string | null }) {
  const s = await loadSearch(assessmentId, opts.searchId);
  if (!s) return { search: null, items: [], points: [], total: 0 };
  const all = (s.results as unknown as { items: RankedListing[] }).items ?? [];
  const comps = await prisma.comparable.findMany({ where: { assessmentId, provider: METRAPI_PROVIDER }, select: { id: true, externalId: true, status: true } });
  const byExt = new Map(comps.map((c) => [c.externalId, { comparableId: c.id, status: c.status }]));
  const view = (l: RankedListing): ListingView => ({ ...strip(l), inAssessment: byExt.get(l.externalId) ?? null });
  // focus — показать страницу, на которой находится объявление (переход с карты)
  const fi = opts.focus ? all.findIndex((l) => l.externalId === opts.focus) : -1;
  const offset = fi >= 0 ? Math.floor(fi / opts.limit) * opts.limit : opts.offset;
  return {
    search: toMeta(s, true),
    total: all.length,
    offset,
    items: all.slice(offset, offset + opts.limit).map(view),
    // для карты — только координаты и минимум полей (без тяжёлых данных)
    points: all.filter((l) => l.lat !== null && l.lon !== null).map((l) => ({ externalId: l.externalId, lat: l.lat!, lon: l.lon!, unitPrice: l.unitPrice, price: l.price, area: l.area, address: l.address, distanceM: l.distanceM, inAssessment: byExt.get(l.externalId)?.status ?? null })),
  };
}

const iso = (s: string | null) => {
  if (!s) return null;
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

/** Включить объявление из результатов поиска в оценку (по умолчанию — «На проверке»). */
export async function addListingToAssessment(assessmentId: string, userId: string, searchId: string, externalId: string, status: "use" | "review" = "review") {
  const s = await loadSearch(assessmentId, searchId);
  if (!s) throw new HttpError(404, "Результаты поиска не найдены — выполните поиск заново");
  const l = ((s.results as unknown as { items: RankedListing[] }).items ?? []).find((x) => x.externalId === externalId);
  if (!l) throw new HttpError(404, "Объявление не найдено в результатах поиска");
  if (l.price === null || l.area === null || l.area <= 0) throw new HttpError(422, "У объявления нет цены или площади — использовать его как аналог нельзя");
  const existing = await prisma.comparable.findFirst({ where: { assessmentId, provider: METRAPI_PROVIDER, externalId } });
  if (existing) return existing;

  const at = s.createdAt.toISOString();
  const src = { source: "metrapi", title: `Metrapi · ${sourceName(l.source)} (данные объявления на ${at.slice(0, 10)})`, at };
  const prov: Record<string, unknown> = {};
  for (const f of ["address", "price", "area", "rooms", "floor", "floors", "wallMaterial", "yearBuilt", "finishing", "furniture", "offerDate", "latitude", "longitude"]) prov[f] = src;

  // Расстояние до метро: та же методика, что у объекта оценки — по прямой до ближайшей станции (Яндекс).
  let metroDistanceM: number | null = null;
  if (yandexConfigured() && l.lat !== null && l.lon !== null) {
    try {
      const [m] = await nearestMetro({ lat: l.lat, lon: l.lon }, 5000, 1);
      if (m) {
        metroDistanceM = m.distanceM;
        prov.metroDistanceM = { source: "yandex", title: `Яндекс Геокодер: ${m.name}, по прямой от координат объявления`, at: new Date().toISOString() };
      }
    } catch (e) {
      console.error("Метро для аналога не определено", e);
    }
  }
  const property = await prisma.property.findUnique({ where: { assessmentId } });
  const center = toPoint(property?.latitude, property?.longitude);
  const max = await prisma.comparable.aggregate({ where: { assessmentId }, _max: { position: true } });
  const { raw, ...normalized } = l;
  const c = await prisma.comparable.create({
    data: {
      assessmentId,
      position: (max._max.position ?? 0) + 1,
      status,
      included: status === "use",
      sourceKind: `provider:${METRAPI_PROVIDER}`,
      provider: METRAPI_PROVIDER,
      externalId,
      sourceName: sourceName(l.source),
      sourceUrl: l.url,
      retrievedAt: s.createdAt,
      offerDate: iso(l.publishedAt),
      sourceUpdatedAt: iso(l.updatedAt),
      address: l.address,
      region: l.region,
      city: l.locality,
      district: l.district,
      price: String(l.price),
      area: String(l.area),
      rooms: l.rooms,
      floor: l.floor,
      floors: l.floors,
      wallMaterial: l.wallMaterial,
      houseType: l.houseTypeRaw,
      yearBuilt: l.buildYear,
      finishing: l.finishing,
      furniture: l.furniture,
      houseCondition: null,
      metroDistanceM,
      rights: null,
      latitude: l.lat !== null ? l.lat.toFixed(6) : null,
      longitude: l.lon !== null ? l.lon.toFixed(6) : null,
      distanceM: center && l.lat !== null && l.lon !== null ? distanceM(center, { lat: l.lat, lon: l.lon }) : null,
      photoUrl: l.photos[0] ?? null,
      description: l.description ? l.description.slice(0, 20_000) : null,
      rawData: raw as Prisma.InputJsonValue,
      normalized: normalized as unknown as Prisma.InputJsonValue,
      provenance: prov as Prisma.InputJsonValue,
    },
  });
  await logEvent({ assessmentId, userId, action: "create", entity: "comparable", entityId: c.id, summary: `Добавлен аналог из Metrapi (${sourceName(l.source)}): ${l.address ?? externalId}`, diff: { url: l.url, price: l.price, area: l.area } });
  await syncAdjustments(assessmentId);
  return c;
}

/** Сверка сохранённого снимка аналога с текущими данными объявления у источника. Ничего не меняет. */
export async function checkListingActuality(assessmentId: string, comparableId: string) {
  const c = await prisma.comparable.findFirst({ where: { id: comparableId, assessmentId } });
  if (!c || c.provider !== METRAPI_PROVIDER || !c.externalId) throw new HttpError(404, "Аналог не найден или добавлен не из Metrapi");
  const [source, ...rest] = c.externalId.split(":");
  const current = await metrapiItem(source, rest.join(":"));
  const saved = (c.normalized ?? {}) as Partial<Listing>;
  if (!current) return { found: false, changes: [] as Array<{ field: string; saved: unknown; current: unknown }>, delistedAt: null };
  const fields: Array<[keyof Listing, string]> = [["price", "Цена"], ["area", "Площадь"], ["rooms", "Комнаты"], ["floor", "Этаж"], ["floors", "Этажность"], ["renovationRaw", "Ремонт"], ["houseTypeRaw", "Тип дома"], ["updatedAt", "Дата обновления"]];
  const changes = fields.filter(([k]) => JSON.stringify(saved[k] ?? null) !== JSON.stringify(current[k] ?? null)).map(([k, label]) => ({ field: label, saved: saved[k] ?? null, current: current[k] ?? null }));
  return { found: true, changes, delistedAt: (current.raw.delisted_at as string | null) ?? null };
}
