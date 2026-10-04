import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { api, body, ok, HttpError, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { logEvent } from "@/server/audit";
import { getOwned, syncAdjustments, updateWithAudit } from "@/server/services/assessment";
import { geocode, reverseGeocode } from "@/server/integrations/yandex";
import { collectInfrastructure } from "@/server/services/infrastructure";
import { PRECISION, selectAddress } from "@/server/services/location";

const lat = z.coerce.number().min(-90, "Широта от −90 до 90").max(90, "Широта от −90 до 90");
const lon = z.coerce.number().min(-180, "Долгота от −180 до 180").max(180, "Долгота от −180 до 180");

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("geocode"), address: z.string().trim().min(3, "Укажите адрес").max(500) }),
  z.object({ action: z.literal("reverse"), lat, lon }),
  z.object({ action: z.literal("infrastructure") }),
  z.object({
    action: z.literal("select"),
    suggestion: z.object({
      id: z.string().max(200), source: z.enum(["gar", "yandex"]), fullAddress: z.string().trim().min(3).max(500),
      region: z.string().max(200).nullable(), municipality: z.string().max(200).nullable(), locality: z.string().max(200).nullable(), district: z.string().max(200).nullable(),
      street: z.string().max(200).nullable(), house: z.string().max(100).nullable(), guid: z.string().max(64).nullable(), objectId: z.string().max(32).nullable(),
      lat: lat.nullable(), lon: lon.nullable(), precision: z.string().max(20).nullable(),
    }),
  }),
]);


export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const data = await body(req, schema);

  if (data.action === "reverse") {
    const r = await reverseGeocode({ lat: data.lat, lon: data.lon });
    if (!r) throw new HttpError(404, "По этим координатам адрес не найден");
    return ok({ address: r.formatted, kind: r.kind });
  }

  if (data.action === "select") return ok(await selectAddress(id, u.id, data.suggestion));

  const before = await prisma.property.findUniqueOrThrow({ where: { assessmentId: id } });

  if (data.action === "geocode") {
    const r = await geocode(data.address);
    if (!r) throw new HttpError(404, "Геокодер не нашёл такой адрес. Уточните написание.");
    const at = new Date().toISOString();
    const mark = { source: "yandex", title: `Яндекс Геокодер: «${r.formatted}» (${PRECISION[r.precision] ?? r.precision})`, userId: u.id, at, components: r.components };
    const provenance = { ...((before.provenance ?? {}) as Record<string, unknown>), latitude: mark, longitude: mark } as Prisma.InputJsonValue;
    const after = await prisma.property.update({ where: { assessmentId: id }, data: { latitude: r.lat.toFixed(6), longitude: r.lon.toFixed(6), provenance } });
    await updateWithAudit({ assessmentId: id, userId: u.id, entity: "property", entityId: after.id, before: { latitude: before.latitude, longitude: before.longitude }, after: { latitude: after.latitude, longitude: after.longitude }, summary: "Определены координаты объекта (Яндекс Геокодер)" });
    await prisma.assessment.update({ where: { id }, data: { updatedAt: new Date() } });
    await syncAdjustments(id); // пересчёт расстояний до аналогов
    return ok({ lat: r.lat, lon: r.lon, formatted: r.formatted, precision: r.precision, precisionLabel: PRECISION[r.precision] ?? r.precision });
  }

  // infrastructure
  if (before.latitude === null || before.longitude === null) throw new HttpError(422, "Сначала определите и сохраните координаты объекта");
  const snapshot = await collectInfrastructure({ lat: Number(before.latitude), lon: Number(before.longitude) });
  await prisma.property.update({ where: { assessmentId: id }, data: { infrastructure: snapshot as unknown as Prisma.InputJsonValue } });
  const total = snapshot.categories.reduce((n, c) => n + c.items.length, 0);
  await logEvent({ assessmentId: id, userId: u.id, action: "update", entity: "property", entityId: before.id, summary: `Получена инфраструктура (Яндекс Карты): объектов — ${total}` });
  await prisma.assessment.update({ where: { id }, data: { updatedAt: new Date() } });
  return ok(snapshot);
});
