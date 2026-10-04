"use client";

// Постраничный предпросмотр документа (A4, поля и шрифты как в DOCX/PDF).
// Блоки измеряются в скрытом контейнере шириной с полосу набора и раскладываются по страницам;
// таблицы, не помещающиеся на страницу, делятся по строкам с повтором шапки.

import { useLayoutEffect, useRef, useState } from "react";
import type { ReportBlock, ReportDoc } from "@/core/report/model";
import { DOC_FONT, DocBlock, PAGE } from "./DocBlocks";

type Piece = { i: number; rows?: [number, number] };

const CONTENT_W = PAGE.width - PAGE.left - PAGE.right;
const AVAIL = PAGE.height - PAGE.top - PAGE.bottom - PAGE.footer;

export function PagedPreview({ doc }: { doc: ReportDoc }) {
  const measure = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Piece[][] | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 8) / PAGE.width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = measure.current;
    if (!root) return;
    const nodes = [...root.children] as HTMLElement[];
    const h = (n: Element) => n.getBoundingClientRect().height;
    const out: Piece[][] = [[]];
    let left = AVAIL;
    const newPage = () => {
      if (out[out.length - 1].length) out.push([]);
      left = AVAIL;
    };
    doc.blocks.forEach((b, i) => {
      const node = nodes[i];
      if (b.type === "pageBreak") return newPage();
      const height = h(node);
      // заголовок не оставляем внизу страницы: нужен ещё хотя бы фрагмент следующего блока
      if (b.type === "heading") {
        const next = nodes[i + 1];
        const nextMin = next ? Math.min(h(next), 60) : 0;
        if (height + nextMin > left) newPage();
        out[out.length - 1].push({ i });
        left -= height;
        return;
      }
      if (height <= left) {
        out[out.length - 1].push({ i });
        left -= height;
        return;
      }
      if (b.type === "table") {
        const head = node.querySelector("thead");
        const headH = head ? h(head) : 0;
        const rows = [...node.querySelectorAll("tbody > tr")].map(h);
        const tail = 16; // отступ после таблицы
        let start = 0;
        while (start < rows.length) {
          let used = headH, end = start;
          while (end < rows.length && used + rows[end] + tail <= left) used += rows[end++];
          if (end === start) {
            if (left < AVAIL) { newPage(); continue; }
            end = start + 1; // строка выше страницы — выводим как есть
            used += rows[start];
          }
          out[out.length - 1].push({ i, rows: [start, end] });
          left -= used + tail;
          start = end;
          if (start < rows.length) newPage();
        }
        return;
      }
      newPage();
      out[out.length - 1].push({ i });
      left -= height;
    });
    setPages(out.filter((p) => p.length));
  }, [doc]);

  const piece = (p: Piece): ReportBlock => {
    const b = doc.blocks[p.i];
    return p.rows && b.type === "table" ? { ...b, rows: b.rows.slice(p.rows[0], p.rows[1]), boldLastRow: b.boldLastRow && p.rows[1] === b.rows.length } : b;
  };

  return (
    <div ref={outer} className="min-w-0">
      {/* измерение: те же стили, ширина полосы набора */}
      <div aria-hidden className="pointer-events-none relative h-0 overflow-hidden">
        <div className="invisible absolute left-0 top-0" style={{ width: CONTENT_W }}>
          <div ref={measure} className={DOC_FONT}>
            {doc.blocks.map((b, i) => <div key={i} className="flow-root">{b.type === "pageBreak" ? null : <DocBlock b={b} />}</div>)}
          </div>
        </div>
      </div>
      {!pages ? (
        <div className="py-10 text-center text-[12.5px] text-muted">Подготовка страниц…</div>
      ) : (
        <div className="space-y-4">
          <div className="text-[12px] text-muted">Страниц: {pages.length} · A4, поля как в DOCX/PDF</div>
          {pages.map((pg, n) => (
            <div key={n} style={{ width: PAGE.width * scale, height: PAGE.height * scale }} className="mx-auto">
              <div
                className={`relative origin-top-left bg-white shadow-[0_1px_3px_rgba(0,0,0,.12),0_0_0_1px_rgba(0,0,0,.06)] ${DOC_FONT}`}
                style={{ width: PAGE.width, height: PAGE.height, transform: `scale(${scale})`, padding: `${PAGE.top}px ${PAGE.right}px ${PAGE.bottom}px ${PAGE.left}px` }}
              >
                <div style={{ height: AVAIL, overflow: "hidden" }}>
                  {pg.map((p, k) => <div key={k} className="flow-root"><DocBlock b={piece(p)} /></div>)}
                </div>
                <div className="absolute inset-x-0 text-center text-[10.67px] text-[#666]" style={{ bottom: PAGE.bottom / 2 }}>
                  {doc.footer} · стр. {n + 1} из {pages.length}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
