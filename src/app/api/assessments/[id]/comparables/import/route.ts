import { prisma } from "@/server/db";
import { api, ok, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned, syncAdjustments } from "@/server/services/assessment";
import { logEvent } from "@/server/audit";
import { parseComparablesCsv } from "@/core/import/csv";

// Импорт аналогов из CSV-файла пользователя (выгрузка поставщика данных, своя таблица).
export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Файл не передан");
  const text = Buffer.from(await file.arrayBuffer()).toString("utf8");
  const { rows, errors } = parseComparablesCsv(text);
  if (!rows.length) throw new HttpError(422, "Не найдено ни одной строки с ценой и площадью", errors);
  const max = await prisma.comparable.aggregate({ where: { assessmentId: id }, _max: { position: true } });
  let pos = max._max.position ?? 0;
  const now = new Date();
  for (const r of rows) {
    await prisma.comparable.create({
      data: {
        assessmentId: id,
        position: ++pos,
        sourceKind: "user_import",
        sourceName: r.sourceName ?? `Импорт: ${file.name}`,
        sourceUrl: r.sourceUrl,
        retrievedAt: r.retrievedAt ? new Date(`${r.retrievedAt}T00:00:00Z`) : now,
        offerDate: r.offerDate ? new Date(`${r.offerDate}T00:00:00Z`) : null,
        address: r.address,
        price: r.price!,
        area: r.area!,
        rooms: r.rooms, floor: r.floor, floors: r.floors, wallMaterial: r.wallMaterial, yearBuilt: r.yearBuilt,
        finishing: r.finishing, furniture: r.furniture, houseCondition: r.houseCondition, metroDistanceM: r.metroDistanceM,
      },
    });
  }
  await logEvent({ assessmentId: id, userId: u.id, action: "import", entity: "comparable", summary: `Импортировано аналогов из CSV: ${rows.length}`, diff: { file: file.name, errors } });
  await syncAdjustments(id);
  return ok({ imported: rows.length, errors });
});
