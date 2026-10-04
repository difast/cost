// Архитектура интеграций с внешними источниками данных.
//
// Принцип: ядро не знает о конкретных поставщиках. Каждый источник — адаптер,
// реализующий один из интерфейсов ниже и зарегистрированный в реестре.
// Тип доступа фиксируется явно — только легальные каналы:
//   official_api   — официальный API ведомства/площадки (по договору/ключу);
//   partner_api    — партнёрский API площадки объявлений;
//   licensed_data  — лицензированный поставщик данных;
//   user_import    — файл, загруженный пользователем (выписка ЕГРН, CSV, скриншот);
//   manual         — ручной ввод.
// Парсинг сайтов без разрешения правообладателя не допускается.

export type AccessKind = "official_api" | "partner_api" | "licensed_data" | "user_import" | "manual";

export interface ProviderInfo {
  code: string;
  name: string;
  access: AccessKind;
  /** Что умеет давать адаптер. */
  capabilities: Array<"property" | "building" | "comparables" | "market" | "infrastructure" | "address">;
  /** Подключён ли адаптер (есть договор/ключ). */
  configured: boolean;
  note?: string;
  /** Для каких данных используется источник. */
  usedFor?: string[];
}

export interface PropertyLookupQuery {
  address?: string;
  cadastralNumber?: string;
}

export interface FieldValue<T> {
  value: T;
  sourceTitle: string;
  retrievedAt: string;
}

export interface PropertyLookupResult {
  provider: string;
  property: Partial<Record<"address" | "cadastralNumber" | "area" | "floor" | "rooms" | "purpose" | "rights", FieldValue<string | number>>>;
  building?: Partial<Record<"yearBuilt" | "floors" | "wallMaterial" | "cadastralNumber", FieldValue<string | number>>>;
}

export interface PropertyProvider {
  info: ProviderInfo;
  lookup(q: PropertyLookupQuery): Promise<PropertyLookupResult | null>;
}

export interface ComparableSearchCriteria {
  address: string;
  rooms?: number;
  areaFrom?: number;
  areaTo?: number;
  dateTo: string;
}

export interface ComparableCandidate {
  provider: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  offerDate?: string;
  address: string;
  price: string;
  area: string;
  rooms?: number;
  floor?: number;
  floors?: number;
  wallMaterial?: string;
  yearBuilt?: number;
  finishing?: string;
  furniture?: boolean;
  metroDistanceM?: number;
}

export interface ComparablesProvider {
  info: ProviderInfo;
  search(c: ComparableSearchCriteria): Promise<ComparableCandidate[]>;
}
