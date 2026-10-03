// Разбор XML-выписки ЕГРН (Росреестр) об объекте недвижимости (помещении).
// Формат выписок менялся (extract_about_property_room, KUVI-001 и др.), поэтому
// разбор устойчивый: ищем известные теги на любой глубине. Нераспознанные поля
// оценщик вводит вручную — ничего не «додумывается».
//
// Внешний API Росреестра здесь не используется: пользователь загружает файл выписки сам.

export interface EgrnExtract {
  cadastralNumber?: string;
  area?: string;
  address?: string;
  floor?: number;
  purpose?: string;
  objectType?: string;
  rights?: string[];
  encumbrances?: string[];
  extractDate?: string;
  buildingCadastralNumber?: string;
  recognized: string[];
}

function textOf(xml: string, tags: string[]): string | undefined {
  for (const t of tags) {
    const re = new RegExp(`<(?:[\\w-]+:)?${t}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${t}>`, "i");
    const m = xml.match(re);
    if (m) {
      const inner = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (inner) return decode(inner);
    }
  }
  return undefined;
}

function allTexts(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, "gi");
  return [...xml.matchAll(re)].map((m) => decode(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())).filter(Boolean);
}

function block(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, "i");
  return xml.match(re)?.[1];
}

function decode(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function parseEgrnXml(xml: string): EgrnExtract {
  const out: EgrnExtract = { recognized: [] };
  const objectBlock = block(xml, "room_record") ?? block(xml, "object") ?? xml;

  const cad = textOf(objectBlock, ["cad_number", "CadastralNumber", "cadastral_number"]) ??
    xml.match(/CadastralNumber="([^"]+)"/)?.[1];
  if (cad && /^\d{2}:\d{2}:\d{6,7}:\d+$/.test(cad)) {
    out.cadastralNumber = cad;
    out.recognized.push("cadastralNumber");
  }

  const area = textOf(block(objectBlock, "params") ?? objectBlock, ["area", "Area"]);
  if (area && /^\d+([.,]\d+)?$/.test(area)) {
    out.area = area.replace(",", ".");
    out.recognized.push("area");
  }

  const addr = textOf(xml, ["readable_address", "Note", "note_address"]);
  if (addr) {
    out.address = addr;
    out.recognized.push("address");
  }

  const floorTxt = textOf(xml, ["floor", "number_on_plan_floor"]) ?? textOf(block(xml, "location_in_build") ?? "", ["number"]);
  if (floorTxt && /^-?\d+$/.test(floorTxt)) {
    out.floor = Number(floorTxt);
    out.recognized.push("floor");
  }

  const purpose = textOf(block(xml, "purpose") ?? "", ["value"]) ?? textOf(xml, ["purpose"]);
  if (purpose) {
    out.purpose = purpose;
    out.recognized.push("purpose");
  }

  const type = textOf(block(xml, "type") ?? "", ["value"]);
  if (type) {
    out.objectType = type;
    out.recognized.push("objectType");
  }

  const rights = allTexts(xml, "right_type").map((r) => r.replace(/^\d+\s*/, "")).filter(Boolean);
  const rightsValues = (block(xml, "right_records") ?? "")
    .split(/<\/(?:[\w-]+:)?right_record>/i)
    .map((r) => textOf(block(r, "right_type") ?? "", ["value"]))
    .filter((x): x is string => !!x);
  const r = rightsValues.length ? rightsValues : rights;
  if (r.length) {
    out.rights = [...new Set(r)];
    out.recognized.push("rights");
  }

  const enc = (block(xml, "restrict_records") ?? "")
    .split(/<\/(?:[\w-]+:)?restrict_record>/i)
    .map((x) => textOf(block(x, "restriction_encumbrance_type") ?? "", ["value"]))
    .filter((x): x is string => !!x);
  if (enc.length) {
    out.encumbrances = [...new Set(enc)];
    out.recognized.push("encumbrances");
  }

  const date = textOf(xml, ["date_formation", "date_received_request"]);
  if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    out.extractDate = date.slice(0, 10);
    out.recognized.push("extractDate");
  }

  const parent = textOf(block(xml, "parent_cad_number") ?? block(xml, "cad_links") ?? "", ["cad_number"]);
  if (parent && /^\d{2}:\d{2}:\d{6,7}:\d+$/.test(parent) && parent !== out.cadastralNumber) {
    out.buildingCadastralNumber = parent;
    out.recognized.push("buildingCadastralNumber");
  }
  return out;
}
