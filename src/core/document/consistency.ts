// Сверка документа отчёта с данными оценки и расчётом.
// Ручные правки оценщика (тексты, отредактированные таблицы) не перезаписываются автоматически,
// поэтому их значения сверяются с актуальными данными: площадь, кадастровый номер, устаревшие правки.

import { d } from "../calc/decimal";
import { fmtNumber } from "../format";
import { AREA_RE, CADASTRAL_RE, type CheckIssue } from "../checks";
import type { ReportBlock } from "../report/model";
import type { DocContext } from "./fields";
import type { DocumentContent } from "./model";
import { resolveDocument } from "./render";

/** Таблицы, описывающие сам объект: в них площадь и кадастровый номер должны совпадать с объектом. */
const OBJECT_TABLES = new Set(["SUMMARY_TABLE", "OBJECT_TABLE", "ASSIGNMENT_TABLE", "RIGHTS_TABLE", "BUILDING_TABLE"]);

function blocksText(blocks: ReportBlock[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "paragraph" || b.type === "heading") out.push(b.text);
    else if (b.type === "table") for (const r of b.rows) out.push(r.map((c) => String(c ?? "")).join(" | "));
    else if (b.type === "kv") for (const [k, v] of b.rows) out.push(`${k} | ${v}`);
  }
  return out;
}

/** Строка таблицы «Общая площадь | 42,6 …» → число площади (если есть). */
function areaFromRow(line: string): string | null {
  const m = line.match(/^[^|]*общ[а-я]*\s+площад[^|]*\|\s*([\d\s]+(?:[.,]\d+)?)/i);
  return m ? m[1].replace(/\s/g, "").replace(",", ".") : null;
}

export interface DocumentCheckOptions {
  /** Последняя финальная версия документа: устарела ли она относительно текущих данных. */
  lastFinal?: { versionNumber: number; outdated: boolean } | null;
}

export function documentConsistency(doc: DocumentContent, c: DocContext, opts: DocumentCheckOptions = {}): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const p = c.snapshot.property;
  const calcArea = c.result?.subjectArea ?? p.area;
  const known = [p.area, p.livingArea, p.kitchenArea, calcArea].filter((x): x is string => !!x).map((x) => d(x).toString());
  const allowedCad = new Set([p.cadastralNumber?.trim(), c.snapshot.building.cadastralNumber?.trim()].filter(Boolean) as string[]);
  const seen = new Set<string>();
  const push = (i: CheckIssue) => {
    const key = `${i.code}|${i.field}|${i.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(i);
    }
  };

  for (const sec of resolveDocument(doc, c)) {
    for (const b of sec.blocks) {
      if (!b.manual) continue;
      const field = `doc.${b.id}`;
      const where = b.type === "text" ? `раздел «${sec.title}»` : `таблица «${b.label}»`;
      const lines = b.type === "text" ? [b.text] : OBJECT_TABLES.has(b.key) ? blocksText(b.blocks) : [];

      for (const line of lines) {
        const areas = [...line.matchAll(AREA_RE)].map((m) => m[1].replace(",", "."));
        const rowArea = areaFromRow(line);
        if (rowArea) areas.push(rowArea);
        for (const a of areas) {
          if (calcArea && !known.includes(d(a).toString())) {
            push({ code: "REPORT_MISMATCH_AREA", severity: "error", section: "report", field, message: `В отчёте указана площадь ${fmtNumber(a, 1, true)} м², а в расчёте ${fmtNumber(calcArea, 1, true)} м² (${where})` });
          }
        }
        for (const m of line.matchAll(CADASTRAL_RE)) {
          if (allowedCad.size && !allowedCad.has(m[0])) {
            push({ code: "REPORT_MISMATCH_CADASTRAL", severity: "error", section: "report", field, message: `В отчёте указан кадастровый номер ${m[0]}, а у объекта оценки — ${p.cadastralNumber ?? "не указан"} (${where})` });
          }
        }
      }

      if (b.autoChanged) {
        push(b.type === "text"
          ? { code: "REPORT_TEXT_OUTDATED", severity: "warning", section: "report", field, message: `Текст в разделе «${sec.title}» изменён вручную, а данные оценки после этого изменились — сверьте текст с актуальными данными` }
          : { code: "REPORT_TABLE_OUTDATED", severity: "warning", section: "report", field, message: `Таблица «${b.label}» отредактирована вручную, а данные оценки после этого изменились — обновите таблицу или сверьте значения` });
      }
    }
  }

  if (opts.lastFinal?.outdated) {
    push({ code: "REPORT_VERSION_OUTDATED", severity: "info", section: "report", message: `Финальная версия № ${opts.lastFinal.versionNumber} сформирована по прежним данным — после изменений сформируйте новую версию` });
  }
  return issues;
}
