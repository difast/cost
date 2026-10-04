import { prisma } from "@/server/db";
import { api, body, ok, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getAccess } from "@/server/workspace";
import { can } from "@/core/billing";
import { assignmentSchema } from "@/server/schemas";
import { getDetail, getOwned, syncAdjustments, updateWithAudit } from "@/server/services/assessment";
import { logEvent } from "@/server/audit";

export const GET = api(async (_req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  return ok(await getDetail(id, u.id));
});

export const PATCH = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  const before = await getOwned(id, u.id);
  const data = await body(req, assignmentSchema);
  if (data.adjustmentSourceId) {
    const src = await prisma.adjustmentSource.findFirst({ where: { id: data.adjustmentSourceId, OR: [{ ownerId: null }, { ownerId: u.id }] } });
    if (!src) throw new HttpError(404, "Справочник не найден");
  }
  const after = await prisma.assessment.update({ where: { id }, data });
  await updateWithAudit({ assessmentId: id, userId: u.id, entity: "assessment", entityId: id, before, after, summary: "Изменено задание на оценку" });
  if (data.adjustmentSourceId && data.adjustmentSourceId !== before.adjustmentSourceId) await syncAdjustments(id);
  return ok(after);
});

export const DELETE = api(async (_req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  const a = await getOwned(id, u.id);
  const access = await getAccess(u);
  if (a.ownerId !== u.id && !(a.workspaceId === access.workspace.id && can(access.role, "deleteAnyAssessment"))) {
    throw new HttpError(403, "Удалять чужие оценки могут только владелец и администратор рабочего пространства");
  }
  if ((await prisma.report.count({ where: { assessmentId: id } })) > 0) {
    // оценки с выпущенными отчётами не удаляются, а архивируются
    await prisma.assessment.update({ where: { id }, data: { status: "archived" } });
    await logEvent({ assessmentId: id, userId: u.id, action: "update", entity: "assessment", entityId: id, summary: `Оценка № ${a.number} перенесена в архив` });
    return ok({ archived: true });
  }
  await prisma.assessment.delete({ where: { id } });
  return ok({ deleted: true });
});
