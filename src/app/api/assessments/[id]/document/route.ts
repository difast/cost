import { z } from "zod";
import { api, body, ok, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { documentSchema, documentView, saveDocument } from "@/server/services/reportDocument";
import type { DocumentContent } from "@/core/document/model";

export const maxDuration = 60;

/** Документ отчёта: структура, автоматически заполненные блоки, статус, версии; ?preview=1 — модель для предпросмотра. */
export const GET = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  return ok(await documentView(id, u.id, new URL(req.url).searchParams.get("preview") === "1"));
});

/** Автосохранение черновика (без создания версии). */
export const PUT = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const data = await body(req, z.object({ content: documentSchema, baseUpdatedAt: z.string().nullish() }));
  return ok(await saveDocument(id, u.id, data.content as unknown as DocumentContent, data.baseUpdatedAt ?? null));
});
