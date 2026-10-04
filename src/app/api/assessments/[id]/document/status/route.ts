import { z } from "zod";
import { api, body, ok, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { setStatus } from "@/server/services/reportDocument";

/** Черновик → На проверке → Подтверждён. Финальная версия — только через фиксацию версии. */
export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const { status } = await body(req, z.object({ status: z.enum(["draft", "review", "approved"]) }));
  return ok(await setStatus(id, u.id, status));
});
