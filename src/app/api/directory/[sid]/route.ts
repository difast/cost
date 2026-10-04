import { z } from "zod";
import { prisma } from "@/server/db";
import { api, body, ok, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";

async function load(sid: string, userId: string) {
  const s = await prisma.adjustmentSource.findFirst({
    where: { id: sid, OR: [{ ownerId: null }, { ownerId: userId }] },
    include: { factors: { orderBy: [{ stage: "asc" }, { sortOrder: "asc" }], include: { categories: { orderBy: { sortOrder: "asc" } } } }, _count: { select: { assessments: true } } },
  });
  if (!s) throw new HttpError(404, "Справочник не найден");
  return s;
}

export const GET = api(async (_req, { params }: Params<"sid">) => {
  const u = await requireUser();
  const { sid } = await params;
  const s = await load(sid, u.id);
  return ok({ ...s, editable: s.ownerId === u.id });
});

const metaSchema = z.object({
  name: z.string().trim().min(1).max(300),
  publisher: z.string().max(300).nullable(),
  actualDate: z.string().nullable(),
  licenseType: z.enum(["own", "licensed", "public"]),
  licenseNote: z.string().max(2000).nullable(),
  url: z.string().max(1000).nullable(),
  isActive: z.boolean(),
}).partial();

export const PATCH = api(async (req, { params }: Params<"sid">) => {
  const u = await requireUser();
  const { sid } = await params;
  const s = await load(sid, u.id);
  if (s.ownerId !== u.id) throw new HttpError(403, "Системный справочник нельзя изменять — создайте собственную редакцию");
  const data = await body(req, metaSchema);
  const updated = await prisma.adjustmentSource.update({
    where: { id: sid },
    data: { ...data, actualDate: data.actualDate === undefined ? undefined : data.actualDate ? new Date(`${data.actualDate.slice(0, 10)}T00:00:00Z`) : null },
  });
  return ok(updated);
});
