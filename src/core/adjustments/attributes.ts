// Извлечение категорий признаков из характеристик объекта/аналога.
// Здесь только семантика признаков. Числовые коэффициенты — в справочнике (БД).

export interface ObjectFeatures {
  area?: string | null;
  floor?: number | null;
  floors?: number | null;
  wallMaterial?: string | null;
  finishing?: string | null;
  furniture?: boolean | null;
  houseCondition?: string | null;
  metroDistanceM?: number | null;
  rights?: string | null;
  rooms?: number | null;
}

export const WALL_MATERIALS: Record<string, string> = {
  panel: "Панельный",
  brick: "Кирпичный",
  monolith: "Монолитный",
  monolith_brick: "Монолитно-кирпичный",
  block: "Блочный",
  wood: "Деревянный",
  other: "Иной",
};

export const FINISHING: Record<string, string> = {
  none: "Без отделки",
  whitebox: "Предчистовая (white box)",
  needs_repair: "Требует ремонта",
  standard: "Стандартный ремонт",
  improved: "Улучшенный ремонт",
  designer: "Дизайнерский ремонт",
};

export const HOUSE_CONDITION: Record<string, string> = {
  good: "Хорошее",
  satisfactory: "Удовлетворительное",
  poor: "Неудовлетворительное",
};

export const FLOOR_CATEGORY: Record<string, string> = {
  first: "Первый этаж",
  middle: "Средний этаж",
  last: "Последний этаж",
};

export function floorCategory(floor?: number | null, floors?: number | null): string | null {
  if (!floor || floor < 1) return null;
  if (floor === 1) return "first";
  if (floors && floor >= floors) return "last";
  if (!floors) return null;
  return "middle";
}

export interface MetroBucket {
  code: string;
  /** Верхняя граница включительно, м; null — без ограничения. */
  maxM: number | null;
}

export function metroCategory(distance: number | null | undefined, buckets: MetroBucket[]): string | null {
  if (distance === null || distance === undefined || distance < 0) return null;
  for (const b of buckets) {
    if (b.maxM === null || distance <= b.maxM) return b.code;
  }
  return null;
}

/** Категория признака для фактора справочника. null — нет данных. */
export function categoryOf(
  attribute: string,
  f: ObjectFeatures,
  params: Record<string, unknown>,
): string | null {
  switch (attribute) {
    case "floor_category":
      return floorCategory(f.floor, f.floors);
    case "wall_material":
      return f.wallMaterial || null;
    case "finishing":
      return f.finishing || null;
    case "furniture":
      return f.furniture === true ? "yes" : f.furniture === false ? "no" : null;
    case "house_condition":
      return f.houseCondition || null;
    case "metro_distance":
      return metroCategory(f.metroDistanceM, (params.buckets as MetroBucket[]) ?? []);
    case "rights":
      return f.rights ? (/собствен/i.test(f.rights) ? "ownership" : "other") : null;
    default:
      return null;
  }
}

export function describeCategory(attribute: string, f: ObjectFeatures): string {
  switch (attribute) {
    case "floor_category":
      return f.floor ? `${f.floor}/${f.floors ?? "?"}` : "—";
    case "wall_material":
      return f.wallMaterial ? WALL_MATERIALS[f.wallMaterial] ?? f.wallMaterial : "—";
    case "finishing":
      return f.finishing ? FINISHING[f.finishing] ?? f.finishing : "—";
    case "furniture":
      return f.furniture === true ? "С мебелью" : f.furniture === false ? "Без мебели" : "—";
    case "house_condition":
      return f.houseCondition ? HOUSE_CONDITION[f.houseCondition] ?? f.houseCondition : "—";
    case "metro_distance":
      return f.metroDistanceM !== null && f.metroDistanceM !== undefined ? `${f.metroDistanceM} м` : "—";
    case "area":
      return f.area ? `${f.area} м²` : "—";
    case "rights":
      return f.rights ?? "—";
    default:
      return "—";
  }
}
