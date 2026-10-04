import { prisma } from "@/server/db";
import { api, ok, notFound } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";

type P = { params: Promise<{ id: string; vid: string }> };

/** Зафиксированная версия: снимок данных и коэффициентов на момент расчёта. */
export const GET = api(async (_req, { params }: P) => {
  const u = await requireUser();
  const { id, vid } = await params;
  await getOwned(id, u.id);
  const v = await prisma.calculationVersion.findFirst({ where: { id: vid, calculation: { assessmentId: id } } });
  if (!v) throw notFound("Версия");
  return ok(v);
});
