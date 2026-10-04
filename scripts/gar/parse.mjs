// Потоковый разбор XML ГАР (ФИАС) по официальной XSD-схеме ФНС.
// Файл никогда не загружается в память целиком: SAX-парсер получает текст порциями,
// из каждого элемента извлекаются только нужные атрибуты.
//
//   AS_ADDR_OBJ_*.XML        <OBJECT OBJECTID OBJECTGUID NAME TYPENAME LEVEL ISACTUAL ISACTIVE/>
//   AS_HOUSES_*.XML          <HOUSE OBJECTID OBJECTGUID HOUSENUM ADDNUM1 ADDNUM2 HOUSETYPE ADDTYPE1 ADDTYPE2 ISACTUAL ISACTIVE/>
//   AS_MUN_HIERARCHY_*.XML   <ITEM OBJECTID PARENTOBJID OKTMO PATH ISACTIVE/>
//   AS_HOUSE_TYPES_*.XML, AS_ADDHOUSE_TYPES_*.XML   <HOUSETYPE ID NAME SHORTNAME ISACTIVE/>

import { SaxesParser } from "saxes";

/** Тип файла ГАР по имени записи в архиве. null — файл не нужен приложению. */
export function garFileKind(entryName) {
  const base = entryName.split("/").pop() ?? "";
  if (/^AS_ADDR_OBJ_\d{8}_/i.test(base)) return "addr";
  if (/^AS_HOUSES_\d{8}_/i.test(base)) return "house";
  if (/^AS_MUN_HIERARCHY_\d{8}_/i.test(base)) return "hier";
  if (/^AS_HOUSE_TYPES_\d{8}_/i.test(base)) return "houseTypes";
  if (/^AS_ADDHOUSE_TYPES_\d{8}_/i.test(base)) return "addHouseTypes";
  return null;
}

/** Код региона из пути записи архива («77/AS_HOUSES_….XML» → 77). null — файл в корне. */
export function garRegionOf(entryName) {
  const m = /^(\d{1,2})\//.exec(entryName);
  return m ? Number(m[1]) : null;
}

const ELEMENT = { addr: "OBJECT", house: "HOUSE", hier: "ITEM", houseTypes: "HOUSETYPE", addHouseTypes: "HOUSETYPE" };
const intOrNull = (v) => (v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const strOrNull = (v) => (v === undefined || v === "" ? null : v);

/** Преобразование атрибутов элемента в запись. null — запись не нужна (неактуальна/неактивна). */
export function garRecord(kind, a, regionCode) {
  switch (kind) {
    case "addr":
      if (a.ISACTUAL !== "1" || a.ISACTIVE !== "1") return null;
      return { objectId: a.OBJECTID, guid: a.OBJECTGUID, name: a.NAME ?? "", typeName: a.TYPENAME ?? "", level: intOrNull(a.LEVEL) ?? 0, regionCode };
    case "house":
      if (a.ISACTUAL !== "1" || a.ISACTIVE !== "1") return null;
      return {
        objectId: a.OBJECTID, guid: a.OBJECTGUID, houseNum: strOrNull(a.HOUSENUM), addNum1: strOrNull(a.ADDNUM1), addNum2: strOrNull(a.ADDNUM2),
        houseType: intOrNull(a.HOUSETYPE), addType1: intOrNull(a.ADDTYPE1), addType2: intOrNull(a.ADDTYPE2), regionCode,
      };
    case "hier":
      if (a.ISACTIVE !== "1" || !a.PATH) return null;
      return { objectId: a.OBJECTID, parentObjId: strOrNull(a.PARENTOBJID), path: a.PATH, oktmo: strOrNull(a.OKTMO), regionCode };
    case "houseTypes":
    case "addHouseTypes":
      return { id: intOrNull(a.ID), name: a.NAME ?? "", shortName: a.SHORTNAME ?? a.NAME ?? "", active: a.ISACTIVE !== "0" && a.ISACTIVE !== "false" };
    default:
      return null;
  }
}

/** SAX-парсер для одного файла: write(текст) по частям, записи отдаются в onRecord. */
export function createGarParser(kind, regionCode, onRecord) {
  const parser = new SaxesParser();
  const want = ELEMENT[kind];
  parser.on("opentag", (node) => {
    if (node.name !== want) return;
    const rec = garRecord(kind, node.attributes, regionCode);
    if (rec) onRecord(rec);
  });
  let error = null;
  parser.on("error", (e) => {
    error = e;
  });
  return {
    write(text) {
      parser.write(text);
      if (error) throw error;
    },
    close() {
      parser.close();
      if (error) throw error;
    },
  };
}

/** Номер дома с типами из справочников ГАР: «д. 12, корп. 1, стр. 2». */
export function houseLabel(h, houseTypes, addTypes) {
  const part = (type, num, dict) => (num ? `${dict.get(type)?.shortName ?? ""} ${num}`.trim() : null);
  return [part(h.houseType, h.houseNum, houseTypes), part(h.addType1, h.addNum1, addTypes), part(h.addType2, h.addNum2, addTypes)].filter(Boolean).join(", ") || null;
}

/** Нормализованная строка адреса для поиска: нижний регистр, ё → е, без пунктуации. */
export function normalizeAddress(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^0-9a-zа-я/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
