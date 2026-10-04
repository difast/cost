import { prisma } from "@/server/db";
import { api, body, ok } from "@/server/http";
import { requireUser } from "@/server/auth";
import { appraiserSchema } from "@/server/schemas";

export const GET = api(async () => {
  const u = await requireUser();
  const p = await prisma.appraiser.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, email: u.email } });
  return ok(p);
});

export const PUT = api(async (req) => {
  const u = await requireUser();
  const data = await body(req, appraiserSchema);
  const p = await prisma.appraiser.upsert({ where: { userId: u.id }, update: data, create: { userId: u.id, ...data } });
  return ok(p);
});
