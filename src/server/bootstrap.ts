// Идемпотентное начальное заполнение системных данных (справочник, шаблон, нормативка).
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { DEMO_DIRECTORY, DEMO_FACTORS } from "./seed/directory";
import { NORMATIVE_SEED } from "./seed/normative";
import { DEFAULT_TEMPLATE, DEFAULT_TEMPLATE_CODE } from "@/core/report/defaultTemplate";

let done: Promise<void> | null = null;

export function ensureSystemData() {
  if (!done) done = seed().catch((e) => {
    done = null;
    throw e;
  });
  return done;
}

async function seed() {
  const existing = await prisma.adjustmentSource.findUnique({
    where: { code_edition: { code: DEMO_DIRECTORY.code, edition: DEMO_DIRECTORY.edition } },
  });
  if (!existing) {
    await prisma.adjustmentSource.create({
      data: {
        ...DEMO_DIRECTORY,
        factors: {
          create: DEMO_FACTORS.map((f) => ({
            code: f.code,
            name: f.name,
            kind: f.kind,
            attribute: f.attribute,
            stage: f.stage,
            sortOrder: f.sortOrder,
            value: f.value,
            minValue: f.minValue,
            maxValue: f.maxValue,
            params: (f.params ?? {}) as Prisma.InputJsonValue,
            description: f.description,
            categories: {
              create: (f.categories ?? []).map((c, i) => ({
                code: c.code,
                label: c.label,
                coefficient: c.coefficient,
                minCoefficient: c.min,
                maxCoefficient: c.max,
                sortOrder: i,
              })),
            },
          })),
        },
      },
    });
  }

  const tpl = await prisma.reportTemplate.findUnique({ where: { code_version: { code: DEFAULT_TEMPLATE_CODE, version: 1 } } });
  if (!tpl) {
    await prisma.reportTemplate.create({
      data: {
        code: DEFAULT_TEMPLATE_CODE,
        version: 1,
        name: "Квартира — сравнительный подход",
        definition: DEFAULT_TEMPLATE as unknown as Prisma.InputJsonValue,
      },
    });
  }

  if ((await prisma.normativeDocument.count()) === 0) {
    await prisma.normativeDocument.createMany({
      data: NORMATIVE_SEED.map((n) => ({
        kind: n.kind,
        code: n.code,
        title: n.title,
        issuer: n.issuer,
        adoptedAt: "adoptedAt" in n && n.adoptedAt ? new Date(n.adoptedAt) : null,
        summary: n.summary,
        tags: n.tags,
      })),
    });
  }
}
