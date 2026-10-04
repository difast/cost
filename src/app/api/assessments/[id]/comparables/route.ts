import { prisma } from "@/server/db";
import { api, body, ok, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { comparableSchema } from "@/server/schemas";
import { getOwned, syncAdjustments } from "@/server/services/assessment";
import { logEvent } from "@/server/audit";

export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const data = await body(req, comparableSchema);
  if (!data.price || !data.area) throw new HttpError(400, "Укажите цену и площадь аналога");
  const max = await prisma.comparable.aggregate({ where: { assessmentId: id }, _max: { position: true } });
  const c = await prisma.comparable.create({
    data: {
      ...data,
      price: data.price,
      area: data.area,
      included: data.included ?? true,
      position: (max._max.position ?? 0) + 1,
      retrievedAt: data.retrievedAt ?? new Date(),
      assessmentId: id,
    },
  });
  await logEvent({ assessmentId: id, userId: u.id, action: "create", entity: "comparable", entityId: c.id, summary: `Добавлен аналог: ${c.address ?? c.sourceUrl ?? c.id}` });
  await syncAdjustments(id);
  return ok(c, 201);
});
