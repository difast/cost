import { prisma } from "@/server/db";
import { api, ok, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";

export const GET = api(async (_req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const events = await prisma.assessmentEvent.findMany({
    where: { assessmentId: id },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: { select: { email: true, name: true } } },
  });
  return ok(events);
});
