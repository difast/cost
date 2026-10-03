import { describe, it, expect } from "vitest";
import { runChecks } from "./index";
import { sampleSnapshot } from "../__fixtures__/sample";

const codes = (s: ReturnType<typeof sampleSnapshot>) => runChecks(s).issues.map((i) => i.code);

describe("runChecks", () => {
  it("корректная оценка — без ошибок, отчёт можно формировать", () => {
    const r = runChecks(sampleSnapshot());
    expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(r.canGenerate).toBe(true);
    expect(r.result?.finalValue).toBeDefined();
  });

  it("другой кадастровый номер в тексте допущений — ошибка (остатки другого отчёта)", () => {
    const s = sampleSnapshot();
    s.assessment.assumptions += " Квартира 50:20:0010203:555 осмотрена.";
    expect(codes(s)).toContain("TEXT_FOREIGN_CADASTRAL");
    expect(runChecks(s).canGenerate).toBe(false);
  });

  it("другая дата оценки в тексте — ошибка", () => {
    const s = sampleSnapshot();
    s.assessment.assumptions = "Дата оценки: 15.03.2025.";
    expect(codes(s)).toContain("TEXT_FOREIGN_VALUATION_DATE");
  });

  it("площадь не совпадает с выпиской ЕГРН", () => {
    const s = sampleSnapshot();
    s.property.area = "43.1";
    s.property.description = null;
    expect(codes(s)).toContain("AREA_MISMATCH");
  });

  it("кадастровый номер не совпадает с выпиской", () => {
    const s = sampleSnapshot();
    s.sources[0].extracted = { ...s.sources[0].extracted, cadastralNumber: "77:01:0001001:9999" };
    expect(codes(s)).toContain("CADASTRAL_MISMATCH");
  });

  it("чужая площадь в описании — предупреждение", () => {
    const s = sampleSnapshot();
    s.property.description = "Квартира площадью 51,3 кв. м";
    expect(codes(s)).toContain("TEXT_FOREIGN_AREA");
  });

  it("ручное изменение корректировки без обоснования — ошибка", () => {
    const s = sampleSnapshot();
    s.comparables[0].adjustments[1] = { ...s.comparables[0].adjustments[1], value: "-0.1", overridden: true, comment: "" };
    expect(codes(s)).toContain("ADJ_NO_COMMENT");
  });

  it("истёкший полис — ошибка", () => {
    const s = sampleSnapshot();
    s.appraiser!.insuranceValidUntil = "2026-09-01T00:00:00.000Z";
    expect(codes(s)).toContain("DOC_EXPIRED");
  });

  it("аналог без источника и даты — ошибка", () => {
    const s = sampleSnapshot();
    s.comparables[0].sourceUrl = null;
    s.comparables[0].retrievedAt = null;
    const c = codes(s);
    expect(c).toContain("COMPARABLE_NO_SOURCE");
    expect(c).toContain("COMPARABLE_NO_DATE");
  });

  it("отчёт раньше даты оценки — ошибка", () => {
    const s = sampleSnapshot();
    s.assessment.reportDate = "2026-09-01T00:00:00.000Z";
    expect(codes(s)).toContain("REPORT_BEFORE_VALUATION");
  });

  it("незаполненные обязательные поля", () => {
    const s = sampleSnapshot();
    s.assessment.customerName = "";
    s.property.cadastralNumber = null;
    const r = runChecks(s);
    expect(r.issues.filter((i) => i.code === "REQUIRED").map((i) => i.field)).toEqual(["customerName", "cadastralNumber"]);
  });

  it("подменённый сохранённый результат обнаруживается", () => {
    const s = sampleSnapshot();
    const ok = runChecks(s).result!;
    const tampered = { ...ok, finalValue: "9789000.00" };
    expect(runChecks(s, { storedResult: tampered }).issues.map((i) => i.code)).toContain("STORED_RESULT_MISMATCH");
    expect(runChecks(s, { storedResult: ok }).issues.map((i) => i.code)).not.toContain("STORED_RESULT_MISMATCH");
  });

  it("дубликат аналога", () => {
    const s = sampleSnapshot();
    s.comparables[1].sourceUrl = s.comparables[0].sourceUrl;
    expect(codes(s)).toContain("COMPARABLE_DUPLICATE");
  });
});
