import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

const STEPS = [
  ["Адрес или кадастровый номер", "Создаёте оценку, загружаете выписку ЕГРН — карточка объекта заполняется автоматически."],
  ["Аналоги с источниками", "Каждый аналог хранит ссылку, дату получения и скриншот объявления."],
  ["Корректировки по справочнику", "Система предлагает корректировки из версионного справочника, вы проверяете и обосновываете изменения."],
  ["Прозрачный расчёт", "Цена → корректировка 1 → корректировка 2 → … → итог. Каждая цифра проверяется на калькуляторе."],
  ["Контроль ошибок", "Разные даты, чужие кадастровые номера, несходящиеся веса и итоги — до формирования отчёта."],
  ["Отчёт DOCX и PDF", "Одна кнопка — готовый отчёт с таблицами, обоснованиями, источниками и приложениями."],
];

export default async function Home() {
  if (await currentUser()) redirect("/app");
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex items-center justify-between">
        <div className="text-base font-semibold"><span className="text-brand">Оценка</span>.Про</div>
        <div className="flex gap-2">
          <Link href="/login" className="btn btn-ghost">Войти</Link>
          <Link href="/register" className="btn btn-primary">Начать работу</Link>
        </div>
      </header>
      <section className="py-16">
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">Цифровое рабочее место оценщика недвижимости</h1>
        <p className="mt-4 max-w-2xl text-base text-muted">
          От адреса до готового отчёта: данные объекта, аналоги, корректировки, расчёт и проверка согласованности — в одном месте. Без ручного Excel и копирования между сайтами.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/register" className="btn btn-primary px-5 py-2.5 text-base">Создать аккаунт</Link>
          <Link href="/login" className="btn btn-secondary px-5 py-2.5 text-base">У меня есть аккаунт</Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map(([t, d], i) => (
          <div key={t} className="card p-5">
            <div className="text-xs font-semibold text-brand">Шаг {i + 1}</div>
            <div className="mt-1 font-semibold">{t}</div>
            <p className="mt-2 text-muted">{d}</p>
          </div>
        ))}
      </section>
      <footer className="mt-16 border-t border-line pt-6 text-xs text-muted">
        Сервис не заменяет профессиональное суждение и ответственность оценщика. Данные из внешних источников используются только через легальные каналы.
      </footer>
    </div>
  );
}
