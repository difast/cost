import { api, ok } from "@/server/http";
import { requireUser } from "@/server/auth";
import { metrapiConfigured, metrapiSources } from "@/server/integrations/metrapi";
import { SOURCE_NAMES } from "@/server/services/listings";

/** Площадки поставщика объявлений (для фильтра «Источник»). */
export const GET = api(async () => {
  await requireUser();
  if (!metrapiConfigured()) return ok({ configured: false, sources: [] });
  try {
    const list = await metrapiSources();
    return ok({ configured: true, sources: list.map((s) => ({ code: s.code, name: SOURCE_NAMES[s.code] ?? s.name, status: s.status })) });
  } catch {
    return ok({ configured: true, sources: [], error: "Список площадок временно недоступен" });
  }
});
