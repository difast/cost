// Контроль качества оценки: проверки расчётного ядра + сверка документа отчёта + статус «Исправлено».
// Ничего не блокирует: результат — перечень замечаний с уровнем, источником и переходом к полю.

import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { evaluate } from "./assessment";
import { getDocument } from "./reportDocument";
import { documentConsistency } from "@/core/document/consistency";
import type { DocContext } from "@/core/document/fields";
import type { DocumentContent } from "@/core/document/model";
import { trackIssues, type QualityState } from "@/core/checks/tracking";
import { buildChecklist } from "@/core/checks/catalog";
import { ISSUES_MESSAGE } from "@/core/calc/quality";

export async function qualityReport(assessmentId: string) {
  const { snapshot, checks, hash } = await evaluate(assessmentId);
  const doc = await getDocument(assessmentId);
  const lastFinal = await prisma.reportDocumentVersion.findFirst({
    where: { assessmentId, status: "final" },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true, calculationVersion: { select: { inputHash: true } } },
  });
  // для сверки текстов и таблиц файлы (скриншоты, фото) не нужны
  const ctx: DocContext = { snapshot, result: checks.result, checks, versionNumber: null, files: [] as unknown as DocContext["files"], normative: [], generatedAt: new Date().toISOString() };
  const docIssues = documentConsistency(doc.content as unknown as DocumentContent, ctx, {
    lastFinal: lastFinal ? { versionNumber: lastFinal.versionNumber, outdated: lastFinal.calculationVersion.inputHash !== hash } : null,
  });
  const all = [...checks.issues, ...docIssues];

  const calc = await prisma.calculation.findUnique({ where: { assessmentId }, select: { id: true, qualityState: true } });
  const tracked = trackIssues(calc?.qualityState as QualityState | null, all);
  if (calc && tracked.changed) {
    await prisma.calculation.update({ where: { id: calc.id }, data: { qualityState: tracked.state as unknown as Prisma.InputJsonValue } });
  }
  const count = (s: string) => tracked.items.filter((i) => i.status === s).length;
  const errors = count("error"), warnings = count("warning");
  return {
    summary: errors || warnings ? ISSUES_MESSAGE : "Замечаний нет.",
    counts: { errors, warnings, info: count("info"), fixed: count("fixed") },
    items: tracked.items,
    checklist: buildChecklist(all, !!checks.result),
    hasResult: !!checks.result,
  };
}
