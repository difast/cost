// Поиск адресов по загруженному ГАР (таблица GarAddress, см. scripts/gar/import.mjs).
import { prisma } from "@/server/db";

export interface GarHit {
  guid: string;
  objectId: string;
  fullAddress: string;
  region: string | null;
  municipality: string | null;
  locality: string | null;
  street: string | null;
  house: string | null;
}

let availableCache: { at: number; value: boolean } | null = null;

/** Загружен ли ГАР (проверка кэшируется на минуту). */
export async function garAvailable(): Promise<boolean> {
  if (availableCache && Date.now() - availableCache.at < 60_000) return availableCache.value;
  const r = await prisma.$queryRaw<Array<{ ok: boolean }>>`SELECT EXISTS (SELECT 1 FROM "GarAddress") AS ok`;
  availableCache = { at: Date.now(), value: !!r[0]?.ok };
  return availableCache.value;
}

/** Слова запроса → префиксный полнотекстовый запрос: «тверская 12» → тверская:* & 12:* */
export function garTsQuery(q: string): string | null {
  const tokens = q.toLowerCase().replace(/ё/g, "е").replace(/[^0-9a-zа-я]+/g, " ").trim().split(" ").filter(Boolean).slice(0, 8);
  return tokens.length ? tokens.map((t) => `${t}:*`).join(" & ") : null;
}

export async function searchGar(q: string, regionCode: number | null, limit = 10): Promise<GarHit[]> {
  const ts = garTsQuery(q);
  if (!ts) return [];
  const rows = await prisma.$queryRaw<Array<{ guid: string; objectId: bigint; fullAddress: string; region: string | null; municipality: string | null; locality: string | null; street: string | null; house: string | null }>>`
    SELECT "guid", "objectId", "fullAddress", "region", "municipality", "locality", "street", "house"
    FROM "GarAddress"
    WHERE to_tsvector('simple', "normalized") @@ to_tsquery('simple', ${ts})
      AND (${regionCode}::int IS NULL OR "regionCode" = ${regionCode}::int)
    ORDER BY length("fullAddress")
    LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, objectId: r.objectId.toString() }));
}
