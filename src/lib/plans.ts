// Карточки тарифов для лендинга и страницы /pricing. Цены и лимиты — из единого источника core/billing.
// Перечислены только возможности, которые уже есть в продукте; запланированное помечено «в разработке».
import { CONTACT_EMAIL, PLANS as DEFS, type PlanCode } from "@/core/billing";

export interface Plan {
  code: PlanCode;
  name: string;
  price: string;
  pricePrefix?: string;
  audience: string;
  users: string;
  /** Чем отличается от соседнего (младшего) тарифа. */
  diff: string;
  items: Array<{ text: string; status?: "planned" }>;
  recommended?: boolean;
  cta: { label: string; href: string };
}

const price = (c: PlanCode) => DEFS[c].priceRub.toLocaleString("ru-RU").replace(/ /g, " ");
const trial = (c: PlanCode) => ({ label: "Попробовать 7 дней бесплатно", href: `/register?plan=${c}` });

export const PLANS: Plan[] = [
  {
    code: "basic", name: DEFS.basic.name, price: price("basic"), audience: "Для индивидуального оценщика", users: "1 пользователь",
    diff: "Весь основной функционал ЭВМО",
    items: [
      { text: "Создание и ведение оценок" },
      { text: "Объект и выписка ЕГРН" },
      { text: "Аналоги и сравнение с объектом" },
      { text: "Корректировки по справочнику" },
      { text: "Расчёт стоимости" },
      { text: "Контроль качества" },
      { text: "Отчёты и экспорт DOCX, PDF, XLSX" },
      { text: "Версии расчётов и история изменений" },
    ],
    cta: trial("basic"),
  },
  {
    code: "pro", name: DEFS.pro.name, price: price("pro"), audience: "Для регулярной профессиональной работы", users: "1 пользователь", recommended: true,
    diff: "Отличие от «Базового»: собственные редакции справочника корректировок",
    items: [
      { text: "Всё, что входит в «Базовый»" },
      { text: "Собственные редакции справочника корректировок" },
      { text: "Подключение коммерческих источников данных", status: "planned" },
    ],
    cta: trial("pro"),
  },
  {
    code: "team", name: DEFS.team.name, price: price("team"), audience: "Для небольшой оценочной компании", users: "до 5 пользователей",
    diff: "Отличие от «Профессионального»: работа командой до 5 человек",
    items: [
      { text: "Всё, что входит в «Профессиональный»" },
      { text: "Общее рабочее пространство и общие оценки" },
      { text: "Приглашение сотрудников по email" },
      { text: "Отдельная учётная запись у каждого участника" },
      { text: "Роли: владелец, администратор, участник" },
    ],
    cta: trial("team"),
  },
  {
    code: "corporate", name: DEFS.corporate.name, price: price("corporate"), pricePrefix: "от", audience: "Для крупных оценочных компаний", users: "Без ограничений",
    diff: "Отличие от «Команды»: неограниченное число пользователей",
    items: [
      { text: "Всё, что входит в «Команду»" },
      { text: "Неограниченное количество пользователей" },
      { text: "Подключение и условия согласовываются индивидуально" },
    ],
    cta: { label: "Связаться", href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Корпоративный тариф ЭВМО")}` },
  },
];
