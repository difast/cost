import { api, ok, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { acceptInvitation, invitationInfo } from "@/server/services/team";

/** Сведения о приглашении по ссылке (доступно без входа). */
export const GET = api(async (_req, { params }: Params<"token">) => {
  const { token } = await params;
  const info = await invitationInfo(token);
  if (!info) throw new HttpError(404, "Приглашение не найдено");
  return ok(info);
});

/** Принять приглашение (нужно войти под адресом, на который оно отправлено). */
export const POST = api(async (_req, { params }: Params<"token">) => {
  const u = await requireUser();
  const { token } = await params;
  return ok(await prisma.$transaction((tx) => acceptInvitation(u.id, u.email, token, new Date(), tx)));
});
