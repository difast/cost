import { z } from "zod";
import { api, body, ok } from "@/server/http";
import { requireUser } from "@/server/auth";
import { switchWorkspace } from "@/server/services/team";

/** Переключить текущее рабочее пространство (если пользователь состоит в нескольких). */
export const POST = api(async (req) => {
  const u = await requireUser();
  const { workspaceId } = await body(req, z.object({ workspaceId: z.string().min(1).max(64) }));
  await switchWorkspace(u.id, workspaceId);
  return ok({ ok: true });
});
