export interface GeoPoint { lat: number; lon: number }

/** Расстояние по прямой (формула гаверсинусов), м. */
export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_008.8;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Координаты из значений БД/формы; null — если не заданы или некорректны. */
export function toPoint(lat: unknown, lon: unknown): GeoPoint | null {
  if (lat === null || lat === undefined || lat === "" || lon === null || lon === undefined || lon === "") return null;
  const a = Number(lat), b = Number(lon);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lon: b } : null;
}
