// Рабочий документ отчёта: автозаполнение из оценки, разделение ручного текста и автоматических данных,
// согласованность документа, DOCX, PDF и XLSX с расчётом.
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { sampleSnapshot } from "../__fixtures__/sample";
import { runChecks } from "../checks";
import { fmtNumber, fmtRub } from "../format";
import { d } from "../calc/decimal";
import { defaultDocument } from "./defaultDocument";
import { documentToReportDoc, resolveDocument, resolveTemplate } from "./render";
import { hashBlocks, hashText, type DocDataBlock, type DocTextBlock } from "./model";
import type { DocContext } from "./fields";
import { renderDocx } from "../report/renderDocx";
import { renderPdf } from "../report/renderPdf";
import { renderXlsx } from "../report/renderXlsx";

function ctx(mut?: (s: ReturnType<typeof sampleSnapshot>) => void): DocContext {
  const snapshot = sampleSnapshot();
  mut?.(snapshot);
  const checks = runChecks(snapshot);
  return { snapshot, result: checks.result, checks, versionNumber: 1, files: {}, normative: [{ code: "135-ФЗ", title: "Федеральный закон № 135-ФЗ", issuer: "Российская Федерация", adoptedAt: "1998-07-29T00:00:00.000Z", url: "https://www.consultant.ru/document/cons_doc_LAW_19586/" }], generatedAt: "2026-10-01T00:00:00Z" };
}
const textOf = (doc: ReturnType<typeof documentToReportDoc>) => JSON.stringify(doc.blocks);
const findText = (doc: ReturnType<typeof defaultDocument>, sec: string, i = 0) => doc.sections.find((s) => s.id === sec)!.blocks.filter((b) => b.type === "text")[i] as DocTextBlock;
const findData = (doc: ReturnType<typeof defaultDocument>, key: string) => doc.sections.flatMap((s) => s.blocks).find((b) => b.type === "data" && b.key === key) as DocDataBlock;

describe("документ отчёта", () => {
  it("структура: 20 разделов, титульная часть без номера", () => {
    const doc = defaultDocument();
    expect(doc.sections).toHaveLength(20);
    const r = resolveDocument(doc, ctx());
    expect(r[0].number).toBeNull();
    expect(r.at(-1)!.number).toBe(19);
  });

  it("поля подставляются из оценки; технических переменных в документе нет", () => {
    const c = ctx();
    const rd = documentToReportDoc(defaultDocument(), c);
    const t = textOf(rd);
    expect(t).toContain(c.snapshot.property.address!);
    expect(t).toContain(c.snapshot.property.cadastralNumber!);
    expect(t).toContain("42,9 м²");
    expect(t).not.toMatch(/\{\{[A-Z_]+\}\}/);
    const r = resolveTemplate("{{OBJECT_ADDRESS}} / {{UNKNOWN_FIELD}}", c);
    expect(r.missing).toEqual(["UNKNOWN_FIELD"]);
  });

  it("аналоги, корректировки и расчёт в документе совпадают с результатом ядра", () => {
    const c = ctx();
    const r = c.result!;
    const t = textOf(documentToReportDoc(defaultDocument(), c));
    for (const x of r.comparables) {
      expect(t).toContain(fmtNumber(x.unitPrice));
      expect(t).toContain(fmtNumber(x.adjustedUnitPrice));
      expect(t).toContain(fmtNumber(x.weight, r.settings.weightDecimals));
    }
    // коэффициент торга −5 % → K = 0,9500
    expect(t).toContain("0,9500");
    expect(t).toContain(fmtRub(r.finalValue));
    expect(t).toContain(fmtNumber(r.weightedUnitPrice));
  });

  it("ручной текст не перезаписывается при изменении данных; изменение данных помечается", () => {
    const doc = defaultDocument();
    const c1 = ctx();
    const tb = findText(doc, "object");
    const auto = resolveTemplate(tb.template!, c1).text;
    tb.text = "Объект — двухкомнатная квартира (формулировка оценщика).";
    tb.editedAutoHash = hashText(auto);
    let r = resolveDocument(doc, c1).flatMap((s) => s.blocks).find((b) => b.id === tb.id)!;
    expect(r.type === "text" && r.text).toBe(tb.text);
    expect(r.type === "text" && r.autoChanged).toBe(false);
    // площадь в оценке изменилась
    const c2 = ctx((s) => { s.property.area = "43.5"; });
    r = resolveDocument(doc, c2).flatMap((s) => s.blocks).find((b) => b.id === tb.id)!;
    expect(r.type === "text" && r.text).toBe(tb.text);
    expect(r.type === "text" && r.autoChanged).toBe(true);
  });

  it("отредактированная таблица сохраняется; при изменении данных — пометка «требует обновления»", () => {
    const doc = defaultDocument();
    const c1 = ctx();
    const block = findData(doc, "COMPARABLES_TABLE");
    const auto = resolveDocument(doc, c1).flatMap((s) => s.blocks).find((b) => b.id === block.id)!;
    if (auto.type !== "data") throw new Error();
    const edited = structuredClone(auto.auto);
    if (edited[0].type === "table") edited[0].rows[0][0] = "Источник (правка)";
    block.edited = { blocks: edited, autoHash: hashBlocks(auto.auto) };
    expect(textOf(documentToReportDoc(doc, c1))).toContain("Источник (правка)");
    const c2 = ctx((s) => { s.comparables[0].price = "10100000"; });
    const r2 = resolveDocument(doc, c2).flatMap((s) => s.blocks).find((b) => b.id === block.id)!;
    expect(r2.type === "data" && r2.autoChanged).toBe(true);
    expect(textOf(documentToReportDoc(doc, c2))).toContain("Источник (правка)");
  });

  it("без расчёта блоки расчёта показывают заглушку, а не выдуманные значения", () => {
    const c = { ...ctx(), result: null };
    const t = textOf(documentToReportDoc(defaultDocument(), c));
    expect(t).toContain("Данные появятся после расчёта стоимости.");
  });

  it("DOCX, PDF и XLSX построены из тех же данных, что документ", async () => {
    const c = ctx();
    const r = c.result!;
    const rd = documentToReportDoc(defaultDocument(), c);
    const docx = await renderDocx(rd);
    const xml = await (await JSZip.loadAsync(docx)).file("word/document.xml")!.async("string");
    const plain = xml.replace(/<[^>]+>/g, "");
    expect(plain).toContain(fmtRub(r.finalValue));
    expect(plain).toContain(c.snapshot.property.cadastralNumber!);
    for (const x of r.comparables) expect(plain).toContain(fmtNumber(x.adjustedUnitPrice));
    const pdf = await renderPdf(rd);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

    const xlsx = await renderXlsx(c.snapshot, r, { versionNumber: 1, createdAt: "2026-10-01T00:00:00Z", createdBy: "Оценщик" });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Объект", "Аналоги", "Корректировки", "Расчёт", "Источники"]);
    const calc = wb.getWorksheet("Расчёт")!;
    const values: Record<string, unknown> = {};
    calc.eachRow((row) => { values[String(row.getCell(3).value)] = row.getCell(7).value; });
    expect(values["Итоговая стоимость"]).toBe(Number(r.finalValue));
    expect(values["Средневзвешенная цена 1 м²"]).toBe(Number(r.weightedUnitPrice));
    // последовательность шагов: P₀ → P₁ → P₂ у первого аналога
    const steps: Array<[string, unknown]> = [];
    calc.eachRow((row) => { if (row.getCell(1).value === r.comparables[0].label) steps.push([String(row.getCell(2).value), row.getCell(7).value]); });
    expect(steps.slice(0, 3)).toEqual([["P₀", Number(r.comparables[0].unitPrice)], ["P1", Number(r.comparables[0].steps[0].after)], ["P2", Number(r.comparables[0].steps[1].after)]]);
    const obj = wb.getWorksheet("Объект")!;
    let area: unknown = null;
    obj.eachRow((row) => { if (row.getCell(1).value === "Общая площадь, м²") area = row.getCell(2).value; });
    expect(area).toBe(Number(c.snapshot.property.area));
    // коэффициенты на листе «Корректировки» = 1 + применённое значение
    const k = wb.getWorksheet("Корректировки")!;
    k.eachRow((row, n) => { if (n > 1) expect(row.getCell(8).value).toBeCloseTo(1 + Number(row.getCell(7).value), 10); });
    expect(d(r.finalValue).gt(0)).toBe(true);
  }, 60_000);
});
