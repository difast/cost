import { api, ok } from "@/server/http";
import { requireUser } from "@/server/auth";
import { suggestAddresses } from "@/server/services/address";

/** Подсказки адреса: ГАР, затем Яндекс Геокодер. warning — подсказки недоступны (ввод вручную остаётся). */
export const GET = api(async (req) => {
  await requireUser();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 200);
  const region = url.searchParams.get("region");
  if (q.trim().length < 3) return ok({ available: true, items: [], sources: [], warning: null });
  const r = await suggestAddresses(q, region && /^\d{1,2}$/.test(region) ? Number(region) : null);
  return ok({ available: r.sources.length > 0, ...r });
});
