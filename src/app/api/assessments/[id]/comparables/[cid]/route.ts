import { prisma } from "@/server/db";
import { api, body, ok, notFound } from "@/server/http";
import { requireUser } from "@/server/auth";
import { comparableSchema } from "@/server/schemas";
import { getOwned, syncAdjustments, updateWithAudit } from "@/server/services/assessment";
import { logEvent } from "@/server/audit";

type P = { params: Promise<{ id: string; cid: string }> };

async function load(id: string, cid: string, userId: string) {
  await getOwned(id, userId);
  const c = await prisma.comparable.findFirst({ where: { id: cid, assessmentId: id } });
  if (!c) throw notFound("Аналог");
  return c;
}

export const PATCH = api(async (req, { params }: P) => {
  const u = await requireUser();
  const { id, cid } = await params;
  const before = await load(id, cid, u.id);
  const data = await body(req, comparableSchema);
  const after = await prisma.comparable.update({
    where: { id: cid },
    data: { ...data, price: data.price ?? undefined, area: data.area ?? undefined, position: data.position ?? undefined, included: data.included ?? undefined },
  });
  await updateWithAudit({ assessmentId: id, userId: u.id, entity: "comparable", entityId: cid, before, after, summary: `Изменён аналог: ${after.address ?? cid}` });
  await syncAdjustments(id);
  return ok(after);
});

export const DELETE = api(async (_req, { params }: P) => {
  const u = await requireUser();
  const { id, cid } = await params;
  const c = await load(id, cid, u.id);
  await prisma.comparable.delete({ where: { id: cid } });
  await logEvent({ assessmentId: id, userId: u.id, action: "delete", entity: "comparable", entityId: cid, summary: `Удалён аналог: ${c.address ?? cid}`, diff: { price: c.price.toString(), area: c.area.toString(), sourceUrl: c.sourceUrl } });
  return ok({ deleted: true });
});
