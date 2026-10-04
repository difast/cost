// Адрес и координаты объекта: выбор подсказки, геокодирование при изменении адреса.
// Сохраняется не только строка адреса, но и разобранный адрес (регион, нас. пункт, улица, дом, ГАР) и координаты.

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../http";
import { geocode, yandexConfigured, type GeocodeResult } from "../integrations/yandex";
import { syncAdjustments, updateWithAudit } from "./assessment";
import { detailsFromYandex, type AddressDetails, type AddressSuggestion } from "@/core/address";

export const PRECISION: Record<string, string> = { exact: "точное совпадение", number: "дом найден, корпус не совпал", near: "ближайший дом", range: "по диапазону номеров", street: "только улица", other: "неточное совпадение" };

const geoMark = (r: { formatted: string; precision: string; components?: unknown }, userId: string, at: string) => ({
  source: "yandex", title: `Яндекс Геокодер: «${r.formatted}» (${PRECISION[r.precision] ?? r.precision})`, userId, at, components: r.components,
});

/** Геокодирование без падения: ошибка API возвращается текстом (адрес при этом сохраняется). */
export async function tryGeocode(address: string): Promise<{ result: GeocodeResult | null; warning: string | null }> {
  if (!yandexConfigured()) return { result: null, warning: "Координаты не определены: не задан ключ YANDEX_API_KEY. Введите координаты вручную." };
  try {
    const result = await geocode(address);
    return { result, warning: result ? null : "Геокодер не нашёл такой адрес — уточните написание или введите координаты вручную." };
  } catch (e) {
    return { result: null, warning: `Координаты не определены: ${e instanceof HttpError ? e.message : "ошибка геокодера"}` };
  }
}

/** Выбор подсказки адреса: адрес, ГАР-идентификаторы, разобранный адрес и координаты. */
export async function selectAddress(assessmentId: string, userId: string, s: AddressSuggestion) {
  const before = await prisma.property.findUniqueOrThrow({ where: { assessmentId } });
  const at = new Date().toISOString();
  let lat = s.lat, lon = s.lon, precision = s.precision, warning: string | null = null;
  let geo: GeocodeResult | null = null;
  if (lat === null || lon === null) {
    const g = await tryGeocode(s.fullAddress);
    geo = g.result;
    warning = g.warning;
    if (geo) ({ lat, lon, precision } = geo);
  }
  const fromGeo = geo ? detailsFromYandex(geo.formatted, geo.components, at) : null;
  const details: AddressDetails = {
    source: s.source, normalized: s.fullAddress,
    region: s.region ?? fromGeo?.region ?? null, municipality: s.municipality ?? fromGeo?.municipality ?? null,
    locality: s.locality ?? fromGeo?.locality ?? null, district: s.district ?? fromGeo?.district ?? null,
    street: s.street ?? fromGeo?.street ?? null, house: s.house ?? fromGeo?.house ?? null,
    garGuid: s.guid, garObjectId: s.objectId, at,
  };
  const prov = { ...((before.provenance ?? {}) as Record<string, unknown>) };
  prov.address = { source: s.source === "gar" ? "gar" : "yandex", title: s.source === "gar" ? "Государственный адресный реестр (ГАР)" : "Яндекс Геокодер", userId, at };
  if (lat !== null && lon !== null) {
    const mark = geoMark({ formatted: geo?.formatted ?? s.fullAddress, precision: precision ?? "other", components: geo?.components }, userId, at);
    prov.latitude = mark;
    prov.longitude = mark;
  }
  const after = await prisma.property.update({
    where: { assessmentId },
    data: {
      address: s.fullAddress, fiasId: s.guid, addressDetails: details as unknown as Prisma.InputJsonValue,
      ...(lat !== null && lon !== null ? { latitude: lat.toFixed(6), longitude: lon.toFixed(6) } : {}),
      ...(!before.district && details.district ? { district: details.district } : {}),
      provenance: prov as Prisma.InputJsonValue,
    },
  });
  await updateWithAudit({
    assessmentId, userId, entity: "property", entityId: after.id,
    before: { address: before.address, fiasId: before.fiasId, latitude: before.latitude, longitude: before.longitude },
    after: { address: after.address, fiasId: after.fiasId, latitude: after.latitude, longitude: after.longitude },
    summary: `Выбран адрес (${s.source === "gar" ? "ГАР" : "Яндекс Геокодер"})${lat !== null ? " и определены координаты" : ""}`,
  });
  await prisma.assessment.update({ where: { id: assessmentId }, data: { updatedAt: new Date() } });
  await syncAdjustments(assessmentId);
  return { address: after.address, lat, lon, precisionLabel: precision ? PRECISION[precision] ?? precision : null, details, warning };
}

/**
 * Адрес изменён вручную (без выбора подсказки): разобранный адрес сбрасывается,
 * координаты определяются геокодером заново. Ошибка геокодера не мешает сохранению.
 */
export async function regeocodeAfterManualChange(assessmentId: string, userId: string): Promise<{ updated: boolean; warning: string | null }> {
  const p = await prisma.property.findUniqueOrThrow({ where: { assessmentId } });
  if (!p.address?.trim()) {
    await prisma.property.update({ where: { assessmentId }, data: { addressDetails: Prisma.DbNull } });
    return { updated: false, warning: null };
  }
  const { result, warning } = await tryGeocode(p.address);
  if (!result) {
    await prisma.property.update({ where: { assessmentId }, data: { addressDetails: Prisma.DbNull } });
    return { updated: false, warning: warning ? `Адрес сохранён. ${warning}` : null };
  }
  const at = new Date().toISOString();
  const mark = geoMark(result, userId, at);
  const prov = { ...((p.provenance ?? {}) as Record<string, unknown>), latitude: mark, longitude: mark };
  await prisma.property.update({
    where: { assessmentId },
    data: { latitude: result.lat.toFixed(6), longitude: result.lon.toFixed(6), addressDetails: detailsFromYandex(result.formatted, result.components, at) as unknown as Prisma.InputJsonValue, provenance: prov as Prisma.InputJsonValue },
  });
  await updateWithAudit({ assessmentId, userId, entity: "property", entityId: p.id, before: { latitude: p.latitude, longitude: p.longitude }, after: { latitude: result.lat.toFixed(6), longitude: result.lon.toFixed(6) }, summary: "Адрес изменён — координаты определены заново (Яндекс Геокодер)" });
  return { updated: true, warning: null };
}
