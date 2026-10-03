import { describe, it, expect } from "vitest";
import { buildReport, interpolate } from "./builder";
import { DEFAULT_TEMPLATE } from "./defaultTemplate";
import { renderDocx } from "./renderDocx";
import { renderPdf } from "./renderPdf";
import { runChecks } from "../checks";
import { sampleSnapshot } from "../__fixtures__/sample";

function ctx() {
  const snapshot = sampleSnapshot();
  const checks = runChecks(snapshot);
  return { snapshot, result: checks.result!, checks, versionNumber: 1, files: {}, generatedAt: "2026-10-01T00:00:00Z" };
}

describe("отчёт", () => {
  it("подстановки", () => {
    expect(interpolate("{{a.valuationDate|date}} / {{x.y}}", { a: { valuationDate: "2026-09-28T00:00:00Z" } })).toBe("28.09.2026 / —");
  });

  it("итог в разных разделах одинаковый", () => {
    const c = ctx();
    const doc = buildReport(DEFAULT_TEMPLATE, c);
    const text = JSON.stringify(doc.blocks);
    const final = c.result.finalValue;
    expect(final).toBe("8777000.00"); // ≈ 204 589 ₽/м² × 42,9 м²
    // итог встречается в «основных фактах» и в разделе «итоговая величина»
    const occurrences = text.split("8\u00A0777\u00A0000").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(3);
    // кадастровый номер — только объекта и здания
    const cads = new Set(text.match(/\d{2}:\d{2}:\d{6,7}:\d+/g));
    expect([...cads].sort()).toEqual(["77:01:0001001:1000", "77:01:0001001:1234"]);
  });

  it("DOCX и PDF формируются", async () => {
    const doc = buildReport(DEFAULT_TEMPLATE, ctx());
    const docx = await renderDocx(doc);
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    const pdf = await renderPdf(doc);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30000);
});
