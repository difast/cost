import { z } from "zod";
import { api, body, ok, type Params } from "@/server/http";
import { requireAccess } from "@/server/workspace";
import { changeRole, removeMember } from "@/server/services/team";

/** Изменить роль участника (только владелец). */
export const PATCH = api(async (req, { params }: Params<"mid">) => {
  const a = await requireAccess();
  const { mid } = await params;
  const { role } = await body(req, z.object({ role: z.enum(["admin", "member"]) }));
  await changeRole(a, mid, role);
  return ok({ ok: true });
});

/** Исключить участника (владелец, администратор) или выйти самому. Данные остаются в рабочем пространстве. */
export const DELETE = api(async (_req, { params }: Params<"mid">) => {
  const a = await requireAccess();
  const { mid } = await params;
  await removeMember(a, mid);
  return ok({ ok: true });
});
