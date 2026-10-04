import { z } from "zod";
import { api, body, ok, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { regenerateFromVersion } from "@/server/services/report";
import { createDocumentVersion } from "@/server/services/reportDocument";
import { prisma } from "@/server/db";

export const maxDuration = 60;

const schema = z.object({
  formats: z.array(z.enum(["docx", "pdf"])).min(1).default(["docx", "pdf"]),
  versionId: z.string().optional(),
});

export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const data = await body(req, schema);
  // Новый отчёт — только через рабочий документ (единый источник для DOCX, PDF и XLSX);
  // по старой версии расчёта — повторное формирование по шаблону той версии.
  if (data.versionId) return ok(await regenerateFromVersion(id, data.versionId, u.id, data.formats), 201);
  const v = await createDocumentVersion(id, u.id, { final: true, acknowledge: true });
  const reports = await prisma.report.findMany({ where: { documentVersionId: v.id }, orderBy: { createdAt: "asc" } });
  return ok(reports.filter((r) => (data.formats as string[]).includes(r.format) || r.format === "xlsx"), 201);
});
