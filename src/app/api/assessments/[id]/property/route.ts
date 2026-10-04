import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { api, body, ok, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { buildingSchema, propertySchema } from "@/server/schemas";
import { getOwned, syncAdjustments, updateWithAudit } from "@/server/services/assessment";
import { regeocodeAfterManualChange } from "@/server/services/location";

const schema = z.object({ property: propertySchema.optional(), building: buildingSchema.optional() });

/** Поля, введённые вручную, помечаются источником «Ручной ввод» с датой. */
function markManual(prov: unknown, fields: string[], userId: string) {
  const p = { ...((prov ?? {}) as Record<string, unknown>) };
  const at = new Date().toISOString();
  for (const f of fields) p[f] = { source: "manual", title: "Ввод оценщиком", userId, at };
  return p as Prisma.InputJsonValue;
}

export const PUT = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const data = await body(req, schema);
  let geocode: { updated: boolean; warning: string | null } | null = null;
  if (data.property) {
    const before = await prisma.property.findUniqueOrThrow({ where: { assessmentId: id } });
    const changed = Object.keys(data.property).filter((k) => String((before as Record<string, unknown>)[k] ?? "") !== String((data.property as Record<string, unknown>)[k] ?? ""));
    const after = await prisma.property.update({
      where: { assessmentId: id },
      data: { ...data.property, provenance: markManual(before.provenance, changed, u.id) },
    });
    await updateWithAudit({ assessmentId: id, userId: u.id, entity: "property", entityId: after.id, before: { ...before, provenance: undefined }, after: { ...after, provenance: undefined }, summary: "Изменены данные объекта" });
    // адрес изменён вручную, координаты не введены — определяем их заново, чтобы карта и расстояния соответствовали адресу
    if (changed.includes("address") && !changed.includes("latitude") && !changed.includes("longitude")) {
      geocode = await regeocodeAfterManualChange(id, u.id);
    }
  }
  if (data.building) {
    const before = await prisma.building.upsert({ where: { assessmentId: id }, update: {}, create: { assessmentId: id } });
    const changed = Object.keys(data.building).filter((k) => String((before as Record<string, unknown>)[k] ?? "") !== String((data.building as Record<string, unknown>)[k] ?? ""));
    const after = await prisma.building.update({
      where: { assessmentId: id },
      data: { ...data.building, provenance: markManual(before.provenance, changed, u.id) },
    });
    await updateWithAudit({ assessmentId: id, userId: u.id, entity: "building", entityId: after.id, before: { ...before, provenance: undefined }, after: { ...after, provenance: undefined }, summary: "Изменены данные здания" });
  }
  await prisma.assessment.update({ where: { id }, data: { updatedAt: new Date() } });
  await syncAdjustments(id);
  return ok({ ok: true, geocode });
});
