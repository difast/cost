// Фильтры, которых нет в API поставщика, — применяются на нашей стороне к полученной выборке:
// расстояние от объекта (по координатам объявления), цена за м², мебель. Плюс сортировка.

import { distanceM } from "../geo";
import type { ListingQuery, ListingWithRaw } from "./model";

export interface LocalFilterStats {
  received: number;
  kept: number;
  /** Отброшены: нет координат при заданном радиусе. */
  noCoords: number;
  /** Отброшены: дальше радиуса. */
  tooFar: number;
  /** Отброшены по цене за м². */
  unitPrice: number;
  /** Отброшены по признаку мебели. */
  furniture: number;
}

export type RankedListing = ListingWithRaw & { distanceM: number | null };

export function applyLocalFilters(items: ListingWithRaw[], q: ListingQuery): { items: RankedListing[]; stats: LocalFilterStats } {
  const stats: LocalFilterStats = { received: items.length, kept: 0, noCoords: 0, tooFar: 0, unitPrice: 0, furniture: 0 };
  const out: RankedListing[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.externalId)) continue;
    seen.add(it.externalId);
    const dist = q.center && it.lat !== null && it.lon !== null ? distanceM(q.center, { lat: it.lat, lon: it.lon }) : null;
    if (q.center && q.radiusM) {
      if (dist === null) { stats.noCoords++; continue; }
      if (dist > q.radiusM) { stats.tooFar++; continue; }
    }
    if ((q.unitPriceMin != null || q.unitPriceMax != null) && (it.unitPrice === null || (q.unitPriceMin != null && it.unitPrice < q.unitPriceMin) || (q.unitPriceMax != null && it.unitPrice > q.unitPriceMax))) {
      stats.unitPrice++;
      continue;
    }
    if (q.furniture === "yes" && it.furniture !== true) { stats.furniture++; continue; }
    if (q.furniture === "no" && it.furniture === true) { stats.furniture++; continue; }
    out.push({ ...it, distanceM: dist });
  }
  // ближе к объекту — выше; без координат — в конце, затем свежие объявления
  out.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity) || String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")));
  stats.kept = out.length;
  return { items: out, stats };
}
