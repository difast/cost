// Сверка отчёта с расчётом: ручные тексты и таблицы против данных оценки.
import { describe, expect, it } from "vitest";
import { sampleSnapshot } from "../__fixtures__/sample";
import { runChecks } from "../checks";
import { buildChecklist } from "../checks/catalog";
import { defaultDocument } from "./defaultDocument";
import { documentConsistency } from "./consistency";
import { autoBlocks } from "./render";
import { hashBlocks, hashText, type DocDataBlock, type DocTextBlock } from "./model";
import type { DocContext } from "./fields";

function ctx(mut?: (s: ReturnType<typeof sampleSnapshot>) => void): DocContext {
  const s = sampleSnapshot();
  mut?.(s);
  const checks = runChecks(s);
  return { snapshot: s, result: checks.result, checks, versionNumber: null, files: {}, normative: [], generatedAt: "2026-10-01T00:00:00Z" };
}
const firstText = (doc: ReturnType<typeof defaultDocument>, sec: string) => doc.sections.find((s) => s.id === sec)!.blocks.find((b) => b.type === "text") as DocTextBlock;
const dataBlock = (doc: ReturnType<typeof defaultDocument>, key: string) => doc.sections.flatMap((s) => s.blocks).find((b) => b.type === "data" && b.key === key) as DocDataBlock;

describe("соответствие отчёта расчёту", () => {
  it("документ без ручных правок — замечаний нет", () => {
    expect(documentConsistency(defaultDocument(), ctx())).toEqual([]);
  });

  it("в ручном тексте другая площадь — «В отчёте указана площадь 42,6 м², а в расчёте 42,9 м²»", () => {
    const doc = defaultDocument();
    const tb = firstText(doc, "object");
    tb.text = "Объект оценки — квартира общей площадью 42,6 м².";
    const r = documentConsistency(doc, ctx());
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ code: "REPORT_MISMATCH_AREA", severity: "error", section: "report", field: `doc.${tb.id}` });
    expect(r[0].message).toMatch(/^В отчёте указана площадь 42,6 м², а в расчёте 42,9 м²/);
  });

  it("совпадающие площади (общая, жилая, кухня) — без замечаний", () => {
    const doc = defaultDocument();
    firstText(doc, "object").text = "Общая площадь 42,9 м², жилая 28,1 м², кухня 7,5 кв. м.";
    expect(documentConsistency(doc, ctx())).toEqual([]);
  });

  it("чужой кадастровый номер в ручном тексте", () => {
    const doc = defaultDocument();
    firstText(doc, "object").text = "Кадастровый номер 77:01:0001001:9999.";
    const r = documentConsistency(doc, ctx());
    expect(r.map((i) => i.code)).toEqual(["REPORT_MISMATCH_CADASTRAL"]);
    expect(r[0].message).toContain("77:01:0001001:1234");
  });

  it("отредактированная таблица объекта: устаревшая правка и расхождение площади", () => {
    const doc = defaultDocument();
    const c1 = ctx();
    const b = dataBlock(doc, "OBJECT_TABLE");
    const auto = autoBlocks("OBJECT_TABLE", c1).blocks;
    b.edited = { blocks: JSON.parse(JSON.stringify(auto)), autoHash: hashBlocks(auto) };
    expect(documentConsistency(doc, c1)).toEqual([]);
    // площадь в оценке изменилась, а таблица отредактирована раньше
    const c2 = ctx((s) => { s.property.area = "43.5"; s.sources = []; });
    const codes = documentConsistency(doc, c2).map((i) => i.code);
    expect(codes).toContain("REPORT_TABLE_OUTDATED");
    expect(codes).toContain("REPORT_MISMATCH_AREA");
  });

  it("ручной текст устарел после изменения данных — предупреждение", () => {
    const doc = defaultDocument();
    const c1 = ctx();
    const tb = firstText(doc, "object");
    tb.text = "Формулировка оценщика без чисел.";
    tb.editedAutoHash = hashText("другой автотекст");
    expect(documentConsistency(doc, c1).map((i) => i.code)).toEqual(["REPORT_TEXT_OUTDATED"]);
  });

  it("финальная версия устарела — информация; замечания отчёта попадают в чек-лист «Отчёт»", () => {
    const r = documentConsistency(defaultDocument(), ctx(), { lastFinal: { versionNumber: 2, outdated: true } });
    expect(r).toMatchObject([{ code: "REPORT_VERSION_OUTDATED", severity: "info" }]);
    const doc = defaultDocument();
    firstText(doc, "object").text = "Площадь 50 м².";
    const cl = buildChecklist(documentConsistency(doc, ctx()), true);
    expect(cl.items.find((i) => i.id === "report_consistency")!.status).toBe("error");
  });
});
