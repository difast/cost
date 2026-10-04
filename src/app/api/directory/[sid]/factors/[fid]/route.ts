import { z } from "zod";
import { prisma } from "@/server/db";
import { api, body, ok, HttpError } from "@/server/http";
import { requireUser } from "@/server/auth";
import { validateFormula } from "@/core/adjustments/formula";
import { FORMULA_VARIABLES } from "@/core/adjustments/attributes";

type P = { params: Promise<{ sid: string; fid: string }> };
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/, "Ожидается число").nullable();

const schema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  value: decimal.optional(),
  minValue: decimal.optional(),
  maxValue: decimal.optional(),
  reference: z.string().max(500).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  enabled: z.boolean().optional(),
  exponent: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  expression: z.string().trim().min(1).max(500).optional(),
  groupName: z.string().trim().max(200).nullable().optional(),
  region: z.string().trim().max(300).nullable().optional(),
  methodology: z.string().trim().max(2000).nullable().optional(),
  comment: z.string().trim().max(2000).nullable().optional(),
  actualDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional(),
  categories: z.array(z.object({ id: z.string(), coefficient: z.string().regex(/^\d+(\.\d+)?$/), minCoefficient: decimal.optional(), maxCoefficient: decimal.optional() })).optional(),
});

/**
 * Изменение коэффициентов допускается только в собственной редакции и только пока
 * она не использована в оценках — иначе нужно создать новую редакцию.
 * Это гарантирует, что старые оценки не изменятся задним числом.
 */
export const PATCH = api(async (req, { params }: P) => {
  const u = await requireUser();
  const { sid, fid } = await params;
  const s = await prisma.adjustmentSource.findFirst({ where: { id: sid, ownerId: u.id } });
  if (!s) throw new HttpError(403, "Изменять можно только собственные редакции справочника");
  const used = await prisma.calculationVersion.count({ where: { snapshot: { path: ["directory", "id"], equals: sid } } });
  if (used > 0) throw new HttpError(409, "Редакция уже использована в зафиксированных расчётах. Создайте новую редакцию.");
  const f = await prisma.adjustmentFactor.findFirst({ where: { id: fid, sourceId: sid } });
  if (!f) throw new HttpError(404, "Показатель не найден");
  const data = await body(req, schema);
  const { categories, exponent, expression, actualDate, ...rest } = data;
  if (expression !== undefined) {
    if (f.kind !== "formula") throw new HttpError(400, "Формула задаётся только для показателя с типом «Формула»");
    const err = validateFormula(expression, FORMULA_VARIABLES);
    if (err) throw new HttpError(400, `Формула: ${err}`);
  }
  const nextParams = exponent !== undefined || expression !== undefined ? { ...((f.params ?? {}) as object), ...(exponent !== undefined ? { exponent } : {}), ...(expression !== undefined ? { expression } : {}) } : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.adjustmentFactor.update({
      where: { id: fid },
      data: { ...rest, params: nextParams, actualDate: actualDate === undefined ? undefined : actualDate ? new Date(`${actualDate.slice(0, 10)}T00:00:00Z`) : null },
    });
    for (const c of categories ?? []) {
      await tx.adjustmentCategory.updateMany({
        where: { id: c.id, factorId: fid },
        data: { coefficient: c.coefficient, minCoefficient: c.minCoefficient, maxCoefficient: c.maxCoefficient },
      });
    }
  });
  return ok({ ok: true });
});
