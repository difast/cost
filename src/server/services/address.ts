// Подсказки адреса: ГАР (если загружен) → Яндекс Геокодер (несколько вариантов).
// Ответы геокодера кэшируются в памяти на 10 минут, чтобы ввод с задержкой не расходовал лимит ключа.

import { HttpError } from "../http";
import { garAvailable, searchGar } from "../gar";
import { geocodeMany, yandexConfigured, type GeocodeResult } from "../integrations/yandex";
import { detailsFromYandex, type AddressSuggestion } from "@/core/address";

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 300;
const cache = new Map<string, { at: number; items: GeocodeResult[] }>();

async function cachedGeocode(q: string): Promise<GeocodeResult[]> {
  const key = q.trim().toLowerCase().replace(/\s+/g, " ");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.items;
  const items = await geocodeMany(q, 5);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), items });
  return items;
}

export function suggestionFromGeocode(r: GeocodeResult, n: number): AddressSuggestion {
  const d = detailsFromYandex(r.formatted, r.components);
  return {
    id: `y:${n}:${r.lat.toFixed(6)},${r.lon.toFixed(6)}`, source: "yandex", fullAddress: r.formatted,
    region: d.region, municipality: d.municipality, locality: d.locality, district: d.district, street: d.street, house: d.house,
    guid: null, objectId: null, lat: r.lat, lon: r.lon, precision: r.precision,
  };
}

export async function suggestAddresses(q: string, regionCode: number | null): Promise<{ items: AddressSuggestion[]; sources: Array<"gar" | "yandex">; warning: string | null }> {
  const sources: Array<"gar" | "yandex"> = [];
  if (await garAvailable()) {
    sources.push("gar");
    const gar = await searchGar(q, regionCode);
    if (gar.length) {
      return {
        sources,
        warning: null,
        items: gar.map((h) => ({
          id: `g:${h.guid}`, source: "gar", fullAddress: h.fullAddress, region: h.region, municipality: h.municipality, locality: h.locality, district: null,
          street: h.street, house: h.house, guid: h.guid, objectId: h.objectId, lat: null, lon: null, precision: null,
        })),
      };
    }
  }
  if (!yandexConfigured()) return { items: [], sources, warning: sources.length ? null : "Подсказки недоступны: ГАР не загружен и не задан ключ YANDEX_API_KEY" };
  sources.push("yandex");
  try {
    return { items: (await cachedGeocode(q)).map(suggestionFromGeocode), sources, warning: null };
  } catch (e) {
    // ошибка геокодера не мешает вводу адреса вручную
    return { items: [], sources, warning: e instanceof HttpError ? e.message : "Геокодер Яндекса недоступен" };
  }
}
