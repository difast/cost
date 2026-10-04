import { api, ok } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { checkListingActuality } from "@/server/services/listings";

type P = { params: Promise<{ id: string; cid: string }> };

/** Сверка снимка аналога с текущим объявлением у источника — без изменения оценки. */
export const GET = api(async (_req, { params }: P) => {
  const u = await requireUser();
  const { id, cid } = await params;
  await getOwned(id, u.id);
  return ok(await checkListingActuality(id, cid));
});
