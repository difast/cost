import { z } from "zod";
import { api, body, ok } from "@/server/http";
import { requireAccess } from "@/server/workspace";
import { changePlan } from "@/server/services/team";

/** Смена тарифа (только владелец). Корпоративный тариф подключается по согласованию. */
export const POST = api(async (req) => {
  const a = await requireAccess();
  const { plan } = await body(req, z.object({ plan: z.enum(["basic", "pro", "team", "corporate"]) }));
  return ok(await changePlan(a, plan));
});
