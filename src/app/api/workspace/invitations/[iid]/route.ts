import { api, ok, type Params } from "@/server/http";
import { requireAccess } from "@/server/workspace";
import { revokeInvitation } from "@/server/services/team";

/** Отозвать приглашение. */
export const DELETE = api(async (_req, { params }: Params<"iid">) => {
  const a = await requireAccess();
  const { iid } = await params;
  await revokeInvitation(a, iid);
  return ok({ ok: true });
});
