#!/usr/bin/env node
// Потоковый импорт ГАР (ФИАС) из ZIP-архива ФНС в PostgreSQL.
//
//   npm run gar:import -- --file /data/gar_2026-10-02.zip --regions 77,50
//   npm run gar:import -- --file /data/gar_2026-10-02.zip --regions all
//
// Архив (~52 ГБ) не распаковывается и не загружается в память: записи ZIP читаются по одной
// потоком (ZIP64), XML разбирается SAX-парсером порциями, записи пишутся в БД батчами.
// В БД сохраняются только нужные приложению поля (см. prisma/schema.prisma: Gar*).
// Импорт идемпотентен (upsert) и выполняется по регионам: каждый регион — отдельный этап.
//
// Этапы для региона: AS_ADDR_OBJ → AS_HOUSES → AS_MUN_HIERARCHY → сборка GarAddress (SQL в БД).

import yauzl from "yauzl";
import { PrismaClient } from "@prisma/client";
import { createGarParser, garFileKind, garRegionOf, houseLabel } from "./parse.mjs";

const BATCH = 5000;

function args() {
  const a = process.argv.slice(2);
  const get = (k) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const file = get("file");
  const regions = get("regions") ?? "all";
  if (!file) {
    console.error("Укажите архив: --file /путь/gar_YYYY-MM-DD.zip [--regions 77,50|all]");
    process.exit(2);
  }
  return { file, regions: regions === "all" ? null : new Set(regions.split(",").map((x) => Number(x.trim()))) };
}

const openZip = (file) =>
  new Promise((resolve, reject) => yauzl.open(file, { lazyEntries: true, autoClose: false, validateEntrySizes: true }, (e, z) => (e ? reject(e) : resolve(z))));

/** Перечень записей архива (читается только центральный каталог ZIP). */
async function listEntries(zip) {
  const out = [];
  await new Promise((resolve, reject) => {
    zip.on("entry", (e) => {
      if (!/\/$/.test(e.fileName)) out.push(e);
      zip.readEntry();
    });
    zip.on("end", resolve);
    zip.on("error", reject);
    zip.readEntry();
  });
  return out;
}

const openStream = (zip, entry) => new Promise((resolve, reject) => zip.openReadStream(entry, (e, s) => (e ? reject(e) : resolve(s))));

/** Потоковое чтение одной записи: текст порциями → SAX → батчи в onBatch. */
async function streamEntry(zip, entry, kind, regionCode, onBatch) {
  let batch = [];
  let total = 0;
  const parser = createGarParser(kind, regionCode, (r) => batch.push(r));
  const decoder = new TextDecoder("utf-8");
  const stream = await openStream(zip, entry);
  for await (const chunk of stream) {
    parser.write(decoder.decode(chunk, { stream: true }));
    if (batch.length >= BATCH) {
      const b = batch;
      batch = [];
      await onBatch(b);
      total += b.length;
    }
  }
  parser.write(decoder.decode());
  parser.close();
  if (batch.length) {
    await onBatch(batch);
    total += batch.length;
  }
  return total;
}

// ───── запись в БД (массивы → unnest, upsert)

async function upsertAddr(db, rows) {
  await db.$executeRawUnsafe(
    `INSERT INTO "GarAddrObj" ("objectId","guid","name","typeName","level","regionCode")
     SELECT * FROM unnest($1::text[]::bigint[], $2::text[], $3::text[], $4::text[], $5::int[], $6::int[])
     ON CONFLICT ("objectId") DO UPDATE SET "guid"=EXCLUDED."guid","name"=EXCLUDED."name","typeName"=EXCLUDED."typeName","level"=EXCLUDED."level","regionCode"=EXCLUDED."regionCode"`,
    rows.map((r) => r.objectId), rows.map((r) => r.guid), rows.map((r) => r.name), rows.map((r) => r.typeName), rows.map((r) => r.level), rows.map((r) => r.regionCode),
  );
}

async function upsertHouses(db, rows, houseTypes, addTypes) {
  await db.$executeRawUnsafe(
    `INSERT INTO "GarHouse" ("objectId","guid","houseNum","addNum1","addNum2","houseType","addType1","addType2","label","regionCode")
     SELECT * FROM unnest($1::text[]::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[], $8::int[], $9::text[], $10::int[])
     ON CONFLICT ("objectId") DO UPDATE SET "guid"=EXCLUDED."guid","houseNum"=EXCLUDED."houseNum","addNum1"=EXCLUDED."addNum1","addNum2"=EXCLUDED."addNum2",
       "houseType"=EXCLUDED."houseType","addType1"=EXCLUDED."addType1","addType2"=EXCLUDED."addType2","label"=EXCLUDED."label","regionCode"=EXCLUDED."regionCode"`,
    rows.map((r) => r.objectId), rows.map((r) => r.guid), rows.map((r) => r.houseNum), rows.map((r) => r.addNum1), rows.map((r) => r.addNum2),
    rows.map((r) => r.houseType), rows.map((r) => r.addType1), rows.map((r) => r.addType2), rows.map((r) => houseLabel(r, houseTypes, addTypes)), rows.map((r) => r.regionCode),
  );
}

async function upsertHier(db, rows) {
  await db.$executeRawUnsafe(
    `INSERT INTO "GarHierarchy" ("objectId","parentObjId","path","oktmo","regionCode")
     SELECT * FROM unnest($1::text[]::bigint[], $2::text[]::bigint[], $3::text[], $4::text[], $5::int[])
     ON CONFLICT ("objectId") DO UPDATE SET "parentObjId"=EXCLUDED."parentObjId","path"=EXCLUDED."path","oktmo"=EXCLUDED."oktmo","regionCode"=EXCLUDED."regionCode"`,
    rows.map((r) => r.objectId), rows.map((r) => r.parentObjId), rows.map((r) => r.path), rows.map((r) => r.oktmo), rows.map((r) => r.regionCode),
  );
}

/**
 * Плоские адреса домов региона: путь муниципальной иерархии → элементы по уровням ГАР
 * (1 — субъект; 2–3 — районы/округа; 4–6 — поселения, города, населённые пункты; 7–8 — улицы).
 * Выполняется целиком в PostgreSQL, без выгрузки данных в Node.
 */
async function buildAddresses(db, regionCode) {
  await db.$executeRawUnsafe(`DELETE FROM "GarAddress" WHERE "regionCode" = $1`, regionCode);
  return db.$executeRawUnsafe(
    `WITH h AS (
       SELECT gh."objectId" AS house_id, string_to_array(gh."path", '.')::bigint[] AS ids
       FROM "GarHierarchy" gh JOIN "GarHouse" hs ON hs."objectId" = gh."objectId"
       WHERE gh."regionCode" = $1
     ), parts AS (
       SELECT h.house_id, o."level", trim(o."typeName" || ' ' || o."name") AS part, array_position(h.ids, o."objectId") AS pos
       FROM h JOIN "GarAddrObj" o ON o."objectId" = ANY (h.ids)
     ), agg AS (
       SELECT house_id,
         max(part) FILTER (WHERE "level" = 1) AS region,
         string_agg(part, ', ' ORDER BY pos) FILTER (WHERE "level" IN (2, 3)) AS municipality,
         string_agg(part, ', ' ORDER BY pos) FILTER (WHERE "level" IN (4, 5, 6)) AS locality,
         string_agg(part, ', ' ORDER BY pos) FILTER (WHERE "level" IN (7, 8)) AS street,
         string_agg(part, ', ' ORDER BY pos) AS chain
       FROM parts GROUP BY house_id
     )
     INSERT INTO "GarAddress" ("objectId","guid","regionCode","region","municipality","locality","street","house","fullAddress","normalized")
     SELECT hs."objectId", hs."guid", hs."regionCode", a.region, a.municipality, a.locality, a.street, hs."label",
            concat_ws(', ', a.chain, hs."label"),
            trim(regexp_replace(translate(lower(concat_ws(' ', a.chain, hs."label")), 'ё', 'е'), '[^0-9a-zа-я/]+', ' ', 'g'))
     FROM agg a JOIN "GarHouse" hs ON hs."objectId" = a.house_id
     ON CONFLICT ("objectId") DO NOTHING`,
    regionCode,
  );
}

async function logStage(db, archive, region, stage, fn) {
  const run = await db.garImport.create({ data: { archive, region: region === null ? null : String(region), stage } });
  const started = Date.now();
  try {
    const rows = await fn();
    await db.garImport.update({ where: { id: run.id }, data: { status: "done", rows: Number(rows) || 0, finishedAt: new Date() } });
    const mem = Math.round(process.memoryUsage().rss / 1048576);
    console.log(`  ${stage}: ${rows} строк, ${((Date.now() - started) / 1000).toFixed(1)} с, память ${mem} МБ`);
  } catch (e) {
    await db.garImport.update({ where: { id: run.id }, data: { status: "failed", error: String(e?.message ?? e).slice(0, 2000), finishedAt: new Date() } });
    throw e;
  }
}

async function main() {
  const { file, regions } = args();
  const db = new PrismaClient();
  const zip = await openZip(file);
  try {
    const entries = await listEntries(zip);
    console.log(`Архив: ${file}, записей: ${entries.length}`);
    // справочники типов домов (корень архива, небольшие)
    const houseTypes = new Map();
    const addTypes = new Map();
    for (const e of entries) {
      const kind = garFileKind(e.fileName);
      if (kind !== "houseTypes" && kind !== "addHouseTypes") continue;
      await streamEntry(zip, e, kind, null, async (b) => {
        for (const t of b) if (t.id !== null) (kind === "houseTypes" ? houseTypes : addTypes).set(t.id, t);
      });
    }
    console.log(`Типы домов: ${houseTypes.size}, дополнительные: ${addTypes.size}`);

    const byRegion = new Map();
    for (const e of entries) {
      const kind = garFileKind(e.fileName);
      const region = garRegionOf(e.fileName);
      if (!kind || region === null || kind === "houseTypes" || kind === "addHouseTypes") continue;
      if (regions && !regions.has(region)) continue;
      if (!byRegion.has(region)) byRegion.set(region, {});
      byRegion.get(region)[kind] = e;
    }
    for (const [region, files] of [...byRegion.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`Регион ${region}`);
      if (files.addr) await logStage(db, file, region, "addr_obj", () => streamEntry(zip, files.addr, "addr", region, (b) => upsertAddr(db, b)));
      if (files.house) await logStage(db, file, region, "houses", () => streamEntry(zip, files.house, "house", region, (b) => upsertHouses(db, b, houseTypes, addTypes)));
      if (files.hier) await logStage(db, file, region, "mun_hierarchy", () => streamEntry(zip, files.hier, "hier", region, (b) => upsertHier(db, b)));
      await logStage(db, file, region, "addresses", () => buildAddresses(db, region));
    }
    console.log("Готово");
  } finally {
    zip.close();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
