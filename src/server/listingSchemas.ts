import { z } from "zod";

const n = z.coerce.number().finite().nonnegative().nullish().transform((v) => v ?? null);
const s = z.string().trim().max(200).nullish().transform((v) => (v ? v : null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД").nullish().or(z.literal("")).transform((v) => v || null);

export const listingQuerySchema = z.object({
  region: s,
  locality: s,
  district: s,
  q: s,
  center: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).nullish().transform((v) => v ?? null),
  radiusM: z.coerce.number().int().min(100).max(50_000).nullish().transform((v) => v ?? null),
  rooms: z.array(z.coerce.number().int().min(0).max(20)).max(10).default([]),
  areaMin: n, areaMax: n, floorMin: n, floorMax: n, floorsMin: n, floorsMax: n,
  priceMin: n, priceMax: n, unitPriceMin: n, unitPriceMax: n,
  dateFrom: date, dateTo: date,
  buildYearMin: n, buildYearMax: n,
  wallMaterials: z.array(z.enum(["panel", "brick", "monolith", "monolith_brick", "block", "wood"])).default([]),
  finishings: z.array(z.enum(["none", "needs_repair", "standard", "improved", "designer"])).default([]),
  furniture: z.enum(["yes", "no", "any"]).default("any"),
  sources: z.array(z.string().regex(/^[a-z0-9_.-]{1,40}$/)).max(20).default([]),
  secondaryOnly: z.boolean().default(true),
  dedupe: z.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(1000).default(300),
}).refine((q) => q.region || q.locality || q.q, { message: "Укажите регион, населённый пункт или адрес для поиска" });
