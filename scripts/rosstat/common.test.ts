import { describe, expect, it } from "vitest";
// @ts-expect-error — модуль на JavaScript (скрипты импорта запускаются через node без сборки)
import { parseNumber, parsePeriod } from "./common.mjs";

describe("Росстат: разбор значений", () => {
  it("периоды в типичных подписях", () => {
    expect(parsePeriod("2025")).toEqual({ period: "2025", start: "2025-01-01" });
    expect(parsePeriod("2025 г.")).toEqual({ period: "2025", start: "2025-01-01" });
    expect(parsePeriod("I квартал 2026")).toEqual({ period: "2026-Q1", start: "2026-01-01" });
    expect(parsePeriod("4 кв. 2025")).toEqual({ period: "2025-Q4", start: "2025-10-01" });
    expect(parsePeriod("2026-Q2")).toEqual({ period: "2026-Q2", start: "2026-04-01" });
    expect(parsePeriod("май 2026")).toEqual({ period: "2026-05", start: "2026-05-01" });
    expect(parsePeriod("Март 2026")).toEqual({ period: "2026-03", start: "2026-03-01" });
    expect(parsePeriod("2026-09")).toEqual({ period: "2026-09", start: "2026-09-01" });
    expect(parsePeriod("Российская Федерация")).toBeNull();
  });
  it("числа: пробелы, запятая, пропуски", () => {
    expect(parseNumber("1 234,5")).toBe(1234.5);
    expect(parseNumber("…")).toBeNull();
    expect(parseNumber("-")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
});
