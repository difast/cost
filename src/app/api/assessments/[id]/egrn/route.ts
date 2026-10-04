import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { api, ok, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned, syncAdjustments } from "@/server/services/assessment";
import { storeFile } from "@/server/services/files";
import { logEvent } from "@/server/audit";
import { parseEgrnXml } from "@/core/egrn/parse";

// Загрузка выписки ЕГРН пользователем. XML разбирается автоматически,
// PDF сохраняется как документ (данные вносятся вручную) — без внешних запросов.
export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Файл не передан");
  const buf = Buffer.from(await file.arrayBuffer());
  const isXml = /xml/i.test(file.type) || /\.xml$/i.test(file.name);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isXml && !isPdf) throw new HttpError(415, "Поддерживаются выписки ЕГРН в формате XML или PDF");

  const stored = await storeFile({ ownerId: u.id, assessmentId: id, kind: "egrn", filename: file.name, mime: isXml ? "application/xml" : "application/pdf", data: buf, caption: "Выписка из ЕГРН" });

  if (isPdf) {
    const src = await prisma.source.create({ data: { assessmentId: id, kind: "egrn_pdf", title: "Выписка ЕГРН (PDF)", fileId: stored.id, note: "Данные внесены оценщиком вручную" } });
    await logEvent({ assessmentId: id, userId: u.id, action: "import", entity: "source", entityId: src.id, summary: "Загружена выписка ЕГРН (PDF)" });
    return ok({ source: src, extracted: null, applied: [] });
  }

  const ex = parseEgrnXml(buf.toString("utf8"));
  if (ex.recognized.length === 0) throw new HttpError(422, "Не удалось распознать выписку ЕГРН. Проверьте файл или внесите данные вручную.");
  const src = await prisma.source.create({
    data: {
      assessmentId: id,
      kind: "egrn_xml",
      title: `Выписка ЕГРН${ex.extractDate ? ` от ${ex.extractDate.split("-").reverse().join(".")}` : ""}`,
      fileId: stored.id,
      retrievedAt: ex.extractDate ? new Date(`${ex.extractDate}T00:00:00Z`) : new Date(),
      extracted: ex as unknown as Prisma.InputJsonValue,
    },
  });

  // Заполняем только пустые поля; расхождения с уже введёнными данными покажут проверки.
  const p = await prisma.property.findUniqueOrThrow({ where: { assessmentId: id } });
  const b = await prisma.building.findUnique({ where: { assessmentId: id } });
  const patch: Prisma.PropertyUpdateInput = {};
  const applied: string[] = [];
  const prov = { ...((p.provenance ?? {}) as Record<string, unknown>) };
  const mark = (f: string) => {
    applied.push(f);
    prov[f] = { source: "egrn_xml", sourceId: src.id, title: src.title, at: new Date().toISOString() };
  };
  if (!p.cadastralNumber && ex.cadastralNumber) { patch.cadastralNumber = ex.cadastralNumber; mark("cadastralNumber"); }
  if (!p.area && ex.area) { patch.area = ex.area; mark("area"); }
  if (!p.address && ex.address) { patch.address = ex.address; mark("address"); }
  if (!p.floor && ex.floor) { patch.floor = ex.floor; mark("floor"); }
  if (ex.rights?.length) { patch.rights = ex.rights.join("; "); mark("rights"); }
  if (ex.encumbrances) { patch.encumbrances = ex.encumbrances.join("; "); mark("encumbrances"); }
  else if (ex.recognized.includes("rights") && !p.encumbrances) { patch.encumbrances = "Не зарегистрировано"; mark("encumbrances"); }
  if (ex.purpose && !p.purpose) { patch.purpose = ex.purpose; mark("purpose"); }
  await prisma.property.update({ where: { assessmentId: id }, data: { ...patch, provenance: prov as Prisma.InputJsonValue } });
  if (ex.buildingCadastralNumber && b && !b.cadastralNumber) {
    await prisma.building.update({ where: { assessmentId: id }, data: { cadastralNumber: ex.buildingCadastralNumber } });
    applied.push("building.cadastralNumber");
  }
  await logEvent({ assessmentId: id, userId: u.id, action: "import", entity: "source", entityId: src.id, summary: `Загружена выписка ЕГРН (XML); заполнено полей: ${applied.length}`, diff: { applied, recognized: ex.recognized } });
  await syncAdjustments(id);
  return ok({ source: src, extracted: ex, applied });
});
