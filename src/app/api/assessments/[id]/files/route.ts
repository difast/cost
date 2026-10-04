import { prisma } from "@/server/db";
import { api, ok, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { storeFile } from "@/server/services/files";
import { logEvent } from "@/server/audit";

const KINDS = new Set(["photo", "document", "screenshot"]);

/** Загрузка фото объекта, копий документов, скриншотов аналогов. */
export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const form = await req.formData();
  const kind = String(form.get("kind") ?? "photo");
  if (!KINDS.has(kind)) throw new HttpError(400, "Недопустимый тип вложения");
  const caption = form.get("caption") ? String(form.get("caption")) : null;
  const comparableId = form.get("comparableId") ? String(form.get("comparableId")) : null;
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) throw new HttpError(400, "Файл не передан");
  const out = [];
  for (const f of files) {
    const stored = await storeFile({ ownerId: u.id, assessmentId: id, kind, filename: f.name, mime: f.type, data: Buffer.from(await f.arrayBuffer()), caption });
    out.push(stored);
    if (comparableId && kind === "screenshot") {
      const c = await prisma.comparable.findFirst({ where: { id: comparableId, assessmentId: id } });
      if (!c) throw new HttpError(404, "Аналог не найден");
      await prisma.comparable.update({ where: { id: comparableId }, data: { screenshotFileId: stored.id } });
    }
  }
  await logEvent({ assessmentId: id, userId: u.id, action: "create", entity: "file", summary: `Загружено файлов: ${out.length} (${kind})`, diff: out.map((f) => ({ id: f.id, filename: f.filename, sha256: f.sha256 })) });
  return ok(out, 201);
});
