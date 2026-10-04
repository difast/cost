import { prisma } from "@/server/db";
import { api, body, ok } from "@/server/http";
import { requireUser } from "@/server/auth";
import { createAssessmentSchema } from "@/server/schemas";
import { createAssessment } from "@/server/services/assessment";

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
      id: true, number: true, status: true, valuationDate: true, updatedAt: true, customerName: true,
      property: { select: { address: true, cadastralNumber: true, area: true } },
      calculation: { select: { versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { result: true, versionNumber: true } } } },
      _count: { select: { comparables: true, reports: true } },
    },
  });
  return ok(
    list.map((a) => {
      const v = a.calculation?.versions[0];
      return {
        ...a,
        calculation: undefined,
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
