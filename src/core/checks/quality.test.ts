// Контроль качества: замечания не блокируют отчёт, ведут к полю, отслеживаются до исправления.
import { describe, expect, it } from "vitest";
import { sampleSnapshot } from "../__fixtures__/sample";
import { runChecks } from "./index";
import { buildChecklist } from "./catalog";
import { fieldCandidates, issueTarget } from "./target";
import { trackIssues } from "./tracking";
import { ISSUES_MESSAGE } from "../calc/quality";
import { defaultDocument } from "../document/defaultDocument";
import { documentToReportDoc } from "../document/render";
import type { DocContext } from "../document/fields";

const docCtx = (s: ReturnType<typeof sampleSnapshot>): DocContext => {
  const checks = runChecks(s);
  return { snapshot: s, result: checks.result, checks, versionNumber: null, files: {}, normative: [], generatedAt: "2026-10-01T00:00:00Z" };
};

describe("обязательные поля и сообщения", () => {
  it("не заполнено обязательное поле — ошибка с путём поля", () => {
    const s = sampleSnapshot();
    s.assessment.customerName = null;
    const i = runChecks(s).issues.find((x) => x.code === "REQUIRED" && x.field === "customerName")!;
    expect(i).toMatchObject({ severity: "error", section: "assignment", message: "Не заполнено поле «Заказчик»" });
  });
  it("вместо «блокирует» — «Есть замечания, требующие внимания»", () => {
    expect(ISSUES_MESSAGE).toBe("Есть замечания, требующие внимания.");
  });
  it("расхождение площади с источником — понятное сообщение", () => {
    const s = sampleSnapshot();
    s.property.area = "43.1";
    const i = runChecks(s).issues.find((x) => x.code === "AREA_MISMATCH")!;
    expect(i.message).toMatch(/^Обнаружено расхождение площади\. Проверьте исходные данные/);
    expect(i.field).toBe("area");
  });
  it("рост разброса после корректировок — предупреждение с точным текстом", () => {
    const s = sampleSnapshot();
    const a = s.comparables[0].adjustments.find((x) => x.stage === 2)!;
    Object.assign(a, { value: "0.45", overridden: true, comment: "проверка разброса" });
    const i = runChecks(s).issues.find((x) => x.code === "DISPERSION_GROWTH")!;
    expect(i.severity).toBe("warning");
    expect(i.message).toContain("После корректировок разброс цен увеличился. Проверьте выбор аналогов и применённые корректировки.");
  });
});

describe("отчёт доступен при любых ошибках", () => {
  it("много ошибок: документ строится, ошибки — в разделе «Замечания к оценке», черновик помечен", () => {
    const s = sampleSnapshot();
    s.assessment.customerName = null;
    s.assessment.contractNumber = null;
    s.assessment.basis = null;
    s.property.cadastralNumber = "неверный";
    s.property.area = "43.1";
    const c = docCtx(s);
    expect(c.checks.errors).toBeGreaterThanOrEqual(4);
    const doc = documentToReportDoc(defaultDocument(), c, { remarks: true, draft: true });
    const t = JSON.stringify(doc.blocks);
    expect(t).toContain("Замечания к оценке");
    expect(t).toContain("Не заполнено поле «Заказчик»");
    expect(t).toContain("ЧЕРНОВИК");
    expect(doc.footer.startsWith("ЧЕРНОВИК")).toBe(true);
    // без замечаний — раздела нет
    const clean = documentToReportDoc(defaultDocument(), docCtx(sampleSnapshot()), { remarks: true });
    expect(JSON.stringify(clean.blocks).includes("Замечания к оценке")).toBe(runChecks(sampleSnapshot()).issues.some((i) => i.severity !== "info"));
  });
  it("документ строится даже без расчёта (нет аналогов)", () => {
    const s = sampleSnapshot();
    s.comparables = [];
    const c = docCtx(s);
    expect(c.result).toBeNull();
    expect(() => documentToReportDoc(defaultDocument(), c, { remarks: true, draft: true })).not.toThrow();
  });
  it("каждая ошибка учитывается в чек-листе отдельно", () => {
    const s = sampleSnapshot();
    s.assessment.customerName = null;
    s.property.floor = 12;
    const cl = buildChecklist(runChecks(s).issues, true);
    expect(cl.errors).toBeGreaterThanOrEqual(2);
  });
});

describe("переход к полю", () => {
  it("раздел и поле по замечанию", () => {
    expect(issueTarget({ section: "assignment", field: "customerName" })).toMatchObject({ tab: "assignment", field: "customerName" });
    expect(issueTarget({ section: "property", field: "building.floors" })).toMatchObject({ tab: "property", field: "building.floors" });
    expect(issueTarget({ section: "text", field: "description" })).toMatchObject({ tab: "property", field: "description" });
    expect(issueTarget({ section: "text", field: "assumptions" })).toMatchObject({ tab: "assignment" });
    expect(issueTarget({ section: "comparables", field: "comparable.c1.sourceUrl" })).toMatchObject({ tab: "comparables", field: "comparable.c1.sourceUrl" });
    expect(issueTarget({ section: "adjustments", field: "adjustment.a1" })).toMatchObject({ tab: "adjustments", field: "adjustment.a1" });
    expect(issueTarget({ section: "appraiser", field: "sroName" })).toMatchObject({ tab: null, href: "/app/profile" });
    expect(issueTarget({ section: "report", field: "doc.b1" })).toMatchObject({ tab: "report", field: "doc.b1" });
    expect(issueTarget({ section: "calculation" })).toMatchObject({ tab: "calculation", field: undefined });
  });
  it("поле аналога ищется сначала точно, затем — карточка аналога", () => {
    expect(fieldCandidates("comparable.c1.sourceUrl")).toEqual(["comparable.c1.sourceUrl", "comparable.c1"]);
    expect(fieldCandidates("area")).toEqual(["area"]);
  });
  it("у каждого замечания по объекту и заданию есть поле для перехода", () => {
    const s = sampleSnapshot();
    s.assessment.customerName = null;
    s.property.area = "43.1";
    s.property.finishing = null;
    const list = runChecks(s).issues.filter((i) => i.section === "assignment" || i.section === "property");
    expect(list.length).toBeGreaterThan(0);
    for (const i of list) expect(i.field, i.code).toBeTruthy();
  });
});

describe("статус «Исправлено»", () => {
  const issue = (code: string, field: string, severity: "error" | "warning" = "error") => ({ code, severity, section: "property" as const, field, message: `${code} ${field}` });
  it("пропавшее замечание получает статус «Исправлено», вернувшееся — снова активно", () => {
    const t0 = new Date("2026-10-01T10:00:00Z");
    const a = trackIssues(null, [issue("REQUIRED", "area"), issue("FLOOR_GT_FLOORS", "floor", "warning")], t0);
    expect(a.items.map((i) => i.status)).toEqual(["error", "warning"]);
    expect(a.changed).toBe(true);
    const b = trackIssues(a.state, [issue("FLOOR_GT_FLOORS", "floor", "warning")], new Date("2026-10-01T11:00:00Z"));
    expect(b.items.find((i) => i.code === "REQUIRED")).toMatchObject({ status: "fixed", fixedAt: "2026-10-01T11:00:00.000Z", firstSeenAt: t0.toISOString() });
    const same = trackIssues(b.state, [issue("FLOOR_GT_FLOORS", "floor", "warning")], new Date("2026-10-01T12:00:00Z"));
    expect(same.changed).toBe(false);
    const c = trackIssues(b.state, [issue("REQUIRED", "area"), issue("FLOOR_GT_FLOORS", "floor", "warning")], new Date("2026-10-02T00:00:00Z"));
    expect(c.items.find((i) => i.code === "REQUIRED")!.status).toBe("error");
  });
  it("исправленные хранятся 14 дней", () => {
    const a = trackIssues(null, [issue("REQUIRED", "area")], new Date("2026-10-01T00:00:00Z"));
    const b = trackIssues(a.state, [], new Date("2026-10-02T00:00:00Z"));
    expect(b.items).toHaveLength(1);
    const c = trackIssues(b.state, [], new Date("2026-10-20T00:00:00Z"));
    expect(c.items).toHaveLength(0);
  });
});

describe("подпись перехода", () => {
  it("«Перейти к заданию» для поля задания, профиль — для оценщика", async () => {
    const { goLabel } = await import("./target");
    expect(goLabel(issueTarget({ section: "assignment", field: "customerName" }))).toBe("Перейти к заданию");
    expect(goLabel(issueTarget({ section: "appraiser" }))).toBe("Перейти к профилю оценщика");
  });
});
