import { z } from "zod";
import { api, body, ok, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { createDocumentVersion } from "@/server/services/reportDocument";

export const maxDuration = 120;

/** «Создать версию» (final: false) или «Сформировать финальную версию» (final: true): DOCX, PDF, XLSX из одного снимка. */
export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const data = await body(req, z.object({ final: z.boolean().default(false), note: z.string().max(500).optional() }));
  return ok(await createDocumentVersion(id, u.id, data), 201);
});
