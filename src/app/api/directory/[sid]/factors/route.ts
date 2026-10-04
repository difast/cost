import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { api, body, ok, HttpError } from "@/server/http";
import { requireUser } from "@/server/auth";
import { assertFeature, getAccess } from "@/server/workspace";
import { validateFormula } from "@/core/adjustments/formula";
import { FORMULA_VARIABLES } from "@/core/adjustments/attributes";

type P = { params: Promise<{ sid: string }> };
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/, "Ожидается число").nullish().transform((v) => v ?? null);
const ATTRIBUTES = ["floor_category", "wall_material", "finishing", "furniture", "house_condition", "metro_distance", "rights", "area"] as const;

const schema = z.object({
  code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/, "Код: латиница, цифры и «_»"),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["discount", "category", "formula", "manual"]),
  attribute: z.union([z.enum(ATTRIBUTES), z.string().regex(/^field:[a-z][a-zA-Z0-9_]{0,40}$/)]).nullish().transform((v) => v ?? null),
  stage: z.union([z.literal(1), z.literal(2)]).default(2),
  value: decimal,
  minValue: decimal,
  maxValue: decimal,
  expression: z.string().trim().max(500).nullish(),
  reference: z.string().max(500).nullish(),
  description: z.string().max(2000).nullish(),
  groupName: z.string().trim().max(200).nullish(),
  region: z.string().trim().max(300).nullish(),
  methodology: z.string().trim().max(2000).nullish(),
  comment: z.string().trim().max(2000).nullish(),
  categories: z.array(z.object({ code: z.string().trim().min(1).max(60), label: z.string().trim().min(1).max(200), coefficient: z.string().regex(/^\d+(\.\d+)?$/), minCoefficient: decimal, maxCoefficient: decimal })).max(50).default([]),
});

/** Новый показатель в собственной редакции — без изменения кода расчёта. */
export const POST = api(async (req, { params }: P) => {
  const u = await requireUser();
  assertFeature(await getAccess(u), "customDirectory"); // собственные редакции справочника — с тарифа «Профессиональный»
  const { sid } = await params;
  const s = await prisma.adjustmentSource.findFirst({ where: { id: sid, ownerId: u.id } });
  if (!s) throw new HttpError(403, "Добавлять показатели можно только в собственную редакцию справочника");
  const used = await prisma.calculationVersion.count({ where: { snapshot: { path: ["directory", "id"], equals: sid } } });
  if (used > 0) throw new HttpError(409, "Редакция уже использована в зафиксированных расчётах. Создайте новую редакцию.");
  const data = await body(req, schema);
  if (data.kind === "formula") {
    const err = data.expression ? validateFormula(data.expression, FORMULA_VARIABLES) : "Укажите формулу";
    if (err) throw new HttpError(400, `Формула: ${err}`);
  }
  if (data.kind === "category" && (!data.attribute || data.categories.length < 2)) throw new HttpError(400, "Для коэффициентов категорий укажите признак и не менее двух категорий");
  if (data.kind === "discount" && data.value === null) throw new HttpError(400, "Укажите значение скидки");
  if (await prisma.adjustmentFactor.findUnique({ where: { sourceId_code: { sourceId: sid, code: data.code } } })) throw new HttpError(409, "Показатель с таким кодом уже есть");
  const max = await prisma.adjustmentFactor.aggregate({ where: { sourceId: sid }, _max: { sortOrder: true } });
  const f = await prisma.adjustmentFactor.create({
    data: {
      sourceId: sid, code: data.code, name: data.name, kind: data.kind, attribute: data.attribute, stage: data.stage,
      sortOrder: (max._max.sortOrder ?? 0) + 10, value: data.value, minValue: data.minValue, maxValue: data.maxValue,
      params: (data.kind === "formula" ? { expression: data.expression } : {}) as Prisma.InputJsonValue,
      reference: data.reference ?? null, description: data.description ?? null,
      groupName: data.groupName ?? null, region: data.region ?? null, methodology: data.methodology ?? null, comment: data.comment ?? null,
      categories: { create: data.categories.map((c, i) => ({ ...c, sortOrder: i })) },
    },
  });
  return ok(f, 201);
});
