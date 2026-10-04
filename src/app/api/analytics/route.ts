import { prisma } from "@/server/db";
import { api, ok } from "@/server/http";
import { requireAccess } from "@/server/workspace";
import type { AnalyticsRow } from "@/core/analytics";
import type { CalcResult } from "@/core/calc/types";

/** Аналоги пользователя по всем оценкам — исходные данные раздела «Аналитика». */
export const GET = api(async () => {
  const { workspace } = await requireAccess();
  const comps = await prisma.comparable.findMany({
    where: { assessment: { workspaceId: workspace.id } },
    select: {
      id: true, assessmentId: true, address: true, sourceName: true, offerDate: true, retrievedAt: true,
      price: true, area: true, rooms: true, included: true,
      assessment: { select: { number: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  // Последние зафиксированные версии расчёта — для скорректированных цен
  const versions = await prisma.calculationVersion.findMany({
    where: { calculation: { assessment: { workspaceId: workspace.id } } },
    orderBy: { versionNumber: "desc" },
    select: { result: true, calculation: { select: { assessmentId: true } } },
  });
  const latest = new Map<string, CalcResult>();
  for (const v of versions) if (!latest.has(v.calculation.assessmentId)) latest.set(v.calculation.assessmentId, v.result as unknown as CalcResult);
  const adj = new Map<string, { adjustedUnitPrice: string; totalChange: string }>();
  for (const r of latest.values()) for (const c of r.comparables) adj.set(c.id, { adjustedUnitPrice: c.adjustedUnitPrice, totalChange: c.totalChange });

  const rows: AnalyticsRow[] = comps
    .filter((c) => !c.area.isZero())
    .map((c) => ({
      id: c.id,
      assessmentId: c.assessmentId,
      assessmentNumber: c.assessment.number,
      address: c.address,
      sourceName: c.sourceName,
      date: (c.offerDate ?? c.retrievedAt)?.toISOString() ?? null,
      price: c.price.toString(),
      area: c.area.toString(),
      rooms: c.rooms,
      included: c.included,
      adjustedUnitPrice: adj.get(c.id)?.adjustedUnitPrice ?? null,
      totalChange: adj.get(c.id)?.totalChange ?? null,
    }));
  return ok({ rows, assessments: latest.size });
});
