// Рабочий документ отчёта: хранение, автосохранение, статусы, фиксация версий.
// Все файлы версии (DOCX, PDF, XLSX) строятся из одного подтверждённого снимка расчёта
// (CalculationVersion) и одной модели документа (ReportDoc) — расхождения между форматами исключены.

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { HttpError } from "../http";
import { logEvent } from "../audit";
import { commitVersion, evaluate } from "./assessment";
import { activeTemplate, loadFiles } from "./report";
import { storeFile } from "./files";
import { defaultDocument } from "@/core/document/defaultDocument";
import { documentToReportDoc, resolveDocument } from "@/core/document/render";
import type { DocContext } from "@/core/document/fields";
import type { DocStatus, DocumentContent } from "@/core/document/model";
import { BLOCKED_MESSAGE } from "@/core/calc/quality";
import { runChecks } from "@/core/checks";
import { renderDocx } from "@/core/report/renderDocx";
import { renderPdf } from "@/core/report/renderPdf";
import { renderXlsx } from "@/core/report/renderXlsx";
import type { AssessmentSnapshot } from "@/core/snapshot";
import type { CalcResult } from "@/core/calc/types";

const reportBlock = z.object({ type: z.string() }).passthrough();
const block = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1).max(80), type: z.literal("text"), style: z.enum(["p", "center", "title", "subheading"]), template: z.string().max(20_000).optional(), text: z.string().max(100_000).nullish(), editedAutoHash: z.string().max(20).nullish() }),
  z.object({ id: z.string().min(1).max(80), type: z.literal("data"), key: z.string().regex(/^[A-Z_]{2,40}$/), edited: z.object({ blocks: z.array(reportBlock).max(500), autoHash: z.string().max(20) }).nullish() }),
]);
export const documentSchema = z.object({
  schema: z.literal(1),
  sections: z.array(z.object({
    id: z.string().min(1).max(80), title: z.string().trim().min(1).max(300), numbered: z.boolean(), pageBreakBefore: z.boolean().optional(), custom: z.boolean().optional(),
    blocks: z.array(block).max(200),
  })).min(1).max(100),
});

const normativeList = () =>
  prisma.normativeDocument.findMany({ where: { status: "active" }, orderBy: [{ kind: "asc" }, { code: "asc" }], select: { code: true, title: true, issuer: true, adoptedAt: true, url: true } })
    .then((r) => r.map((x) => ({ ...x, adoptedAt: x.adoptedAt ? x.adoptedAt.toISOString() : null })));

export async function getDocument(assessmentId: string) {
  const existing = await prisma.reportDocument.findUnique({ where: { assessmentId } });
  if (existing) return existing;
  return prisma.reportDocument.create({ data: { assessmentId, content: defaultDocument() as unknown as Prisma.InputJsonValue } });
}

/** Контекст документа по текущим данным оценки (живой расчёт). */
export async function liveContext(assessmentId: string, ownerId: string): Promise<{ ctx: DocContext; hash: string; latestVersion: { id: string; versionNumber: number; inputHash: string } | null }> {
  const { snapshot, checks, hash, latestVersion } = await evaluate(assessmentId);
  const confirmed = latestVersion && latestVersion.inputHash === hash ? latestVersion.versionNumber : null;
  const ctx: DocContext = { snapshot, result: checks.result, checks, versionNumber: confirmed, files: await loadFiles(snapshot, ownerId), normative: await normativeList(), generatedAt: new Date().toISOString() };
  return { ctx, hash, latestVersion };
}

/** Документ для редактора: структура, разрешённые блоки и сведения о статусе и версиях. */
export async function documentView(assessmentId: string, ownerId: string, withPreview: boolean) {
  const doc = await getDocument(assessmentId);
  const content = doc.content as unknown as DocumentContent;
  const { ctx, hash, latestVersion } = await liveContext(assessmentId, ownerId);
  const versions = await prisma.reportDocumentVersion.findMany({
    where: { assessmentId },
    orderBy: { versionNumber: "desc" },
    select: { id: true, versionNumber: true, status: true, createdAt: true, createdById: true, note: true, docxFileId: true, pdfFileId: true, xlsxFileId: true, calculationVersion: { select: { versionNumber: true, inputHash: true, result: true } } },
  });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(versions.map((v) => v.createdById).filter((x): x is string => !!x))] } }, select: { id: true, email: true, appraiser: { select: { fullName: true } } } });
  const names = new Map(users.map((u) => [u.id, u.appraiser?.fullName || u.email]));
  return {
    id: doc.id,
    status: doc.status as DocStatus,
    updatedAt: doc.updatedAt.toISOString(),
    content,
    sections: resolveDocument(content, ctx),
    preview: withPreview ? documentToReportDoc(content, ctx) : null,
    calc: {
      hasResult: !!ctx.result,
      finalValue: ctx.result?.finalValue ?? null,
      errors: ctx.checks.errors,
      warnings: ctx.checks.warnings,
      confirmedVersion: ctx.versionNumber,
      isStale: !latestVersion || latestVersion.inputHash !== hash,
      inputHash: hash,
    },
    versions: versions.map((v) => ({
      id: v.id, versionNumber: v.versionNumber, status: v.status, createdAt: v.createdAt.toISOString(), createdBy: v.createdById ? names.get(v.createdById) ?? null : null, note: v.note,
      docxFileId: v.docxFileId, pdfFileId: v.pdfFileId, xlsxFileId: v.xlsxFileId,
      calculationVersionNumber: v.calculationVersion.versionNumber,
      finalValue: (v.calculationVersion.result as unknown as CalcResult).finalValue,
      // данные оценки изменились после фиксации этой версии
      outdated: v.calculationVersion.inputHash !== hash,
    })),
  };
}

/** Автосохранение черновика: обычное сохранение без создания версий. */
export async function saveDocument(assessmentId: string, userId: string, content: DocumentContent, baseUpdatedAt: string | null) {
  const doc = await getDocument(assessmentId);
  if (baseUpdatedAt && doc.updatedAt.toISOString() !== baseUpdatedAt) {
    throw new HttpError(409, "Документ изменён в другой вкладке или другим пользователем — обновите страницу");
  }
  // правка подтверждённого или финального документа возвращает его в черновик;
  // зафиксированные версии при этом не меняются
  const status = doc.status === "approved" || doc.status === "final" ? "draft" : doc.status;
  const saved = await prisma.reportDocument.update({ where: { id: doc.id }, data: { content: content as unknown as Prisma.InputJsonValue, status, updatedById: userId } });
  if (status !== doc.status) await logEvent({ assessmentId, userId, action: "update", entity: "report_document", entityId: doc.id, summary: "Документ отчёта изменён после подтверждения — возвращён в черновик" });
  return { updatedAt: saved.updatedAt.toISOString(), status: saved.status as DocStatus };
}

const STATUS_LABEL: Record<string, string> = { draft: "Черновик", review: "На проверке", approved: "Подтверждён", final: "Финальная версия" };

export async function setStatus(assessmentId: string, userId: string, status: "draft" | "review" | "approved") {
  const doc = await getDocument(assessmentId);
  if (status === "approved") {
    const { checks } = await evaluate(assessmentId);
    if (checks.errors > 0) throw new HttpError(422, BLOCKED_MESSAGE, checks.issues.filter((i) => i.severity === "error"));
  }
  const saved = await prisma.reportDocument.update({ where: { id: doc.id }, data: { status, updatedById: userId } });
  await logEvent({ assessmentId, userId, action: "update", entity: "report_document", entityId: doc.id, summary: `Статус отчёта: ${STATUS_LABEL[doc.status]} → ${STATUS_LABEL[status]}` });
  return { status: saved.status as DocStatus, updatedAt: saved.updatedAt.toISOString() };
}

const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;
const safeName = (s: string) => s.replace(/[^\p{L}\p{N}._-]+/gu, "_");

/**
 * Зафиксировать версию отчёта: проверки → подтверждение расчёта (снимок) → документ из снимка →
 * DOCX, PDF и XLSX. final = true — «Сформировать финальную версию» (статус документа «Финальная версия»).
 */
export async function createDocumentVersion(assessmentId: string, userId: string, opts: { final: boolean; note?: string }) {
  const pre = await evaluate(assessmentId);
  if (pre.checks.errors > 0 || !pre.checks.result) throw new HttpError(422, BLOCKED_MESSAGE, pre.checks.issues.filter((i) => i.severity === "error"));
  const doc = await getDocument(assessmentId);
  const content = doc.content as unknown as DocumentContent;
  const { version } = await commitVersion(assessmentId, userId);
  // Документ строится из зафиксированного снимка, а не из живых данных
  const snapshot = version.snapshot as unknown as AssessmentSnapshot;
  const result = version.result as unknown as CalcResult;
  const checks = runChecks(snapshot, { storedResult: result });
  if (checks.issues.some((i) => i.code === "STORED_RESULT_MISMATCH")) throw new HttpError(409, "Зафиксированный расчёт не воспроизводится текущим ядром", checks.issues);
  const ctx: DocContext = { snapshot, result, checks, versionNumber: version.versionNumber, files: await loadFiles(snapshot, userId), normative: await normativeList(), generatedAt: new Date().toISOString() };
  const rendered = documentToReportDoc(content, ctx);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, appraiser: { select: { fullName: true } } } });

  const last = await prisma.reportDocumentVersion.aggregate({ where: { assessmentId }, _max: { versionNumber: true } });
  const versionNumber = (last._max.versionNumber ?? 0) + 1;
  const base = safeName(`Отчёт_${snapshot.assessment.number}_версия_${versionNumber}`);
  const files = {
    docx: await renderDocx(rendered),
    pdf: await renderPdf(rendered),
    xlsx: await renderXlsx(snapshot, result, { versionNumber: version.versionNumber, createdAt: version.createdAt.toISOString(), createdBy: user?.appraiser?.fullName || user?.email || null }),
  };
  const stored: Partial<Record<keyof typeof files, string>> = {};
  for (const fmt of ["docx", "pdf", "xlsx"] as const) {
    const f = await storeFile({ ownerId: userId, assessmentId, kind: "report", filename: fmt === "xlsx" ? `${safeName(`Расчёт_${snapshot.assessment.number}_версия_${versionNumber}`)}.xlsx` : `${base}.${fmt}`, mime: MIME[fmt], data: files[fmt] });
    stored[fmt] = f.id;
  }
  const status = opts.final ? "final" : doc.status === "approved" ? "approved" : "review";
  const dv = await prisma.reportDocumentVersion.create({
    data: {
      assessmentId, versionNumber, status, calculationVersionId: version.id,
      content: content as unknown as Prisma.InputJsonValue, rendered: rendered as unknown as Prisma.InputJsonValue,
      docxFileId: stored.docx, pdfFileId: stored.pdf, xlsxFileId: stored.xlsx, note: opts.note ?? null, createdById: userId,
    },
  });
  const tpl = await activeTemplate();
  for (const fmt of ["docx", "pdf", "xlsx"] as const) {
    await prisma.report.create({
      data: {
        assessmentId, calculationVersionId: version.id, templateId: tpl.id, format: fmt, fileId: stored[fmt]!, documentVersionId: dv.id, createdById: userId,
        checks: { errors: checks.errors, warnings: checks.warnings, issues: checks.issues } as unknown as Prisma.InputJsonValue,
      },
    });
  }
  if (opts.final) await prisma.reportDocument.update({ where: { id: doc.id }, data: { status: "final", updatedById: userId } });
  await logEvent({
    assessmentId, userId, action: "report", entity: "report_document", entityId: dv.id,
    summary: `${opts.final ? "Сформирована финальная версия" : "Зафиксирована версия"} отчёта № ${versionNumber} (расчёт № ${version.versionNumber}: ${result.finalValue} ₽) — DOCX, PDF, XLSX`,
  });
  return { id: dv.id, versionNumber, status, calculationVersionNumber: version.versionNumber, files: stored };
}
