import { z } from "zod";
import { api, body, ok, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { defaultListingQuery, listingsPage, searchListings } from "@/server/services/listings";
import { metrapiConfigured } from "@/server/integrations/metrapi";
import { listingQuerySchema } from "@/server/listingSchemas";

/** Последние результаты поиска (страница) и параметры поиска по умолчанию. */
export const GET = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
  const page = await listingsPage(id, { searchId: url.searchParams.get("searchId"), offset, limit, focus: url.searchParams.get("focus") });
  return ok({ configured: metrapiConfigured(), defaults: await defaultListingQuery(id), offset, limit, ...page });
});

const schema = z.object({ query: listingQuerySchema, force: z.boolean().default(false) });

/** Новый поиск в Metrapi (или результат из кэша) и первая страница. */
export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const data = await body(req, schema);
  const meta = await searchListings(id, u.id, data.query, data.force);
  const page = await listingsPage(id, { searchId: meta.id, offset: 0, limit: 20 });
  return ok({ configured: true, offset: 0, limit: 20, ...page, search: meta });
});
