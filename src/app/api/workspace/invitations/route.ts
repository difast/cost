import { z } from "zod";
import { api, body, ok } from "@/server/http";
import { requireAccess } from "@/server/workspace";
import { inviteMember } from "@/server/services/team";

/** Пригласить участника по email (владелец, администратор). Лимит тарифа проверяется на сервере. */
export const POST = api(async (req) => {
  const a = await requireAccess();
  const { email, role } = await body(req, z.object({ email: z.string().trim().email("Некорректный email").max(200), role: z.enum(["admin", "member"]).default("member") }));
  return ok(await inviteMember(a, email, role), 201);
});
