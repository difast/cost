import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../http";
import { logEvent } from "../audit";
import { ensureSystemData } from "../bootstrap";
import { commitVersion, evaluate } from "./assessment";
import { storeFile } from "./files";
import { buildReport, type ReportFile } from "@/core/report/builder";
import { renderDocx } from "@/core/report/renderDocx";
import { renderPdf } from "@/core/report/renderPdf";
import { runChecks } from "@/core/checks";
import { DEFAULT_TEMPLATE_CODE } from "@/core/report/defaultTemplate";
import type { TemplateDefinition } from "@/core/report/model";
import type { AssessmentSnapshot } from "@/core/snapshot";
import type { CalcResult } from "@/core/calc/types";

async function activeTemplate() {
  await ensureSystemData();
  const t = await prisma.reportTemplate.findFirst({
    where: { code: DEFAULT_TEMPLATE_CODE, isActive: true },
    orderBy: { version: "desc" },
  });
  if (!t) throw new HttpError(500, "Шаблон отчёта не найден");
  return t;
}

async function loadFiles(snapshot: AssessmentSnapshot, ownerId: string): Promise<Record<string, ReportFile>> {
  const ids = new Set<string>();
  for (const c of snapshot.comparables) if (c.included && c.screenshotFileId) ids.add(c.screenshotFileId);
  for (const a of snapshot.attachments) ids.add(a.fileId);
  if (snapshot.appraiser?.signatureFileId) ids.add(snapshot.appraiser.signatureFileId);
  const files = await prisma.storedFile.findMany({ where: { id: { in: [...ids] }, ownerId } });
  return Object.fromEntries(
    files.map((f) => [f.id, { data: Buffer.from(f.data).toString("base64"), mime: f.mime, filename: f.filename, caption: f.caption }]),
  );
}

const safeName = (s: string) => s.replace(/[^\p{L}\p{N}._-]+/gu, "_");

/** Сформировать отчёт по текущим данным: проверки → фиксация версии → DOCX/PDF. */
export async function generateReport(assessmentId: string, userId: string, formats: Array<"docx" | "pdf">) {
  // Сначала проверки: версия с ошибками не фиксируется.
  const pre = await evaluate(assessmentId);
  if (!pre.checks.canGenerate) {
    throw new HttpError(422, `Отчёт не может быть сформирован: ошибок — ${pre.checks.errors}`, pre.checks.issues);
  }
  const { version, checks, snapshot } = await commitVersion(assessmentId, userId);
  return renderForVersion({ versionId: version.id, versionNumber: version.versionNumber, snapshot, result: checks.result!, userId, assessmentId, formats });
}

/** Повторно сформировать отчёт по зафиксированной версии (те же данные и коэффициенты). */
export async function regenerateFromVersion(assessmentId: string, versionId: string, userId: string, formats: Array<"docx" | "pdf">) {
  const v = await prisma.calculationVersion.findFirst({ where: { id: versionId, calculation: { assessmentId } } });
  if (!v) throw new HttpError(404, "Версия расчёта не найдена");
  const snapshot = v.snapshot as unknown as AssessmentSnapshot;
  const stored = v.result as unknown as CalcResult;
  const checks = runChecks(snapshot, { storedResult: stored });
  if (checks.issues.some((i) => i.code === "STORED_RESULT_MISMATCH")) {
    throw new HttpError(409, "Сохранённая версия не воспроизводится текущим ядром расчёта", checks.issues);
  }
  return renderForVersion({ versionId: v.id, versionNumber: v.versionNumber, snapshot, result: stored, userId, assessmentId, formats });
}

async function renderForVersion(o: {
  versionId: string;
  versionNumber: number;
  snapshot: AssessmentSnapshot;
  result: CalcResult;
  userId: string;
  assessmentId: string;
  formats: Array<"docx" | "pdf">;
}) {
  const tpl = await activeTemplate();
  const checks = runChecks(o.snapshot);
  const files = await loadFiles(o.snapshot, o.userId);
  const doc = buildReport(tpl.definition as unknown as TemplateDefinition, {
    snapshot: o.snapshot,
    result: o.result,
    checks,
    versionNumber: o.versionNumber,
    files,
    generatedAt: new Date().toISOString(),
  });
  const created = [];
  const base = safeName(`Отчёт_${o.snapshot.assessment.number}_v${o.versionNumber}`);
  for (const format of o.formats) {
    const buf = format === "docx" ? await renderDocx(doc) : await renderPdf(doc);
    const file = await storeFile({
      ownerId: o.userId,
      assessmentId: o.assessmentId,
      kind: "report",
      filename: `${base}.${format}`,
      mime: format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
      data: buf,
    });
    const report = await prisma.report.create({
      data: {
        assessmentId: o.assessmentId,
        calculationVersionId: o.versionId,
        templateId: tpl.id,
        format,
        fileId: file.id,
        checks: { errors: checks.errors, warnings: checks.warnings, issues: checks.issues } as unknown as Prisma.InputJsonValue,
        createdById: o.userId,
      },
    });
    created.push({ ...report, filename: file.filename });
  }
  await logEvent({
    assessmentId: o.assessmentId,
    userId: o.userId,
    action: "report",
    entity: "report",
    summary: `Сформирован отчёт (${o.formats.join(", ").toUpperCase()}) по версии расчёта № ${o.versionNumber}`,
  });
  return created;
}
