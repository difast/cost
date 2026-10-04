import { api, ok } from "@/server/http";
import { requireUser } from "@/server/auth";
import { listSources } from "@/server/integrations/registry";

export const GET = api(async () => {
  await requireUser();
  return ok(listSources());
});
