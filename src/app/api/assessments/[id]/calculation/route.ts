import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { api, body, ok, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { settingsSchema } from "@/server/schemas";
import { commitVersion, evaluate, getOwned, getSettings } from "@/server/services/assessment";
import { logEvent } from "@/server/audit";

/** Текущий расчёт и проверки «на лету» по актуальным данным. */
export const GET = api(async (_req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const { checks, hash, latestVersion, snapshot } = await evaluate(id);
  return ok({
    result: checks.result,
    issues: checks.issues,
    errors: checks.errors,
    warnings: checks.warnings,
    canGenerate: checks.canGenerate,
    settings: snapshot.settings,
    inputHash: hash,
    latestVersion,
    isStale: !latestVersion || latestVersion.inputHash !== hash,
    labels: Object.fromEntries(snapshot.comparables.map((c) => [c.id, c.label])),
  });
});

/** Настройки расчёта (метод весов, режим корректировок, округление). */
export const PUT = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const patch = await body(req, settingsSchema);
  const before = await getSettings(id);
  const after = { ...before, ...patch };
  await prisma.calculation.update({ where: { assessmentId: id }, data: { settings: after as unknown as Prisma.InputJsonValue } });
  await logEvent({ assessmentId: id, userId: u.id, action: "update", entity: "calculation", summary: "Изменены настройки расчёта", diff: { before, after } });
  return ok(after);
});

/** Зафиксировать версию расчёта. */
export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const { note } = await body(req, z.object({ note: z.string().max(500).optional() }));
  const { version, created } = await commitVersion(id, u.id, note);
  return ok({ id: version.id, versionNumber: version.versionNumber, created });
});
