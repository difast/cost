#!/usr/bin/env node
// Анализ структуры файлов Росстата перед импортом.
//
//   npm run rosstat:analyze                      # все файлы в data/rosstat/
//   npm run rosstat:analyze -- data/rosstat/x.xlsx
//
// Файл читается потоково. Для каждого листа сохраняются: число строк и столбцов, первые 40 строк,
// распознанные периоды в строках-заголовках. Результат — в таблице RosstatFile и в
// data/rosstat/analysis/<файл>.json. По нему составляется маппинг импорта (scripts/rosstat/README.md).

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { eachRow, formatOf, parsePeriod, sha256File } from "./common.mjs";

const SAMPLE_ROWS = 40;
const DIR = "data/rosstat";

async function analyze(file) {
  const stat = await fs.promises.stat(file);
  const sheets = new Map();
  const meta = await eachRow(file, (sheet, n, cells) => {
    if (!sheets.has(sheet)) sheets.set(sheet, { name: sheet, rowCount: 0, columnCount: 0, sample: [], periodRows: [] });
    const s = sheets.get(sheet);
    s.rowCount = n;
    s.columnCount = Math.max(s.columnCount, cells.length);
    if (n <= SAMPLE_ROWS) {
      s.sample.push(cells.slice(0, 60));
      const periods = cells.map((c, i) => [i + 1, parsePeriod(c)]).filter(([, p]) => p);
      if (periods.length >= 2) s.periodRows.push({ row: n, columns: periods.map(([col, p]) => ({ col, period: p.period })) });
    }
  });
  return { fileName: path.basename(file), format: formatOf(file), sizeBytes: stat.size, sha256: await sha256File(file), ...meta, sheets: [...sheets.values()] };
}

async function main() {
  const given = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const files = given.length
    ? given
    : fs.existsSync(DIR)
      ? fs.readdirSync(DIR).filter((f) => !f.startsWith(".") && fs.statSync(path.join(DIR, f)).isFile()).map((f) => path.join(DIR, f))
      : [];
  if (!files.length) {
    console.log(`Файлов Росстата нет. Положите их в ${DIR}/ и запустите снова.`);
    return;
  }
  const db = new PrismaClient();
  fs.mkdirSync(path.join(DIR, "analysis"), { recursive: true });
  try {
    for (const f of files) {
      try {
        const r = await analyze(f);
        fs.writeFileSync(path.join(DIR, "analysis", `${r.fileName}.json`), JSON.stringify(r, null, 2));
        await db.rosstatFile.upsert({
          where: { sha256: r.sha256 },
          update: { fileName: r.fileName, structure: r, format: r.format, sizeBytes: BigInt(r.sizeBytes) },
          create: { fileName: r.fileName, sha256: r.sha256, format: r.format, sizeBytes: BigInt(r.sizeBytes), structure: r },
        });
        console.log(`${r.fileName}: ${r.format}, ${(r.sizeBytes / 1048576).toFixed(1)} МБ`);
        for (const s of r.sheets) console.log(`  «${s.name}»: строк ${s.rowCount}, столбцов ${s.columnCount}, строк с периодами в первых ${SAMPLE_ROWS}: ${s.periodRows.map((p) => p.row).join(", ") || "нет"}`);
      } catch (e) {
        console.error(`${path.basename(f)}: ${e.message}`);
      }
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
