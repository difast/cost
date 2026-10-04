import { describe, expect, it } from "vitest";
// @ts-expect-error — модуль на JavaScript (скрипт импорта запускается через node без сборки)
import { createGarParser, garFileKind, garRegionOf, houseLabel, normalizeAddress } from "./parse.mjs";

describe("ГАР: разбор XML потоком", () => {
  it("тип файла и регион по пути в архиве", () => {
    expect(garFileKind("77/AS_ADDR_OBJ_20261002_1a2b.XML")).toBe("addr");
    expect(garFileKind("77/AS_ADDR_OBJ_PARAMS_20261002_1a2b.XML")).toBeNull();
    expect(garFileKind("77/AS_ADDR_OBJ_DIVISION_20261002_1a2b.XML")).toBeNull();
    expect(garFileKind("77/AS_HOUSES_20261002_x.XML")).toBe("house");
    expect(garFileKind("77/AS_HOUSES_PARAMS_20261002_x.XML")).toBeNull();
    expect(garFileKind("77/AS_MUN_HIERARCHY_20261002_x.XML")).toBe("hier");
    expect(garFileKind("AS_HOUSE_TYPES_20261002_x.XML")).toBe("houseTypes");
    expect(garRegionOf("77/AS_HOUSES_20261002_x.XML")).toBe(77);
    expect(garRegionOf("AS_HOUSE_TYPES_20261002_x.XML")).toBeNull();
  });

  it("элементы, разрезанные на произвольные порции, разбираются; неактуальные отбрасываются", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?><ADDRESSOBJECTS>` +
      `<OBJECT ID="1" OBJECTID="100" OBJECTGUID="g-100" NAME="Тверская" TYPENAME="ул." LEVEL="8" ISACTUAL="1" ISACTIVE="1" />` +
      `<OBJECT ID="2" OBJECTID="101" OBJECTGUID="g-101" NAME="Старая" TYPENAME="ул." LEVEL="8" ISACTUAL="0" ISACTIVE="1" />` +
      `</ADDRESSOBJECTS>`;
    const out: unknown[] = [];
    const p = createGarParser("addr", 77, (r: unknown) => out.push(r));
    for (let i = 0; i < xml.length; i += 7) p.write(xml.slice(i, i + 7));
    p.close();
    expect(out).toEqual([{ objectId: "100", guid: "g-100", name: "Тверская", typeName: "ул.", level: 8, regionCode: 77 }]);
  });

  it("номер дома из справочников типов и нормализация адреса", () => {
    const ht = new Map([[2, { shortName: "д." }]]);
    const at = new Map([[1, { shortName: "корп." }], [2, { shortName: "стр." }]]);
    expect(houseLabel({ houseType: 2, houseNum: "12", addType1: 1, addNum1: "1", addType2: null, addNum2: null }, ht, at)).toBe("д. 12, корп. 1");
    expect(normalizeAddress("г. Москва, ул. Тверская, д. 12, корп. 1")).toBe("г москва ул тверская д 12 корп 1");
    expect(normalizeAddress("Ёлкино")).toBe("елкино");
  });
});
