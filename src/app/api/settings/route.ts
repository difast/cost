import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { api, body, ok, HttpError } from "@/server/http";
import { requireUser } from "@/server/auth";
import { calcDefaultsFor, readUserSettings, userSettingsSchema } from "@/server/userSettings";

export const GET = api(async () => {
  const u = await requireUser();
  const s = readUserSettings(u.settings);
  return ok({
    settings: s,
    effective: { calc: calcDefaultsFor(s), defaultAdjustmentSourceId: s.defaultAdjustmentSourceId ?? null },
    account: { email: u.email, name: u.name, plan: u.plan, createdAt: u.createdAt },
  });
});

export const PUT = api(async (req) => {
  const u = await requireUser();
  const data = await body(req, userSettingsSchema);
  if (data.defaultAdjustmentSourceId) {
    const src = await prisma.adjustmentSource.findFirst({ where: { id: data.defaultAdjustmentSourceId, OR: [{ ownerId: null }, { ownerId: u.id }] } });
    if (!src) throw new HttpError(404, "Справочник не найден");
  }
  const current = readUserSettings(u.settings);
  const next = { ...current, ...data, calc: { ...(current.calc ?? {}), ...(data.calc ?? {}) } };
  await prisma.user.update({ where: { id: u.id }, data: { settings: next as Prisma.InputJsonValue } });
  return ok({ settings: next });
});
