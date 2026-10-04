import type { ComparablesProvider, PropertyLookupQuery, PropertyLookupResult, PropertyProvider, ProviderInfo } from "./types";

// Реестр адаптеров. Новый источник подключается добавлением адаптера сюда —
// без изменения ядра расчёта, проверок и отчёта.

const propertyProviders: PropertyProvider[] = [];
const comparablesProviders: ComparablesProvider[] = [];

/** Каталог известных источников и их статус. Адаптеры появятся после заключения договоров. */
export const PLANNED_SOURCES: ProviderInfo[] = [
  { code: "egrn_upload", name: "Выписка ЕГРН (загрузка файла XML)", access: "user_import", capabilities: ["property"], configured: true, usedFor: ["кадастровый номер", "площадь", "адрес", "этаж", "назначение", "права и обременения", "кадастровый номер здания"], note: "Файл выписки загружает оценщик; данные сверяются с карточкой объекта" },
  { code: "manual", name: "Ручной ввод оценщиком", access: "manual", capabilities: ["property", "building", "comparables", "market", "infrastructure"], configured: true, usedFor: ["характеристики объекта и здания", "аналоги со ссылкой и скриншотом", "местоположение и расстояния", "анализ рынка"], note: "Каждое поле помечается источником и датой ввода" },
  { code: "csv_import", name: "Импорт аналогов из CSV", access: "user_import", capabilities: ["comparables"], configured: true, usedFor: ["список аналогов: ссылка, дата, адрес, цена, площадь, характеристики"], note: "Таблица, подготовленная оценщиком или полученная от поставщика данных" },
  { code: "rosreestr", name: "Росреестр / НСПД", access: "official_api", capabilities: ["property", "building"], configured: false, note: "Требуется официальный канал доступа", usedFor: ["сведения ЕГРН без ручной загрузки выписки", "характеристики здания"] },
  { code: "gis_zhkh", name: "ГИС ЖКХ", access: "official_api", capabilities: ["building"], configured: false, note: "Требуется официальный канал доступа", usedFor: ["год постройки", "этажность", "материал стен", "капитальный ремонт"] },
  { code: "fias_gar", name: "ФИАС / ГАР", access: "official_api", capabilities: ["address"], configured: false, note: "Выгрузки ГАР ФНС или лицензированный сервис нормализации адресов", usedFor: ["нормализация адреса", "код ФИАС"] },
  { code: "listings_partner", name: "Площадки объявлений (ЦИАН, Авито, Домклик)", access: "partner_api", capabilities: ["comparables", "market"], configured: false, note: "Только по партнёрскому договору или через лицензированного поставщика", usedFor: ["автоматический подбор аналогов", "рыночная статистика"] },
  { code: "maps", name: "Картографический сервис (инфраструктура, расстояния)", access: "partner_api", capabilities: ["infrastructure"], configured: false, note: "Коммерческий API по договору", usedFor: ["расстояния до метро, остановок, школ", "инфраструктура района"] },
  { code: "rosstat_cbr", name: "Росстат, Банк России", access: "official_api", capabilities: ["market"], configured: false, note: "Открытые данные; адаптер в версии 2", usedFor: ["макроэкономические показатели", "индексы цен на жильё"] },
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
