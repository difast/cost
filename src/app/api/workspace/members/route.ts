import { api, ok } from "@/server/http";
import { requireAccess } from "@/server/workspace";
import { listMembers } from "@/server/services/team";

/** Участники и приглашения текущего рабочего пространства. */
export const GET = api(async () => ok(await listMembers(await requireAccess())));
