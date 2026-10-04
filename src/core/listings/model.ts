// Внутренняя модель объявления-кандидата в аналоги.
// Интерфейс и расчёт работают только с ней — не с форматом конкретного поставщика.
// Значение null означает «источник не передал» (в интерфейсе — «Нет данных»), а не «нет».

export interface ListingSourceRef {
  source: string;
  price: number | null;
  url: string | null;
}

export interface Listing {
  /** Код поставщика данных (metrapi). */
  provider: string;
  /** Уникальный ключ объявления у поставщика: `${source}:${sourceId}`. */
  externalId: string;
  /** Площадка-первоисточник (avito, cian…) и её id объявления. */
  source: string;
  sourceId: string;
  url: string | null;
  title: string | null;
  description: string | null;

  address: string | null;
  region: string | null;
  locality: string | null;
  district: string | null;
  lat: number | null;
  lon: number | null;

  /** Цена за объект целиком, ₽. */
  price: number | null;
  /** Цена за м², ₽ (рассчитывается: цена / общая площадь). */
  unitPrice: number | null;
  area: number | null;
  livingArea: number | null;
  kitchenArea: number | null;
  rooms: number | null;
  floor: number | null;
  floors: number | null;
  buildYear: number | null;

  /** Тип дома как у источника и нормализованный код материала стен. */
  houseTypeRaw: string | null;
  wallMaterial: string | null;
  /** Ремонт как у источника и нормализованный код отделки. */
  renovationRaw: string | null;
  finishing: string | null;
  /** Мебель: true — указана в удобствах; null — сведений нет. */
  furniture: boolean | null;
  buildStatus: string | null;

  metroName: string | null;
  metroMinutes: number | null;
  /** walk — пешком, transport — транспортом. */
  metroMode: string | null;

  publishedAt: string | null;
  updatedAt: string | null;
  photos: string[];
  sellerType: string | null;
  saleType: string | null;
  /** Все площадки объекта (при склейке дублей). */
  sources: ListingSourceRef[];
  groupId: string | null;
}

/** Объявление с исходными данными поставщика (хранится на сервере, в браузер не уходит целиком). */
export interface ListingWithRaw extends Listing {
  raw: Record<string, unknown>;
}

/** Параметры поиска аналогов (независимо от поставщика). */
export interface ListingQuery {
  region?: string | null;
  locality?: string | null;
  district?: string | null;
  /** Поиск по адресу/тексту. */
  q?: string | null;
  /** Улица объекта (уровень 1 каскада; передаётся поставщику как текстовый поиск). */
  street?: string | null;
  /** Центр и радиус — фильтрация по расстоянию выполняется на нашей стороне по координатам объявления. */
  center?: { lat: number; lon: number } | null;
  radiusM?: number | null;
  rooms?: number[];
  areaMin?: number | null;
  areaMax?: number | null;
  floorMin?: number | null;
  floorMax?: number | null;
  floorsMin?: number | null;
  floorsMax?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  unitPriceMin?: number | null;
  unitPriceMax?: number | null;
  /** Дата размещения, YYYY-MM-DD. */
  dateFrom?: string | null;
  dateTo?: string | null;
  buildYearMin?: number | null;
  buildYearMax?: number | null;
  /** Коды материала стен (panel, brick…). */
  wallMaterials?: string[];
  /** Коды отделки (none, needs_repair…). */
  finishings?: string[];
  /** Мебель: yes — только с мебелью в удобствах, no — исключить с мебелью, any — не важно. */
  furniture?: "yes" | "no" | "any";
  sources?: string[];
  /** Исключить новостройки. */
  secondaryOnly?: boolean;
  /** Склейка дублей одного объекта с разных площадок. */
  dedupe?: boolean;
  /** Сколько объявлений запросить у поставщика (до фильтрации по расстоянию). */
  limit?: number;
}
