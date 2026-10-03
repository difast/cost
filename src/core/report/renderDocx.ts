import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ReportBlock, ReportDoc } from "./model";
import { fitSize } from "./imageSize";

const FONT = "Times New Roman";
const ALIGN = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
} as const;

const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text: string, opts: { bold?: boolean; size: number; widthPct?: number; shade?: boolean }) {
  return new TableCell({
    borders,
    width: opts.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shade ? { fill: "EDEFF2" } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: text.split("\n").map(
      (line) => new Paragraph({ children: [new TextRun({ text: line, bold: opts.bold, size: opts.size, font: FONT })] }),
    ),
  });
}

function blockToDocx(b: ReportBlock): Array<Paragraph | Table> {
  switch (b.type) {
    case "heading":
      return [
        new Paragraph({
          heading: b.level === 1 ? HeadingLevel.HEADING_1 : b.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: b.text, bold: true, font: FONT, size: b.level === 1 ? 28 : 24, color: "000000" })],
        }),
      ];
    case "paragraph":
      return [
        new Paragraph({
          alignment: ALIGN[b.align ?? "left"],
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: b.text,
              bold: b.bold,
              italics: b.italic,
              font: FONT,
              size: b.size === "small" ? 20 : b.size === "large" ? 32 : 24,
            }),
          ],
        }),
      ];
    case "kv":
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: b.rows.map(
            ([k, v]) => new TableRow({ children: [cell(k, { size: 22, widthPct: 35, shade: true }), cell(v, { size: 22, widthPct: 65 })] }),
          ),
        }),
        new Paragraph({ text: "" }),
      ];
    case "table": {
      const size = b.small ? 18 : 22;
      const cols = b.header.length;
      const total = (b.widths ?? Array(cols).fill(1)).reduce((s, x) => s + x, 0);
      const pct = (i: number) => Math.round(((b.widths?.[i] ?? 1) / total) * 100);
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: b.header.map((h, i) => cell(h, { bold: true, size, widthPct: pct(i), shade: true })) }),
            ...b.rows.map(
              (r, ri) =>
                new TableRow({
                  children: r.map((v, i) => cell(v, { size, widthPct: pct(i), bold: b.boldLastRow && ri === b.rows.length - 1 })),
                }),
            ),
          ],
        }),
        new Paragraph({ text: "" }),
      ];
    }
    case "image": {
      const buf = Buffer.from(b.data, "base64");
      const { width, height } = fitSize(buf, b.maxWidthPx ?? 600, 800);
      const out: Paragraph[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ type: b.mime === "image/png" ? "png" : "jpg", data: buf, transformation: { width, height } })],
        }),
      ];
      if (b.caption) out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: b.caption, italics: true, size: 20, font: FONT })] }));
      return out;
    }
    case "pageBreak":
      return [new Paragraph({ children: [new PageBreak()] })];
  }
}

export async function renderDocx(doc: ReportDoc): Promise<Buffer> {
  const document = new Document({
    creator: "Рабочее место оценщика",
    title: doc.title,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: doc.footer + " · стр. ", size: 16, font: FONT, color: "666666" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONT, color: "666666" }),
                ],
              }),
            ],
          }),
        },
        children: doc.blocks.flatMap(blockToDocx),
      },
    ],
  });
  return Packer.toBuffer(document);
}
