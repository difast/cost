// Импорт аналогов из CSV, подготовленного пользователем (выгрузка от поставщика данных,
// собственная таблица и т. п.). Разделитель «;» или «,», первая строка — заголовки.

export interface CsvComparable {
  sourceName?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  offerDate?: string;
  address?: string;
  price?: string;
  area?: string;
  rooms?: number;
  floor?: number;
  floors?: number;
  wallMaterial?: string;
  yearBuilt?: number;
  finishing?: string;
  furniture?: boolean;
  houseCondition?: string;
  metroDistanceM?: number;
}

const HEADERS: Record<string, keyof CsvComparable> = {
  url: "sourceUrl", ссылка: "sourceUrl", source_url: "sourceUrl",
  source: "sourceName", источник: "sourceName",
  date: "retrievedAt", retrieved_at: "retrievedAt", "дата получения": "retrievedAt",
  offer_date: "offerDate", "дата предложения": "offerDate",
  address: "address", адрес: "address",
  price: "price", цена: "price",
  area: "area", площадь: "area",
  rooms: "rooms", комнат: "rooms", комнаты: "rooms",
  floor: "floor", этаж: "floor",
  floors: "floors", этажность: "floors",
  material: "wallMaterial", wall_material: "wallMaterial", материал: "wallMaterial",
  year: "yearBuilt", year_built: "yearBuilt", "год постройки": "yearBuilt",
  finishing: "finishing", отделка: "finishing",
  furniture: "furniture", мебель: "furniture",
  condition: "houseCondition", house_condition: "houseCondition", "состояние дома": "houseCondition",
  metro: "metroDistanceM", metro_distance: "metroDistanceM", "до метро": "metroDistanceM",
};

const MATERIALS: Record<string, string> = {
  панель: "panel", панельный: "panel", кирпич: "brick", кирпичный: "brick", монолит: "monolith", монолитный: "monolith",
  "монолитно-кирпичный": "monolith_brick", блочный: "block", блок: "block", деревянный: "wood",
};

export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toDate(v: string): string | undefined {
  const m1 = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return undefined;
}

const num = (v: string) => v.replace(/[\s ₽]/g, "").replace(",", ".");

export function parseComparablesCsv(text: string): { rows: CsvComparable[]; errors: string[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.replace(/[;,\s]/g, ""));
  if (lines.length < 2) return { rows: [], errors: ["Файл пуст или нет строк данных"] };
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitCsvLine(lines[0], sep).map((h) => HEADERS[h.toLowerCase()]);
  const rows: CsvComparable[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, idx) => {
    const cells = splitCsvLine(line, sep);
    const r: CsvComparable = {};
    header.forEach((key, i) => {
      const v = cells[i]?.trim();
      if (!key || !v) return;
      switch (key) {
        case "rooms": case "floor": case "floors": case "yearBuilt": case "metroDistanceM": {
          const n = Number(num(v));
          if (Number.isFinite(n)) r[key] = Math.round(n);
          break;
        }
        case "price": case "area": {
          const n = num(v);
          if (/^\d+(\.\d+)?$/.test(n)) r[key] = n;
          else errors.push(`Строка ${idx + 2}: некорректное значение «${v}»`);
          break;
        }
        case "retrievedAt": case "offerDate":
          r[key] = toDate(v);
          break;
        case "furniture":
          r.furniture = /^(да|yes|1|true|есть)$/i.test(v);
          break;
        case "wallMaterial":
          r.wallMaterial = MATERIALS[v.toLowerCase()] ?? v;
          break;
        default:
          (r as Record<string, unknown>)[key] = v;
      }
    });
    if (!r.price || !r.area) errors.push(`Строка ${idx + 2}: нет цены или площади — пропущена`);
    else rows.push(r);
  });
  return { rows, errors };
}
