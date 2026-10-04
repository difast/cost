// Документ отчёта → разрешённые блоки (для редактора) и модель ReportDoc (для предпросмотра, DOCX, PDF).
// Один путь для всех форматов: предпросмотр, DOCX и PDF строятся из одного ReportDoc.

import { renderBuiltin, reportFooter, type BuildContext } from "../report/builder";
import type { ReportBlock, ReportDoc } from "../report/model";
import { BLOCK_BY_KEY, FIELD_BY_KEY, type DocContext } from "./fields";
import { hashBlocks, hashText, type DocumentContent, type DocSection, type TextStyle } from "./model";

export const NO_VALUE = "—";

export interface TextSegment { text: string; field?: string; missing?: boolean }

/** Подстановка полей {{KEY}}: текст, сегменты (для подсветки в редакторе) и отсутствующие значения. */
export function resolveTemplate(template: string, c: DocContext): { text: string; segments: TextSegment[]; missing: string[]; fields: string[] } {
  const segments: TextSegment[] = [];
  const missing: string[] = [];
  const fields: string[] = [];
  let last = 0;
  for (const m of template.matchAll(/\{\{\s*([A-Z_]+)\s*\}\}/g)) {
    if (m.index! > last) segments.push({ text: template.slice(last, m.index) });
    const f = FIELD_BY_KEY.get(m[1]);
    const val = f ? f.resolve(c) : null;
    fields.push(m[1]);
    if (val === null) missing.push(m[1]);
    segments.push({ text: val ?? NO_VALUE, field: m[1], missing: val === null });
    last = m.index! + m[0].length;
  }
  if (last < template.length) segments.push({ text: template.slice(last) });
  return { text: segments.map((s) => s.text).join(""), segments, missing, fields };
}

/** Автоматическое содержимое блока данных. available = false — данных пока нет (например, расчёт не выполнен). */
export function autoBlocks(key: string, c: DocContext): { blocks: ReportBlock[]; available: boolean } {
  const def = BLOCK_BY_KEY.get(key);
  if (!def) return { blocks: [{ type: "paragraph", italic: true, text: `Неизвестный блок: ${key}` }], available: false };
  if (def.needsResult && !c.result) return { blocks: [{ type: "paragraph", italic: true, text: "Данные появятся после расчёта стоимости." }], available: false };
  return { blocks: renderBuiltin(def.builtin, { ...c, versionNumber: c.versionNumber ?? 0 } as BuildContext, def.options ?? {}), available: true };
}

export type ResolvedBlock =
  | { id: string; type: "text"; style: TextStyle; auto: string | null; segments: TextSegment[] | null; text: string; manual: boolean; autoChanged: boolean; missing: string[]; fields: string[]; custom: boolean }
  | { id: string; type: "data"; key: string; label: string; editable: boolean; auto: ReportBlock[]; blocks: ReportBlock[]; manual: boolean; autoChanged: boolean; available: boolean };

export interface ResolvedSection { id: string; title: string; number: number | null; numbered: boolean; pageBreakBefore: boolean; custom: boolean; blocks: ResolvedBlock[] }

export function resolveDocument(doc: DocumentContent, c: DocContext): ResolvedSection[] {
  let n = 0;
  return doc.sections.map((sec) => ({
    id: sec.id,
    title: sec.title,
    numbered: sec.numbered,
    number: sec.numbered ? ++n : null,
    pageBreakBefore: !!sec.pageBreakBefore,
    custom: !!sec.custom,
    blocks: sec.blocks.map((b): ResolvedBlock => {
      if (b.type === "text") {
        const auto = b.template !== undefined ? resolveTemplate(b.template, c) : null;
        const manual = b.text !== null && b.text !== undefined;
        return {
          id: b.id, type: "text", style: b.style, auto: auto?.text ?? null, segments: auto && !manual ? auto.segments : null,
          text: manual ? b.text! : auto?.text ?? "", manual, custom: b.template === undefined,
          autoChanged: manual && !!auto && !!b.editedAutoHash && b.editedAutoHash !== hashText(auto.text),
          missing: auto?.missing ?? [], fields: auto?.fields ?? [],
        };
      }
      const def = BLOCK_BY_KEY.get(b.key);
      const a = autoBlocks(b.key, c);
      const manual = !!b.edited;
      return {
        id: b.id, type: "data", key: b.key, label: def?.label ?? b.key, editable: !!def?.editable, auto: a.blocks, available: a.available,
        blocks: manual ? b.edited!.blocks : a.blocks, manual, autoChanged: manual && a.available && b.edited!.autoHash !== hashBlocks(a.blocks),
      };
    }),
  }));
}

function textToBlocks(text: string, style: TextStyle): ReportBlock[] {
  const out: ReportBlock[] = [];
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (!l || l === NO_VALUE) continue;
    if (style === "subheading") out.push({ type: "heading", level: 2, text: l });
    else if (style === "title") out.push({ type: "paragraph", text: l, bold: true, align: "center", size: "large" });
    else if (style === "center") out.push({ type: "paragraph", text: l, align: "center" });
    else {
      const m = l.match(/^(#{2,3})\s+(.*)$/);
      out.push(m ? { type: "heading", level: m[1].length as 2 | 3, text: m[2] } : { type: "paragraph", text: l, align: "justify" });
    }
  }
  return out;
}

/** Модель документа для предпросмотра, DOCX и PDF. */
export function documentToReportDoc(doc: DocumentContent, c: DocContext): ReportDoc {
  const blocks: ReportBlock[] = [];
  for (const sec of resolveDocument(doc, c)) {
    if (sec.pageBreakBefore && blocks.length) blocks.push({ type: "pageBreak" });
    if (sec.numbered) blocks.push({ type: "heading", level: 1, text: `${sec.number}. ${sec.title}` });
    for (const b of sec.blocks) blocks.push(...(b.type === "text" ? textToBlocks(b.text, b.style) : b.blocks));
  }
  const s = c.snapshot;
  return {
    title: `Отчёт № ${s.assessment.number} об оценке рыночной стоимости: ${s.property.address ?? NO_VALUE}`,
    footer: reportFooter(s),
    blocks,
  };
}

/** Поиск раздела и блока по id. */
export function findBlock(doc: DocumentContent, id: string): { section: DocSection; index: number } | null {
  for (const section of doc.sections) {
    const index = section.blocks.findIndex((b) => b.id === id);
    if (index >= 0) return { section, index };
  }
  return null;
}
