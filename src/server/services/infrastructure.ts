import { HttpError } from "@/server/http";
import { nearestMetro, searchOrganizations, type GeoPoint, type Place } from "@/server/integrations/yandex";
import { INFRA_CATEGORIES, INFRA_ITEMS_PER_CATEGORY, type InfraCategory, type InfrastructureSnapshot } from "@/core/infrastructure";

const toItem = (p: Place) => ({ name: p.name, type: p.type, address: p.address, lat: p.lat, lon: p.lon, distanceM: p.distanceM });

/** Собирает ближайшую инфраструктуру по всем категориям. Ошибка одной категории не прерывает остальные. */
export async function collectInfrastructure(center: GeoPoint): Promise<InfrastructureSnapshot> {
  const categories = await Promise.all(
    INFRA_CATEGORIES.map(async (c): Promise<InfraCategory> => {
      try {
        const found = c.metro
          ? await nearestMetro(center, c.radiusM, INFRA_ITEMS_PER_CATEGORY)
          : (await searchOrganizations(c.query!, center, c.radiusM)).filter((p) => p.distanceM <= c.radiusM);
        // одна организация может прийти несколько раз (филиалы в одном здании) — убираем точные дубли
        const seen = new Set<string>();
        const items = found
          .sort((a, b) => a.distanceM - b.distanceM)
          .filter((p) => {
            const k = `${p.name}|${p.address}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .slice(0, INFRA_ITEMS_PER_CATEGORY)
          .map(toItem);
        return { key: c.key, label: c.label, radiusM: c.radiusM, status: items.length ? "ok" : "empty", items };
      } catch (e) {
        if (e instanceof HttpError && e.status === 503) throw e; // ключ не задан — сообщаем сразу
        return { key: c.key, label: c.label, radiusM: c.radiusM, status: "error", error: e instanceof Error ? e.message : "Ошибка запроса", items: [] };
      }
    }),
  );
  if (categories.every((c) => c.status === "error")) throw new HttpError(502, categories[0]?.error ?? "Картографический сервис недоступен");
  return { provider: "yandex", providerTitle: "Яндекс Карты (HTTP Геокодер, API Поиска по организациям)", retrievedAt: new Date().toISOString(), center, categories };
}
