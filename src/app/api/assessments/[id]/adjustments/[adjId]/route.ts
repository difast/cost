import { prisma } from "@/server/db";
import { api, body, ok, notFound, HttpError } from "@/server/http";
import { requireUser } from "@/server/auth";
import { adjustmentPatchSchema } from "@/server/schemas";
import { getOwned } from "@/server/services/assessment";
import { logEvent } from "@/server/audit";
import { d } from "@/core/calc/decimal";
import { fmtPercent } from "@/core/format";

type P = { params: Promise<{ id: string; adjId: string }> };

export const PATCH = api(async (req, { params }: P) => {
  const u = await requireUser();
  const { id, adjId: aid } = await params;
  await getOwned(id, u.id);
  const adj = await prisma.adjustment.findFirst({ where: { id: aid, assessmentId: id }, include: { comparable: true } });
  if (!adj) throw notFound("Корректировка");
  const data = await body(req, adjustmentPatchSchema);

  if (data.reset) {
    const value = adj.suggestedValue ?? d(0);
    await prisma.adjustment.update({ where: { id: aid }, data: { value, overridden: false, comment: null } });
    await logEvent({ assessmentId: id, userId: u.id, action: "update", entity: "adjustment", entityId: aid, summary: `${adj.factorName}: возврат к значению справочника ${fmtPercent(value.toString())}` });
    return ok({ ok: true });
  }

  let value = adj.value.toString();
  if (data.percent !== undefined && data.percent !== null) {
    const v = d(data.percent).div(100);
    if (v.lte(-1) || v.gte(5)) throw new HttpError(400, "Корректировка должна быть в диапазоне от −100 % до +500 %");
    value = v.toString();
  }
  const overridden = adj.suggestedValue === null ? !d(value).isZero() || !!data.comment : !d(value).eq(adj.suggestedValue);
  const comment = data.comment !== undefined ? data.comment : adj.comment;
  const after = await prisma.adjustment.update({ where: { id: aid }, data: { value, overridden, comment } });
  if (!d(adj.value).eq(value) || adj.comment !== comment) {
    await logEvent({
      assessmentId: id,
      userId: u.id,
      action: "update",
      entity: "adjustment",
      entityId: aid,
      summary: `${adj.factorName}: ${fmtPercent(adj.value.toString())} → ${fmtPercent(value)}${comment ? ` (${comment})` : ""}`,
      diff: { value: [adj.value.toString(), value], comment: [adj.comment, comment] },
    });
  }
  return ok(after);
});
