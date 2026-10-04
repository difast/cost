import { prisma } from "@/server/db";
import { api, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { renderXlsx } from "@/core/report/renderXlsx";
import type { AssessmentSnapshot } from "@/core/snapshot";
import type { CalcResult } from "@/core/calc/types";

/** Экспорт подтверждённой версии расчёта в XLSX (?versionId=… — конкретная версия, иначе последняя). */
export const GET = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  const a = await getOwned(id, u.id);
  const versionId = new URL(req.url).searchParams.get("versionId");
  const v = await prisma.calculationVersion.findFirst({
    where: { calculation: { assessmentId: id }, ...(versionId ? { id: versionId } : {}) },
    orderBy: { versionNumber: "desc" },
  });
  if (!v) throw new HttpError(404, "Нет подтверждённого расчёта — подтвердите расчёт в разделе «Расчёт»");
  const by = v.createdById ? await prisma.user.findUnique({ where: { id: v.createdById }, select: { email: true, appraiser: { select: { fullName: true } } } }) : null;
  const buf = await renderXlsx(v.snapshot as unknown as AssessmentSnapshot, v.result as unknown as CalcResult, { versionNumber: v.versionNumber, createdAt: v.createdAt.toISOString(), createdBy: by?.appraiser?.fullName || by?.email || null });
  const name = `Расчёт_${a.number}_версия_${v.versionNumber}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="raschet_${v.versionNumber}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
});
