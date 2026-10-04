import { Prisma } from "@prisma/client";
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

  if (data.notRequired === true) {
    if (!data.comment?.trim()) throw new HttpError(400, "Укажите обоснование, почему фактор не требуется");
    await prisma.adjustment.update({ where: { id: aid }, data: { value: 0, notRequired: true, overridden: false, comment: data.comment, overriddenById: u.id, overriddenAt: new Date(), basisSnapshot: { subjectValue: adj.subjectValue, comparableValue: adj.comparableValue, suggestedValue: adj.suggestedValue?.toString() ?? null } } });
    await logEvent({ assessmentId: id, userId: u.id, action: "update", entity: "adjustment", entityId: aid, summary: `${adj.factorName}: отмечено «Не требуется» (${data.comment})`, diff: { value: [adj.value.toString(), "0"], notRequired: [adj.notRequired, true], comment: [adj.comment, data.comment] } });
    return ok({ ok: true });
  }

  if (data.reset || data.notRequired === false) {
    const value = adj.suggestedValue ?? d(0);
    await prisma.adjustment.update({ where: { id: aid }, data: { value, overridden: false, notRequired: false, comment: null, overriddenById: null, overriddenAt: null, basisSnapshot: Prisma.DbNull } });
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
  // при ручном изменении фиксируются автор, дата и характеристики, на основании которых оно сделано;
  // исходное автоматическое значение остаётся в suggestedValue
  const valueChanged = !d(adj.value).eq(value);
  const audit = overridden
    ? valueChanged || !adj.overriddenAt
      ? { overriddenById: u.id, overriddenAt: new Date(), basisSnapshot: { subjectValue: adj.subjectValue, comparableValue: adj.comparableValue, suggestedValue: adj.suggestedValue?.toString() ?? null } }
      : {}
    : { overriddenById: null, overriddenAt: null, basisSnapshot: Prisma.DbNull };
  const after = await prisma.adjustment.update({ where: { id: aid }, data: { value, overridden, comment, notRequired: false, ...audit } });
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
