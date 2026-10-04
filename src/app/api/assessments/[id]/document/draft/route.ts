import { api, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { draftExport } from "@/server/services/reportDocument";

export const maxDuration = 60;

/** Черновик отчёта (DOCX/PDF) по текущим данным — доступен всегда, в том числе при ошибках проверок. */
export const GET = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const format = new URL(req.url).searchParams.get("format");
  if (format !== "docx" && format !== "pdf") throw new HttpError(400, "Формат: docx или pdf");
  const f = await draftExport(id, u.id, format);
  return new Response(new Uint8Array(f.data), {
    headers: { "Content-Type": f.mime, "Content-Disposition": `attachment; filename="draft.${format}"; filename*=UTF-8''${encodeURIComponent(f.filename)}` },
  });
});
