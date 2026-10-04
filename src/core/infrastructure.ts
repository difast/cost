// Снимок ближайшей инфраструктуры объекта оценки. Хранится в Property.infrastructure,
// попадает в снимок расчёта и в отчёт. Расстояния — по прямой от координат объекта.

export interface InfraItem {
  name: string;
  type: string | null;
  address: string | null;
  lat: number;
  lon: number;
  distanceM: number;
}

export interface InfraCategory {
  key: string;
  label: string;
  /** ok — найдено; empty — в радиусе нет; error — сервис вернул ошибку. */
  status: "ok" | "empty" | "error";
  radiusM: number;
  error?: string;
  items: InfraItem[];
}

export interface InfrastructureSnapshot {
  provider: string;
  providerTitle: string;
  retrievedAt: string;
  center: { lat: number; lon: number };
  categories: InfraCategory[];
}

/** Категории поиска: запрос к поиску по организациям или станции метро из геокодера. */
export const INFRA_CATEGORIES: Array<{ key: string; label: string; query?: string; metro?: true; radiusM: number }> = [
  { key: "metro", label: "Метро", metro: true, radiusM: 5000 },
  { key: "transport", label: "Остановки общественного транспорта", query: "остановка общественного транспорта", radiusM: 1000 },
  { key: "school", label: "Школы", query: "школа", radiusM: 1500 },
  { key: "kindergarten", label: "Детские сады", query: "детский сад", radiusM: 1500 },
  { key: "polyclinic", label: "Поликлиники", query: "поликлиника", radiusM: 2000 },
  { key: "hospital", label: "Больницы", query: "больница", radiusM: 3000 },
  { key: "pharmacy", label: "Аптеки", query: "аптека", radiusM: 1000 },
  { key: "shop", label: "Магазины", query: "продуктовый магазин", radiusM: 1000 },
];

export const INFRA_ITEMS_PER_CATEGORY = 5;

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} м`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} км`;
}

/** Совпадают ли координаты снимка с текущими координатами объекта (точность ~1 м). */
export function sameCenter(s: InfrastructureSnapshot | null | undefined, lat: unknown, lon: unknown): boolean {
  if (!s) return false;
  const a = Number(lat), b = Number(lon);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(s.center.lat - a) < 1e-5 && Math.abs(s.center.lon - b) < 1e-5;
}
