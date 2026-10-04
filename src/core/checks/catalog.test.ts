import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildChecklist, CHECK_CATALOG } from "./catalog";
import { runChecks } from "./index";
import { sampleSnapshot } from "../__fixtures__/sample";

describe("каталог проверок", () => {
  it("каждый код, который выдают проверки, входит в каталог", () => {
    const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const codes = [...new Set([...src.matchAll(/code: "([A-Z_]+)"/g)].map((m) => m[1]))];
    const known = new Set(CHECK_CATALOG.flatMap((c) => c.codes));
    expect(codes.filter((c) => !known.has(c))).toEqual([]);
  });

  it("корректная оценка — все пункты пройдены", () => {
    const r = runChecks(sampleSnapshot());
    const cl = buildChecklist(r.issues, !!r.result);
    expect(cl.errors).toBe(0);
    expect(cl.other).toEqual([]);
    expect(cl.passed + cl.warnings).toBe(cl.total);
  });

  it("REQUIRED распределяется по разделам", () => {
    const s = sampleSnapshot();
    s.assessment.customerName = null;
    s.property.rooms = null;
    const cl = buildChecklist(runChecks(s).issues, true);
    const by = (id: string) => cl.items.find((i) => i.id === id)!;
    expect(by("assignment_required").status).toBe("error");
    expect(by("property_required").status).toBe("error");
    expect(by("appraiser_profile").status).toBe("passed");
  });

  it("без расчёта пункты расчёта не выполнены", () => {
    const cl = buildChecklist([], false);
    expect(cl.items.find((i) => i.id === "total")!.status).toBe("pending");
  });
});
