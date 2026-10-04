"use client";

// Отрисовка блоков модели документа (ReportBlock) в виде страницы отчёта.
// Размеры и шрифт соответствуют DOCX/PDF: Times New Roman, 12 pt основной текст, таблицы 11/9 pt.

import type { ReportBlock } from "@/core/report/model";

export const PAGE = { width: 794, height: 1123, top: 76, bottom: 76, left: 113, right: 57, footer: 28 };
export const DOC_FONT = "font-['Times_New_Roman',Times,serif] text-black";

type Edit = (next: ReportBlock) => void;

function Cell({ value, onChange, className = "" }: { value: string; onChange?: (v: string) => void; className?: string }) {
  if (!onChange) return <>{value.split("\n").map((l, i) => <div key={i}>{l || " "}</div>)}</>;
  return (
    <textarea
      className={`block w-full resize-none rounded-sm bg-[#f3f8f5] px-0.5 outline-none ring-brand/40 focus:bg-white focus:ring-1 ${className}`}
      rows={Math.max(1, value.split("\n").length)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function DocBlock({ b, onEdit }: { b: ReportBlock; onEdit?: Edit }) {
  switch (b.type) {
    case "heading":
      return b.level === 1
        ? <h2 className="mb-[8px] mt-[16px] text-[18.67px] font-bold leading-tight">{onEdit ? <Cell value={b.text} onChange={(t) => onEdit({ ...b, text: t })} /> : b.text}</h2>
        : <h3 className="mb-[8px] mt-[16px] text-[16px] font-bold leading-tight">{onEdit ? <Cell value={b.text} onChange={(t) => onEdit({ ...b, text: t })} /> : b.text}</h3>;
    case "paragraph": {
      const size = b.size === "small" ? "text-[13.33px]" : b.size === "large" ? "text-[21.33px]" : "text-[16px]";
      const align = b.align === "center" ? "text-center" : b.align === "right" ? "text-right" : b.align === "justify" ? "text-justify" : "text-left";
      return (
        <div className={`mb-[6.67px] leading-[1.25] ${size} ${align} ${b.bold ? "font-bold" : ""} ${b.italic ? "italic" : ""}`}>
          {onEdit ? <Cell value={b.text} onChange={(t) => onEdit({ ...b, text: t })} className={align} /> : b.text}
        </div>
      );
    }
    case "kv":
      return (
        <table className="mb-[16px] w-full border-collapse text-[14.67px] leading-[1.2]">
          <tbody>
            {b.rows.map(([k, v], i) => (
              <tr key={i}>
                <td className="w-[35%] border border-[#808080] bg-[#edeff2] px-[5px] py-[3px] align-top">{onEdit ? <Cell value={k} onChange={(t) => onEdit({ ...b, rows: b.rows.map((r, j): [string, string] => (j === i ? [t, r[1]] : r)) })} /> : k}</td>
                <td className="border border-[#808080] px-[5px] py-[3px] align-top">{onEdit ? <Cell value={v} onChange={(t) => onEdit({ ...b, rows: b.rows.map((r, j): [string, string] => (j === i ? [r[0], t] : r)) })} /> : <Cell value={v} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "table": {
      const total = (b.widths ?? b.header.map(() => 1)).reduce((s, x) => s + x, 0);
      const w = (i: number) => `${(((b.widths?.[i] ?? 1) / total) * 100).toFixed(2)}%`;
      return (
        <table className={`mb-[16px] w-full table-fixed border-collapse leading-[1.2] ${b.small ? "text-[12px]" : "text-[14.67px]"}`} data-doc-table>
          <thead>
            <tr data-doc-row="header">
              {b.header.map((h, i) => <th key={i} style={{ width: w(i) }} className="border border-[#808080] bg-[#edeff2] px-[5px] py-[3px] text-left align-top font-bold [overflow-wrap:anywhere]">{onEdit ? <Cell value={h} onChange={(t) => onEdit({ ...b, header: b.header.map((x, j) => (j === i ? t : x)) })} /> : h}</th>)}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, ri) => (
              <tr key={ri} data-doc-row={ri} className={b.boldLastRow && ri === b.rows.length - 1 ? "font-bold" : ""}>
                {r.map((v, ci) => (
                  <td key={ci} className="border border-[#808080] px-[5px] py-[3px] align-top [overflow-wrap:anywhere]">
                    {onEdit ? <Cell value={v} onChange={(t) => onEdit({ ...b, rows: b.rows.map((row, j) => (j === ri ? row.map((x, k) => (k === ci ? t : x)) : row)) })} /> : <Cell value={v} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "image":
      return (
        <figure className="mb-[10px] text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:${b.mime};base64,${b.data}`} alt={b.caption ?? ""} className="mx-auto max-h-[700px] max-w-full" />
          {b.caption && <figcaption className="mt-1 text-[13.33px] italic">{b.caption}</figcaption>}
        </figure>
      );
    case "pageBreak":
      return null;
  }
}

export function DocBlocks({ blocks, onChange }: { blocks: ReportBlock[]; onChange?: (blocks: ReportBlock[]) => void }) {
  return (
    <>
      {blocks.map((b, i) => (
        <DocBlock key={i} b={b} onEdit={onChange && b.type !== "image" && b.type !== "pageBreak" ? (nb) => onChange(blocks.map((x, j) => (j === i ? nb : x))) : undefined} />
      ))}
    </>
  );
}
