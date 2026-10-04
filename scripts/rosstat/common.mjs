// Общие функции для файлов Росстата: потоковое чтение CSV/XLSX построчно, разбор периодов.
// Файлы не загружаются в память целиком: CSV читается построчно, XLSX — потоковым ридером ExcelJS.

import fs from "node:fs";
import crypto from "node:crypto";
import readline from "node:readline";
import { Transform } from "node:stream";
import path from "node:path";
import ExcelJS from "exceljs";

export const formatOf = (file) => {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".csv" || ext === ".txt") return "csv";
  if (ext === ".xlsx" || ext === ".xlsm") return "xlsx";
  if (ext === ".xls") return "xls";
  return "unknown";
};

export async function sha256File(file) {
  const h = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}

/** Кодировка CSV: UTF-8, если первые 64 КБ декодируются без ошибок, иначе Windows-1251. */
async function detectEncoding(file) {
  const fd = await fs.promises.open(file, "r");
  try {
    const buf = Buffer.alloc(65536);
    const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, bytesRead).subarray(0, Math.max(0, bytesRead - 4)));
      return "utf-8";
    } catch {
      return "windows-1251";
    }
  } finally {
    await fd.close();
  }
}

function splitCsv(line, delim) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) out.push(cur), (cur = "");
    else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/**
 * Построчный обход файла: onRow(sheetName, rowNumber (с 1), cells: string[]).
 * onRow может вернуть false, чтобы прекратить чтение текущего листа.
 */
export async function eachRow(file, onRow) {
  const fmt = formatOf(file);
  if (fmt === "csv") {
    const enc = await detectEncoding(file);
    const input = fs.createReadStream(file).pipe(new TextDecoderStreamTransform(enc));
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    let n = 0, delim = null;
    for await (const line of rl) {
      n++;
      if (delim === null) delim = [";", "\t", ","].map((d) => [d, line.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
      if ((await onRow("csv", n, splitCsv(line, delim))) === false) break;
    }
    rl.close();
    return { encoding: enc };
  }
  if (fmt === "xlsx") {
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: "cache", hyperlinks: "ignore", styles: "ignore", worksheets: "emit" });
    for await (const ws of reader) {
      let stop = false;
      for await (const row of ws) {
        if (stop) continue; // дочитываем поток листа без обработки
        const cells = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          const v = cell.value;
          cells[col - 1] = v === null || v === undefined ? "" : typeof v === "object" ? String(v.result ?? v.text ?? v.richText?.map((t) => t.text).join("") ?? "") : String(v);
        });
        if ((await onRow(ws.name ?? `Лист ${ws.id}`, row.number, cells.map((x) => (x ?? "").trim()))) === false) stop = true;
      }
    }
    return {};
  }
  throw new Error(fmt === "xls" ? "Формат XLS (Excel 97–2003) не читается потоково — сохраните файл как XLSX или CSV" : `Неизвестный формат файла: ${path.basename(file)}`);
}

/** Поток декодирования CSV в нужной кодировке. */
class TextDecoderStreamTransform extends Transform {
  constructor(enc) {
    super();
    this.dec = new TextDecoder(enc);
  }
  _transform(chunk, _e, cb) {
    cb(null, this.dec.decode(chunk, { stream: true }));
  }
  _flush(cb) {
    cb(null, this.dec.decode());
  }
}

const MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };

/**
 * Период из подписи столбца/ячейки: «2025», «2025 г.», «I квартал 2025», «1 кв. 2025», «2025-Q1»,
 * «январь 2025», «2025-01». Возвращает { period, start } или null, если подпись не распознана.
 */
export function parsePeriod(raw) {
  const s = String(raw ?? "").trim().toLowerCase().replace(/ё/g, "е");
  if (!s) return null;
  let m;
  if ((m = /^(\d{4})\s*-?\s*q([1-4])$/.exec(s))) return q(+m[1], +m[2]);
  if ((m = /^(i{1,3}|iv|[1-4])\s*(?:-?й\s*)?(?:квартал|кв\.?)\s*(\d{4})/.exec(s))) return q(+m[2], ROMAN[m[1].toUpperCase()] ?? +m[1]);
  if ((m = /^(\d{4})-(\d{2})$/.exec(s))) return mo(+m[1], +m[2]);
  if ((m = /^([а-я]+)\s+(\d{4})/.exec(s))) {
    const i = MONTHS.findIndex((x) => m[1].startsWith(x) && (x !== "ма" || /^ма[йя]/.test(m[1])));
    if (i >= 0) return mo(+m[2], i + 1);
  }
  if ((m = /^(\d{4})(?:\s*г\.?|\s*год)?$/.exec(s))) return { period: m[1], start: `${m[1]}-01-01` };
  return null;
}
const q = (y, n) => ({ period: `${y}-Q${n}`, start: `${y}-${String((n - 1) * 3 + 1).padStart(2, "0")}-01` });
const mo = (y, n) => (n >= 1 && n <= 12 ? { period: `${y}-${String(n).padStart(2, "0")}`, start: `${y}-${String(n).padStart(2, "0")}-01` } : null);

/** Число из ячейки Росстата: «1 234,5» → 1234.5; «…», «-», «х» и пустые → null. */
export function parseNumber(raw) {
  const s = String(raw ?? "").replace(/[\s ]/g, "").replace(",", ".");
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
