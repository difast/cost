import { ok, api, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { qualityReport } from "@/server/services/quality";

/** Контроль качества: все замечания оценки (проверки + сверка отчёта) со статусами, включая «Исправлено». */
export const GET = api(async (_req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  return ok(await qualityReport(id));
});
