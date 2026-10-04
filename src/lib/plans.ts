// Тарифы — рабочая гипотеза. Приём оплаты пока не подключён.
export interface Plan {
  code: "basic" | "pro" | "team" | "corporate";
  name: string;
  price: string;
  pricePrefix?: string;
  audience: string;
  items: Array<{ text: string; status?: "planned" | "on_request" }>;
  recommended?: boolean;
}

export const PLANS: Plan[] = [
  {
    code: "basic",
    name: "Базовый",
    price: "1 990",
    audience: "Для индивидуального оценщика",
    items: [
      { text: "Оценка квартиры сравнительным подходом" },
      { text: "Импорт XML-выписки ЕГРН" },
      { text: "Корректировки, расчёт и проверки" },
      { text: "Отчёт в DOCX и PDF" },
      { text: "Нормативная база" },
    ],
  },
  {
    code: "pro",
    name: "Профессиональный",
    price: "4 990",
    audience: "Для регулярной профессиональной работы",
    recommended: true,
    items: [
      { text: "Всё, что входит в «Базовый»" },
      { text: "Собственные редакции справочника корректировок" },
      { text: "Версии расчётов и история изменений" },
      { text: "Подключение коммерческих источников данных", status: "planned" },
    ],
  },
  {
    code: "team",
    name: "Команда",
    price: "9 990",
    audience: "Для небольшой оценочной компании",
    items: [
      { text: "Всё, что входит в «Профессиональный»" },
      { text: "Несколько пользователей", status: "planned" },
      { text: "Общие оценки и командная работа", status: "planned" },
    ],
  },
  {
    code: "corporate",
    name: "Корпоративный",
    price: "19 990",
    pricePrefix: "от",
    audience: "Для крупных оценочных компаний",
    items: [
      { text: "Индивидуальные условия" },
      { text: "Шаблоны отчётов компании", status: "on_request" },
      { text: "Подключение источников данных по договору", status: "on_request" },
    ],
  },
];
