import { z } from "zod";
import { prisma } from "@/server/db";
import { api, body, ok, HttpError } from "@/server/http";
import { requireUser } from "@/server/auth";
import { ensureSystemData } from "@/server/bootstrap";

export const GET = api(async () => {
  const u = await requireUser();
  await ensureSystemData();
  const list = await prisma.adjustmentSource.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: u.id }] },
    orderBy: [{ ownerId: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { factors: true, assessments: true } } },
  });
  return ok(list.map((s) => ({ ...s, editable: s.ownerId === u.id })));
});

const cloneSchema = z.object({
  fromId: z.string(),
  name: z.string().trim().min(1).max(300),
  edition: z.string().trim().min(1).max(50),
  publisher: z.string().trim().max(300).optional(),
  actualDate: z.string().optional(),
  licenseType: z.enum(["own", "licensed", "public"]).default("own"),
  licenseNote: z.string().max(2000).optional(),
});

/** Новая редакция справочника = копия существующей. Старые редакции не меняются — расчёты воспроизводимы. */
export const POST = api(async (req) => {
  const u = await requireUser();
  const data = await body(req, cloneSchema);
  const from = await prisma.adjustmentSource.findFirst({
    where: { id: data.fromId, OR: [{ ownerId: null }, { ownerId: u.id }] },
    include: { factors: { include: { categories: true } } },
  });
  if (!from) throw new HttpError(404, "Справочник не найден");
  const code = from.ownerId === u.id ? from.code : `user-${u.id.slice(-6)}-${from.code}`;
  if (await prisma.adjustmentSource.findUnique({ where: { code_edition: { code, edition: data.edition } } })) {
    throw new HttpError(409, "Редакция с таким номером уже существует");
  }
  const created = await prisma.adjustmentSource.create({
    data: {
      code,
      name: data.name,
      edition: data.edition,
      publisher: data.publisher ?? from.publisher,
      actualDate: data.actualDate ? new Date(`${data.actualDate.slice(0, 10)}T00:00:00Z`) : from.actualDate,
      segment: from.segment,
      licenseType: data.licenseType,
      licenseNote: data.licenseNote,
      isDemo: false,
      ownerId: u.id,
      factors: {
        create: from.factors.map((f) => ({
          code: f.code, name: f.name, kind: f.kind, attribute: f.attribute, stage: f.stage, sortOrder: f.sortOrder,
          value: f.value, minValue: f.minValue, maxValue: f.maxValue, params: f.params ?? {}, reference: f.reference,
          description: f.description, enabled: f.enabled,
          categories: { create: f.categories.map((c) => ({ code: c.code, label: c.label, coefficient: c.coefficient, minCoefficient: c.minCoefficient, maxCoefficient: c.maxCoefficient, sortOrder: c.sortOrder })) },
        })),
      },
    },
  });
  return ok(created, 201);
});
