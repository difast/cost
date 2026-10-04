import { prisma } from "../db";
import { HttpError } from "../http";
import { sha256 } from "../stable";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png", "image/jpeg", "application/pdf", "application/xml", "text/xml", "text/csv", "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Хранение файлов в БД (MVP). Интерфейс позволяет позднее перейти на S3-совместимое хранилище.
export async function storeFile(opts: {
  ownerId: string;
  assessmentId?: string | null;
  kind: string;
  filename: string;
  mime: string;
  data: Buffer;
  caption?: string | null;
}) {
  if (opts.data.length > MAX_FILE_BYTES) throw new HttpError(413, "Файл больше 10 МБ");
  const mime = opts.mime || "application/octet-stream";
  if (opts.kind !== "report" && !ALLOWED.has(mime)) throw new HttpError(415, `Тип файла не поддерживается: ${mime}`);
  return prisma.storedFile.create({
    data: {
      ownerId: opts.ownerId,
      assessmentId: opts.assessmentId ?? null,
      kind: opts.kind,
      filename: opts.filename.slice(0, 250),
      mime,
      size: opts.data.length,
      sha256: sha256(opts.data),
      data: new Uint8Array(opts.data),
      caption: opts.caption ?? null,
    },
    select: { id: true, kind: true, filename: true, mime: true, size: true, caption: true, sha256: true, createdAt: true },
  });
}

/** Файл доступен автору и участникам рабочего пространства оценки, к которой он прикреплён. */
export async function readFileFor(userId: string, id: string) {
  const f = await prisma.storedFile.findFirst({ where: { id, OR: [{ ownerId: userId }, { assessment: { workspace: { members: { some: { userId } } } } }] } });
  if (!f) throw new HttpError(404, "Файл не найден");
  return f;
}
