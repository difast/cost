import { z } from "zod";
import { api, body, ok } from "@/server/http";
import { requireAccess } from "@/server/workspace";
import { billingSummary, renameWorkspace } from "@/server/services/team";

/** Рабочее пространство: тариф, подписка, пробный период, участники (сводка). */
export const GET = api(async () => ok(await billingSummary(await requireAccess())));

export const PATCH = api(async (req) => {
  const a = await requireAccess();
  const { name } = await body(req, z.object({ name: z.string().trim().min(1, "Укажите название").max(120) }));
  await renameWorkspace(a, name);
  return ok({ ok: true });
});
