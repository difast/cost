import { prisma } from "@/server/db";
import { api, body, ok } from "@/server/http";
import { requireUser } from "@/server/auth";
import { createAssessmentSchema } from "@/server/schemas";
import { checkSummary, createAssessment, mapLimit } from "@/server/services/assessment";

export const GET = api(async (req) => {
  const u = await requireUser();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const list = await prisma.assessment.findMany({
    where: {
      ownerId: u.id,
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: "insensitive" } },
              { customerName: { contains: q, mode: "insensitive" } },
              { property: { address: { contains: q, mode: "insensitive" } } },
              { property: { cadastralNumber: { contains: q } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true, number: true, status: true, valuationDate: true, updatedAt: true, customerName: true, propertyType: true, approach: true,
      property: { select: { address: true, cadastralNumber: true, area: true, objectType: true, rooms: true } },
      calculation: { select: { versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { result: true, versionNumber: true } } } },
      _count: { select: { comparables: true, reports: true } },
    },
  });
  // Сводка проверок считается теми же проверками, что и в карточке оценки.
  const summaries = await mapLimit(list, 6, (a) => checkSummary(a.id).catch(() => null));
  return ok(
    list.map((a, i) => {
      const v = a.calculation?.versions[0];
      return {
        ...a,
        calculation: undefined,
        checks: summaries[i],
        lastVersion: v ? { versionNumber: v.versionNumber, finalValue: (v.result as { finalValue?: string }).finalValue ?? null } : null,
      };
    }),
  );
});

export const POST = api(async (req) => {
  const u = await requireUser();
  const data = await body(req, createAssessmentSchema);
  const a = await createAssessment(u.id, data);
  return ok({ id: a.id }, 201);
});
