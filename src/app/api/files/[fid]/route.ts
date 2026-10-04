import { prisma } from "@/server/db";
import { api, ok, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { readFileFor } from "@/server/services/files";
import { logEvent } from "@/server/audit";

/** Запасное ASCII-имя файла для клиентов, не поддерживающих filename*. */
function asciiName(name: string) {
  const map: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
  return name
    .split("")
    .map((ch) => {
      const lower = ch.toLowerCase();
      const t = map[lower];
      if (t === undefined) return /[\x20-\x7e]/.test(ch) && ch !== '"' ? ch : "_";
      return ch === lower ? t : t.charAt(0).toUpperCase() + t.slice(1);
    })
    .join("");
}

export const GET = api(async (req, { params }: Params<"fid">) => {
  const u = await requireUser();
  const { fid } = await params;
  const f = await readFileFor(u.id, fid);
  const inline = new URL(req.url).searchParams.get("inline") === "1" && f.mime.startsWith("image/");
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mime,
      "Content-Length": String(f.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName(f.filename)}"; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = api(async (_req, { params }: Params<"fid">) => {
  const u = await requireUser();
  const { fid } = await params;
  const f = await readFileFor(u.id, fid);
  if (f.kind === "report") throw new HttpError(400, "Сформированные отчёты не удаляются");
  // Файл, попавший в зафиксированную версию расчёта, удалять нельзя — иначе отчёт не воспроизвести.
  const used = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM "CalculationVersion" WHERE snapshot::text LIKE ${"%" + fid + "%"}`;
  if (Number(used[0]?.n ?? 0) > 0) throw new HttpError(409, "Файл использован в зафиксированной версии расчёта и не может быть удалён");
  await prisma.comparable.updateMany({ where: { screenshotFileId: fid }, data: { screenshotFileId: null } });
  await prisma.storedFile.delete({ where: { id: fid } });
  if (f.assessmentId) await logEvent({ assessmentId: f.assessmentId, userId: u.id, action: "delete", entity: "file", entityId: fid, summary: `Удалён файл ${f.filename}` });
  return ok({ deleted: true });
});
