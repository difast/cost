import { prisma } from "@/server/db";
import { api, ok, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { readFileFor } from "@/server/services/files";
import { logEvent } from "@/server/audit";

export const GET = api(async (req, { params }: Params<"fid">) => {
  const u = await requireUser();
  const { fid } = await params;
  const f = await readFileFor(u.id, fid);
  const inline = new URL(req.url).searchParams.get("inline") === "1" && f.mime.startsWith("image/");
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mime,
      "Content-Length": String(f.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
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
