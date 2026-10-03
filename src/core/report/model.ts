// Промежуточная модель документа: шаблон → ReportDoc → DOCX / PDF.
// Рендереры ничего не вычисляют — только раскладывают готовые блоки.

export type ReportBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string; bold?: boolean; italic?: boolean; align?: "left" | "center" | "right" | "justify"; size?: "small" | "normal" | "large" }
  | { type: "kv"; rows: Array<[string, string]> }
  | { type: "table"; header: string[]; rows: string[][]; widths?: number[]; small?: boolean; boldLastRow?: boolean }
  | { type: "image"; data: string; mime: string; caption?: string; maxWidthPx?: number }
  | { type: "pageBreak" };

export interface ReportDoc {
  title: string;
  /** Колонтитул: номер отчёта, дата */
  footer: string;
  blocks: ReportBlock[];
}

/** Определение шаблона отчёта (хранится в БД, версионируется). */
export interface TemplateDefinition {
  title: string;
  sections: TemplateSection[];
}

export interface TemplateSection {
  id: string;
  title?: string;
  pageBreakBefore?: boolean;
  blocks: TemplateBlock[];
}

export type TemplateBlock =
  | { kind: "text"; text: string; bold?: boolean; align?: "left" | "center" | "right" | "justify" }
  | { kind: "builtin"; name: string; options?: Record<string, unknown> };
