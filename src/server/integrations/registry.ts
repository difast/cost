import { yandexConfigured } from "./yandex";
import { metrapiConfigured } from "./metrapi";
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
  { code: "fias_gar", name: "ГАР (ФИАС) — государственный адресный реестр ФНС", access: "user_import", capabilities: ["address"], configured: false, note: "Архив ФНС загружается потоковым импортом: npm run gar:import", usedFor: ["подсказки и нормализация адреса", "код ФИАС (GUID дома)"] },
  { code: "metrapi", name: "Metrapi — объявления о продаже (Авито, ЦИАН, ДомКлик, Яндекс Недвижимость и др.)", access: "licensed_data", capabilities: ["comparables", "market"], configured: false, note: "Ключ API задаётся в переменной окружения METRAPI_API_KEY", usedFor: ["поиск аналогов по параметрам объекта", "цены, характеристики, координаты и даты объявлений"] },
  { code: "maps", name: "Яндекс Карты: HTTP Геокодер и API Поиска по организациям", access: "official_api", capabilities: ["address", "infrastructure"], configured: false, note: "Ключ API задаётся в переменной окружения YANDEX_API_KEY", usedFor: ["координаты по адресу и адрес по координатам", "ближайшие школы, детские сады, медицина, аптеки, магазины, транспорт и метро", "расстояния до них (по прямой)"] },
  { code: "rosstat_cbr", name: "Росстат", access: "user_import", capabilities: ["market"], configured: false, note: "Файлы Росстата импортируются после анализа структуры: npm run rosstat:analyze / rosstat:import", usedFor: ["цены и индексы цен на вторичном рынке", "доходы населения", "ввод жилья"] },
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
  const planned = PLANNED_SOURCES.map((s) => (s.code === "maps" ? { ...s, configured: yandexConfigured() } : s.code === "metrapi" ? { ...s, configured: metrapiConfigured() } : s));
  return [...planned.filter((s) => !active.some((a) => a.code === s.code)), ...active];
}

export const comparableProviders = () => comparablesProviders.filter((p) => p.info.configured);
