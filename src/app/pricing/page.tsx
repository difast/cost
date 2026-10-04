import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { PricingCards } from "@/components/landing/PricingCards";
import { currentUser } from "@/server/auth";
import { CONTACT_EMAIL } from "@/core/billing";

export const metadata: Metadata = {
  title: "Тарифы",
  description: "Тарифы ЭВМО: Базовый, Профессиональный, Команда и Корпоративный. 7 дней бесплатно на выбранном тарифе.",
  alternates: { canonical: "/pricing" },
};

const yes = <span className="text-brand" aria-label="есть">✓</span>;
const no = <span className="text-zinc-300" aria-label="нет">—</span>;
const ROWS: Array<[string, React.ReactNode, React.ReactNode, React.ReactNode, React.ReactNode]> = [
  ["Пользователи", "1", "1", <b key="t">до 5</b>, "Без ограничений"],
  ["Оценки, объект и ЕГРН, аналоги", yes, yes, yes, yes],
  ["Корректировки, расчёт, контроль качества", yes, yes, yes, yes],
  ["Отчёты и экспорт DOCX, PDF, XLSX", yes, yes, yes, yes],
  ["Собственные редакции справочника корректировок", no, yes, yes, yes],
  ["Общее рабочее пространство и приглашения", no, no, yes, yes],
  ["Роли: владелец, администратор, участник", no, no, yes, yes],
  ["Условия подключения", "Онлайн", "Онлайн", "Онлайн", "Индивидуально"],
];

const FAQ: Array<[string, string]> = [
  ["Как работает пробный период?", "После регистрации у вас 7 дней доступа к выбранному тарифу. Дата окончания видна в личном кабинете в разделе «Тариф и команда»."],
  ["Что будет после окончания пробного периода?", "Данные не удаляются: оценки, документы и отчёты остаются доступными для просмотра. Создание и изменение оценок возобновится после выбора тарифа."],
  ["Как оплатить?", `Онлайн-оплата подключается. До её запуска напишите на ${CONTACT_EMAIL} — подскажем, как продолжить работу.`],
  ["Можно ли сменить тариф?", "Да, владелец рабочего пространства меняет тариф в разделе «Тариф и команда». Перейти на тариф с меньшим числом пользователей можно, если участников не больше лимита."],
];

export default async function Page() {
  const authed = !!(await currentUser().catch(() => null));
  return (
    <div className="bg-zinc-50 text-zinc-900">
      <Header authed={authed} />
      <main className="mx-auto max-w-7xl px-5 py-14 sm:py-20">
        <h1 className="text-[32px] font-bold tracking-tight sm:text-[42px]">Тарифы ЭВМО</h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-zinc-600">
          7 дней бесплатно на выбранном тарифе. После пробного периода все данные сохраняются. Корпоративный тариф подключается по согласованию — <a className="text-brand hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <div className="mt-10"><PricingCards /></div>

        <h2 className="mt-16 text-[22px] font-semibold tracking-tight">Сравнение тарифов</h2>
        <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[13px] text-zinc-500">
                <th className="px-4 py-3 font-medium">Возможность</th>
                {["Базовый", "Профессиональный", "Команда", "Корпоративный"].map((n) => <th key={n} className="px-4 py-3 text-center font-medium">{n}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, ...cells]) => (
                <tr key={k} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 text-zinc-700">{k}</td>
                  {cells.map((c, i) => <td key={i} className="px-4 py-3 text-center">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-16 text-[22px] font-semibold tracking-tight">Вопросы о тарифах</h2>
        <dl className="mt-5 grid gap-4 md:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <div key={q} className="rounded-lg border border-zinc-200 bg-white p-5">
              <dt className="font-semibold">{q}</dt>
              <dd className="mt-2 text-[14px] leading-relaxed text-zinc-600">{a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-[14px] text-zinc-600">
          {authed ? <Link href="/app/workspace" className="text-brand hover:underline">Тариф и команда в личном кабинете →</Link> : <Link href="/register" className="text-brand hover:underline">Создать аккаунт и начать пробный период →</Link>}
        </p>
      </main>
      <Footer />
    </div>
  );
}
