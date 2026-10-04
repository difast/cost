import { api, ok } from "@/server/http";
import { requireUser } from "@/server/auth";
import { garAvailable, searchGar } from "@/server/gar";

/** Подсказки адресов по ГАР. available: false — справочник ещё не загружен. */
export const GET = api(async (req) => {
  await requireUser();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 200);
  const region = url.searchParams.get("region");
  if (!(await garAvailable())) return ok({ available: false, items: [] });
  if (q.trim().length < 3) return ok({ available: true, items: [] });
  return ok({ available: true, items: await searchGar(q, region && /^\d{1,2}$/.test(region) ? Number(region) : null) });
});
