import { api, ok, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned, syncAdjustments } from "@/server/services/assessment";

/** Пересчитать предложения по справочнику (ручные значения сохраняются). */
export const POST = api(async (_req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  await syncAdjustments(id);
  return ok({ ok: true });
});
