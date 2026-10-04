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
  yearBuilt?: number | null;
  livingArea?: string | null;
  kitchenArea?: string | null;
  /** Дополнительные признаки для новых факторов справочника (атрибут «field:<имя>»). */
  extra?: Record<string, string | number | boolean | null | undefined>;
}

/** Переменные формул справочника: суффикс o — объект оценки, a — аналог. */
export const FORMULA_VARIABLES = ["So", "Sa", "Fo", "Fa", "Ho", "Ha", "Ro", "Ra", "Yo", "Ya", "Mo", "Ma", "Lo", "La", "Ko", "Ka"] as const;
export const FORMULA_VARIABLE_LABELS: Record<string, string> = {
  S: "общая площадь, м²", F: "этаж", H: "этажность дома", R: "количество комнат", Y: "год постройки", M: "расстояние до метро, м", L: "жилая площадь, м²", K: "площадь кухни, м²",
};

export function formulaVars(subject: ObjectFeatures, comparable: ObjectFeatures): Record<string, string | number | null> {
  const pick = (f: ObjectFeatures) => ({
    S: f.area ?? null, F: f.floor ?? null, H: f.floors ?? null, R: f.rooms ?? null, Y: f.yearBuilt ?? null,
    M: f.metroDistanceM ?? null, L: f.livingArea ?? null, K: f.kitchenArea ?? null,
  });
  const o = pick(subject), a = pick(comparable);
  const out: Record<string, string | number | null> = {};
  for (const k of Object.keys(o) as Array<keyof typeof o>) {
    out[`${k}o`] = o[k];
    out[`${k}a`] = a[k];
  }
  return out;
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
    default: {
      // Универсальный признак: значение поля как код категории — новые факторы без изменения кода.
      if (attribute.startsWith("field:")) {
        const v = f.extra?.[attribute.slice(6)];
        return v === null || v === undefined || v === "" ? null : String(v);
      }
      return null;
    }
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
    case "rooms":
      return f.rooms !== null && f.rooms !== undefined ? String(f.rooms) : "—";
    default: {
      if (attribute.startsWith("field:")) {
        const v = f.extra?.[attribute.slice(6)];
        return v === null || v === undefined || v === "" ? "—" : String(v);
      }
      return "—";
    }
  }
}
