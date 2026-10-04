import { api, ok } from "@/server/http";
import { requireUser } from "@/server/auth";

export const GET = api(async () => {
  const u = await requireUser();
  return ok({ id: u.id, email: u.email, name: u.name, role: u.role, plan: u.plan });
});
