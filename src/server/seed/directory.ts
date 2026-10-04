// Демонстрационная редакция справочника корректировок.
// ВНИМАНИЕ: значения взяты из анализа образца отчёта и типовых диапазонов практики
// и НЕ являются данными лицензированного источника. В интерфейсе и в проверках
// справочник помечается как демонстрационный. Для работы оценщик создаёт свою
// редакцию (копию) или подключает лицензированный справочник.

export interface SeedFactor {
  code: string;
  name: string;
  kind: "discount" | "category" | "power" | "manual";
  attribute?: string;
  stage: number;
  sortOrder: number;
  value?: string;
  minValue?: string;
  maxValue?: string;
  params?: Record<string, unknown>;
  description?: string;
  groupName?: string;
  categories?: Array<{ code: string; label: string; coefficient: string; min?: string; max?: string }>;
}

export const DEMO_DIRECTORY = {
  code: "demo-apartments",
  name: "Демонстрационный справочник корректировок (квартиры)",
  publisher: "Встроенные демонстрационные данные",
  edition: "2026.1",
  actualDate: new Date("2026-01-01T00:00:00Z"),
  licenseType: "demo",
  licenseNote: "Демонстрационные значения. Не являются данными лицензированного справочника; перед использованием в отчёте требуют проверки и обоснования оценщиком.",
  isDemo: true,
};

export const DEMO_FACTORS: SeedFactor[] = [
  {
    code: "bargain", groupName: "Условия сделки и рынка", name: "Скидка на торг", kind: "discount", stage: 1, sortOrder: 10,
    value: "-0.05", minValue: "-0.08", maxValue: "-0.02",
    description: "Переход от цены предложения к цене сделки.",
  },
  {
    code: "rights", groupName: "Условия сделки и рынка", name: "Передаваемые права", kind: "category", attribute: "rights", stage: 1, sortOrder: 20,
    categories: [
      { code: "ownership", label: "Собственность", coefficient: "1" },
      { code: "other", label: "Иное право", coefficient: "1" },
    ],
    description: "При одинаковом объёме прав корректировка не требуется.",
  },
  {
    code: "market_conditions", groupName: "Условия сделки и рынка", name: "Условия рынка (дата предложения)", kind: "manual", stage: 1, sortOrder: 30,
    minValue: "-0.1", maxValue: "0.1",
    description: "Изменение цен между датой предложения и датой оценки.",
  },
  {
    code: "location", groupName: "Местоположение", name: "Местоположение", kind: "manual", stage: 2, sortOrder: 40,
    minValue: "-0.2", maxValue: "0.2",
    description: "Определяется оценщиком при различии в местоположении.",
  },
  {
    code: "area", groupName: "Физические характеристики", name: "Общая площадь", kind: "power", attribute: "area", stage: 2, sortOrder: 50,
    params: { exponent: "-0.1" }, minValue: "-0.15", maxValue: "0.15",
    description: "Коэффициент торможения: (S объекта / S аналога)^b − 1.",
  },
  {
    code: "floor", groupName: "Физические характеристики", name: "Этаж расположения", kind: "category", attribute: "floor_category", stage: 2, sortOrder: 60,
    categories: [
      { code: "first", label: "Первый этаж", coefficient: "0.94", min: "0.92", max: "0.96" },
      { code: "middle", label: "Средний этаж", coefficient: "1", min: "1", max: "1" },
      { code: "last", label: "Последний этаж", coefficient: "0.97", min: "0.95", max: "0.99" },
    ],
  },
  {
    code: "wall_material", groupName: "Физические характеристики", name: "Материал стен", kind: "category", attribute: "wall_material", stage: 2, sortOrder: 70,
    categories: [
      { code: "monolith", label: "Монолитный", coefficient: "1.05" },
      { code: "monolith_brick", label: "Монолитно-кирпичный", coefficient: "1.05" },
      { code: "brick", label: "Кирпичный", coefficient: "1.05" },
      { code: "block", label: "Блочный", coefficient: "1" },
      { code: "panel", label: "Панельный", coefficient: "1" },
      { code: "wood", label: "Деревянный", coefficient: "0.85" },
      { code: "other", label: "Иной", coefficient: "1" },
    ],
  },
  {
    code: "house_condition", groupName: "Физические характеристики", name: "Техническое состояние дома", kind: "category", attribute: "house_condition", stage: 2, sortOrder: 80,
    categories: [
      { code: "good", label: "Хорошее", coefficient: "1" },
      { code: "satisfactory", label: "Удовлетворительное", coefficient: "0.95" },
      { code: "poor", label: "Неудовлетворительное", coefficient: "0.85" },
    ],
  },
  {
    code: "finishing", groupName: "Физические характеристики", name: "Состояние отделки", kind: "category", attribute: "finishing", stage: 2, sortOrder: 90,
    categories: [
      { code: "none", label: "Без отделки", coefficient: "0.85" },
      { code: "whitebox", label: "Предчистовая", coefficient: "0.9" },
      { code: "needs_repair", label: "Требует ремонта", coefficient: "0.9" },
      { code: "standard", label: "Стандартный ремонт", coefficient: "1" },
      { code: "improved", label: "Улучшенный ремонт", coefficient: "1.07" },
      { code: "designer", label: "Дизайнерский ремонт", coefficient: "1.12" },
    ],
  },
  {
    code: "furniture", groupName: "Физические характеристики", name: "Наличие мебели", kind: "category", attribute: "furniture", stage: 2, sortOrder: 100,
    categories: [
      { code: "no", label: "Без мебели", coefficient: "0.96" },
      { code: "yes", label: "С мебелью", coefficient: "1" },
    ],
  },
  {
    code: "transport", groupName: "Местоположение", name: "Транспортная доступность (метро)", kind: "category", attribute: "metro_distance", stage: 2, sortOrder: 110,
    params: {
      buckets: [
        { code: "m500", maxM: 500 },
        { code: "m1000", maxM: 1000 },
        { code: "m2000", maxM: 2000 },
        { code: "far", maxM: null },
      ],
    },
    categories: [
      { code: "m500", label: "До 500 м", coefficient: "1" },
      { code: "m1000", label: "500–1000 м", coefficient: "0.97" },
      { code: "m2000", label: "1–2 км", coefficient: "0.94" },
      { code: "far", label: "Более 2 км", coefficient: "0.9" },
    ],
  },
];

/** Методика демонстрационных значений — показывается в интерфейсе и снимке корректировки. */
export const DEMO_METHODOLOGY = "Демонстрационное значение: получено из анализа образца отчёта и типовых диапазонов практики, не является данными лицензированного источника. Перед использованием в отчёте требует проверки и обоснования оценщиком.";
