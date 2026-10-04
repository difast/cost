import { describe, it, expect } from "vitest";
import { parseComparablesCsv } from "./csv";

describe("parseComparablesCsv", () => {
  it("русские заголовки, точка с запятой", () => {
    const r = parseComparablesCsv(
      "Ссылка;Источник;Дата получения;Адрес;Цена;Площадь;Этаж;Этажность;Материал;Мебель\n" +
        'https://e.org/1;ЦИАН;20.09.2026;"г. Москва, ул. А, 1";10 000 000;45,5;3;9;панельный;да\n' +
        ";;;;;;\n",
    );
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ sourceUrl: "https://e.org/1", retrievedAt: "2026-09-20", address: "г. Москва, ул. А, 1", price: "10000000", area: "45.5", floor: 3, wallMaterial: "panel", furniture: true });
  });
});
