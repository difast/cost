import path from "node:path";
import type { ReportBlock, ReportDoc } from "./model";
import { fitSize } from "./imageSize";

// pdfmake (серверная сборка) — шрифты Roboto с кириллицей лежат в assets/fonts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require("pdfmake");

const fontDir = path.join(process.cwd(), "assets", "fonts");
pdfmake.setFonts({
  Roboto: {
    normal: path.join(fontDir, "Roboto-Regular.ttf"),
    bold: path.join(fontDir, "Roboto-Medium.ttf"),
    italics: path.join(fontDir, "Roboto-Italic.ttf"),
    bolditalics: path.join(fontDir, "Roboto-MediumItalic.ttf"),
  },
});
// Внешние ресурсы не загружаются; локальные — только шрифты.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((p: string) => path.resolve(p).startsWith(fontDir));

type Content = Record<string, unknown> | string;

function blockToPdf(b: ReportBlock): Content[] {
  switch (b.type) {
    case "heading":
      return [{ text: b.text, style: b.level === 1 ? "h1" : b.level === 2 ? "h2" : "h3" }];
    case "paragraph":
      return [
        {
          text: b.text,
          bold: b.bold,
          italics: b.italic,
          alignment: b.align ?? "left",
          fontSize: b.size === "small" ? 8.5 : b.size === "large" ? 15 : 10.5,
          margin: [0, 0, 0, 5],
        },
      ];
    case "kv":
      return [
        {
          table: {
            widths: ["35%", "65%"],
            body: b.rows.map(([k, v]) => [{ text: k, fillColor: "#EDEFF2" }, v]),
          },
          layout: "grid",
          fontSize: 9.5,
          margin: [0, 0, 0, 10],
        },
      ];
    case "table": {
      const total = (b.widths ?? b.header.map(() => 1)).reduce((s, x) => s + x, 0);
      const widths = b.header.map((_, i) => `${(((b.widths?.[i] ?? 1) / total) * 100).toFixed(2)}%`);
      return [
        {
          table: {
            headerRows: 1,
            widths,
            body: [
              b.header.map((h) => ({ text: h, bold: true, fillColor: "#EDEFF2" })),
              ...b.rows.map((r, ri) => r.map((v) => ({ text: v, bold: b.boldLastRow && ri === b.rows.length - 1 }))),
            ],
          },
          layout: "grid",
          fontSize: b.small ? 7.5 : 9.5,
          margin: [0, 0, 0, 10],
        },
      ];
    }
    case "image": {
      const buf = Buffer.from(b.data, "base64");
      const { width, height } = fitSize(buf, Math.min(b.maxWidthPx ?? 480, 480), 620);
      const out: Content[] = [{ image: `data:${b.mime};base64,${b.data}`, width, height, alignment: "center", margin: [0, 4, 0, 4] }];
      if (b.caption) out.push({ text: b.caption, italics: true, alignment: "center", fontSize: 8.5, margin: [0, 0, 0, 8] });
      return out;
    }
    case "pageBreak":
      return [{ text: "", pageBreak: "after" }];
  }
}

export async function renderPdf(doc: ReportDoc): Promise<Buffer> {
  const definition = {
    info: { title: doc.title, creator: "Рабочее место оценщика" },
    pageSize: "A4",
    pageMargins: [60, 40, 30, 50],
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.15 },
    styles: {
      h1: { fontSize: 13, bold: true, margin: [0, 12, 0, 6] },
      h2: { fontSize: 11.5, bold: true, margin: [0, 8, 0, 4] },
      h3: { fontSize: 10.5, bold: true, margin: [0, 6, 0, 3] },
    },
    footer: (current: number, count: number) => ({
      text: `${doc.footer} · стр. ${current} из ${count}`,
      alignment: "center",
      fontSize: 7.5,
      color: "#666666",
      margin: [0, 15, 0, 0],
    }),
    content: doc.blocks.flatMap(blockToPdf),
  };
  return pdfmake.createPdf(definition).getBuffer();
}
