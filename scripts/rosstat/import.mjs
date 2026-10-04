#!/usr/bin/env node
// Импорт показателя Росстата по маппингу (составляется после анализа структуры файла).
//
//   npm run rosstat:import -- --file data/rosstat/x.xlsx --mapping scripts/rosstat/mappings/x.json
//
// Маппинг (JSON):
// {
//   "series":  { "code": "…", "name": "…", "unit": "…", "category": "secondary_prices|price_index|incomes|housing_construction|other", "source": "Росстат, …" },
//   "sheet":   "имя листа" (для CSV — "csv"),
//   "layout":  "wide" — регионы в строках, периоды в столбцах; "long" — регион, период и значение в столбцах,
//   "firstDataRow": 5, "regionColumn": 1, "regionCodeColumn": null,
//   "headerRow": 4, "periodColumns": [2, 20]          // для wide: диапазон столбцов с периодами в строке headerRow
//   "periodColumn": 2, "valueColumn": 3,              // для long
//   "actualDate": "2026-09-30"                        // дата актуальности данных (из сведений Росстата)
// }
// Значения пишутся батчами (upsert по показателю, региону и периоду) — без дублей при повторном импорте.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { eachRow, formatOf, parseNumber, parsePeriod, sha256File } from "./common.mjs";

const BATCH = 2000;

function arg(k) {
  const a = process.argv.slice(2);
  const i = a.indexOf(`--${k}`);
  return i >= 0 ? a[i + 1] : undefined;
}

async function main() {
  const file = arg("file");
  const mappingFile = arg("mapping");
  if (!file || !mappingFile) {
    console.error("Использование: --file <файл> --mapping <маппинг.json>");
    process.exit(2);
  }
  const m = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
  if (!["wide", "long"].includes(m.layout)) throw new Error("layout: wide или long");
  const db = new PrismaClient();
  try {
    const sha = await sha256File(file);
    const stat = await fs.promises.stat(file);
    const rf = await db.rosstatFile.upsert({
      where: { sha256: sha },
      update: {},
      create: { fileName: path.basename(file), sha256: sha, format: formatOf(file), sizeBytes: BigInt(stat.size), structure: {} },
    });
    const series = await db.rosstatSeries.upsert({
      where: { code: m.series.code },
      update: { name: m.series.name, unit: m.series.unit ?? null, category: m.series.category, source: m.series.source },
      create: { code: m.series.code, name: m.series.name, unit: m.series.unit ?? null, category: m.series.category, source: m.series.source },
    });
    const actualDate = m.actualDate ? new Date(`${m.actualDate}T00:00:00Z`) : null;
    let periods = null; // wide: [{ col, period, start }]
    let batch = [];
    let total = 0, skipped = 0;
    const flush = async () => {
      if (!batch.length) return;
      const b = batch;
      batch = [];
      await db.$executeRawUnsafe(
        `INSERT INTO "RosstatValue" ("id","seriesId","regionCode","regionName","period","periodStart","value","fileId","actualDate")
         SELECT gen_random_uuid()::text, $1, r.code, r.name, r.period, r.start::timestamp, r.value::numeric, $2, $3::timestamp
         FROM unnest($4::text[], $5::text[], $6::text[], $7::text[], $8::text[]) AS r(code, name, period, start, value)
         ON CONFLICT ("seriesId","regionName","period") DO UPDATE SET "value" = EXCLUDED."value", "fileId" = EXCLUDED."fileId", "actualDate" = EXCLUDED."actualDate", "periodStart" = EXCLUDED."periodStart"`,
        series.id, rf.id, actualDate, b.map((x) => x.code), b.map((x) => x.name), b.map((x) => x.period), b.map((x) => x.start), b.map((x) => String(x.value)),
      );
      total += b.length;
    };
    await eachRow(file, async (sheet, n, cells) => {
      if (sheet !== m.sheet) return;
      if (m.layout === "wide" && n === m.headerRow) {
        const [from, to] = m.periodColumns;
        periods = [];
        for (let c = from; c <= to; c++) {
          const p = parsePeriod(cells[c - 1]);
          if (p) periods.push({ col: c, ...p });
        }
        if (!periods.length) throw new Error(`В строке ${n} не распознаны периоды — проверьте headerRow и periodColumns`);
      }
      if (n < m.firstDataRow) return;
      const name = (cells[m.regionColumn - 1] ?? "").trim();
      if (!name) return;
      const code = m.regionCodeColumn ? (cells[m.regionCodeColumn - 1] ?? "").trim() || null : null;
      if (m.layout === "wide") {
        for (const p of periods ?? []) {
          const v = parseNumber(cells[p.col - 1]);
          if (v === null) skipped++;
          else batch.push({ code, name, period: p.period, start: p.start, value: v });
        }
      } else {
        const p = parsePeriod(cells[m.periodColumn - 1]);
        const v = parseNumber(cells[m.valueColumn - 1]);
        if (!p || v === null) skipped++;
        else batch.push({ code, name, period: p.period, start: p.start, value: v });
      }
      if (batch.length >= BATCH) await flush();
    });
    await flush();
    await db.rosstatFile.update({ where: { id: rf.id }, data: { status: "imported", rows: total, importedAt: new Date() } });
    console.log(`«${series.name}»: записано значений ${total}, пропущено пустых/нечисловых ячеек ${skipped}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
