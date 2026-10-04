import type { ComparablesProvider, PropertyLookupQuery, PropertyLookupResult, PropertyProvider, ProviderInfo } from "./types";

// Реестр адаптеров. Новый источник подключается добавлением адаптера сюда —
// без изменения ядра расчёта, проверок и отчёта.

const propertyProviders: PropertyProvider[] = [];
const comparablesProviders: ComparablesProvider[] = [];

/** Каталог известных источников и их статус. Адаптеры появятся после заключения договоров. */
export const PLANNED_SOURCES: ProviderInfo[] = [
  { code: "egrn_upload", name: "Выписка ЕГРН (загрузка файла XML)", access: "user_import", capabilities: ["property"], configured: true },
  { code: "manual", name: "Ручной ввод оценщиком", access: "manual", capabilities: ["property", "building", "comparables", "market", "infrastructure"], configured: true },
  { code: "csv_import", name: "Импорт аналогов из CSV", access: "user_import", capabilities: ["comparables"], configured: true },
  { code: "rosreestr", name: "Росреестр / НСПД", access: "official_api", capabilities: ["property", "building"], configured: false, note: "Требуется официальный канал доступа" },
  { code: "gis_zhkh", name: "ГИС ЖКХ", access: "official_api", capabilities: ["building"], configured: false, note: "Требуется официальный канал доступа" },
  { code: "fias_gar", name: "ФИАС / ГАР", access: "official_api", capabilities: ["address"], configured: false, note: "Выгрузки ГАР ФНС или лицензированный сервис нормализации адресов" },
  { code: "listings_partner", name: "Площадки объявлений (ЦИАН, Авито, Домклик)", access: "partner_api", capabilities: ["comparables", "market"], configured: false, note: "Только по партнёрскому договору или через лицензированного поставщика" },
  { code: "maps", name: "Картографический сервис (инфраструктура, расстояния)", access: "partner_api", capabilities: ["infrastructure"], configured: false, note: "Коммерческий API по договору" },
  { code: "rosstat_cbr", name: "Росстат, Банк России", access: "official_api", capabilities: ["market"], configured: false, note: "Открытые данные; адаптер в версии 2" },
];

export function registerPropertyProvider(p: PropertyProvider) {
  propertyProviders.push(p);
}
export function registerComparablesProvider(p: ComparablesProvider) {
  comparablesProviders.push(p);
}

export async function lookupProperty(q: PropertyLookupQuery): Promise<PropertyLookupResult[]> {
  const out: PropertyLookupResult[] = [];
  for (const p of propertyProviders.filter((x) => x.info.configured)) {
    try {
      const r = await p.lookup(q);
      if (r) out.push(r);
    } catch (e) {
      console.error(`Источник ${p.info.code} недоступен`, e);
    }
  }
  return out;
}

export function listSources(): ProviderInfo[] {
  const active = [...propertyProviders, ...comparablesProviders].map((p) => p.info);
  return [...PLANNED_SOURCES.filter((s) => !active.some((a) => a.code === s.code)), ...active];
}

export const comparableProviders = () => comparablesProviders.filter((p) => p.info.configured);
