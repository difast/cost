// Рабочий документ отчёта: структура разделов и блоков.
// Автоматические данные и ручной текст разделены на уровне модели:
//   текстовый блок — template (автоматический текст с полями {{OBJECT_ADDRESS}} …) и text (правка оценщика);
//   блок данных — key (таблица из оценки) и edited (отредактированная копия таблицы).
// Правки оценщика не перезаписываются при пересчёте; если автоматическое содержимое изменилось
// после правки, блок помечается «требует обновления» (сравнение хэшей).

import type { ReportBlock } from "../report/model";

export type DocStatus = "draft" | "review" | "approved" | "final";
export const DOC_STATUS_LABEL: Record<DocStatus, string> = { draft: "Черновик", review: "На проверке", approved: "Подтверждён", final: "Финальная версия" };

export type TextStyle = "p" | "center" | "title" | "subheading";

export interface DocTextBlock {
  id: string;
  type: "text";
  style: TextStyle;
  /** Автоматический текст с полями {{KEY}}; отсутствует у блоков, добавленных оценщиком. */
  template?: string;
  /** Текст оценщика; null/отсутствует — используется автоматический. */
  text?: string | null;
  /** Хэш автоматического текста на момент правки. */
  editedAutoHash?: string | null;
}

export interface DocDataBlock {
  id: string;
  type: "data";
  /** Ключ блока данных: COMPARABLES_TABLE, ADJUSTMENTS_TABLE, … */
  key: string;
  /** Отредактированная копия содержимого и хэш автоматического содержимого на момент правки. */
  edited?: { blocks: ReportBlock[]; autoHash: string } | null;
}

export type DocBlock = DocTextBlock | DocDataBlock;

export interface DocSection {
  id: string;
  title: string;
  /** Нумеруется ли раздел (титульная часть — нет). */
  numbered: boolean;
  pageBreakBefore?: boolean;
  /** Раздел добавлен оценщиком. */
  custom?: boolean;
  blocks: DocBlock[];
}

export interface DocumentContent {
  schema: 1;
  sections: DocSection[];
}

/** Детерминированный хэш строки (FNV-1a, 32 бита) — одинаков на сервере и в браузере. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export const hashBlocks = (b: ReportBlock[]) => hashText(JSON.stringify(b));
