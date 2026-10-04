import Link from "next/link";
import { fmtNumber, fmtPercent } from "@/core/format";
import { d } from "@/core/calc/decimal";
import { NORMATIVE_SEED } from "@/server/seed/normative";
import { PLANS } from "@/lib/plans";
import { EXAMPLE_INPUT, EXAMPLE_SUBJECT, exampleIssues, exampleResult } from "./data";
import { ProductTour } from "./ProductTour";
import { HeroVideo } from "./HeroVideo";

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-brand">{children}</div>
);
const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2 id={id} className="text-[28px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[38px]">{children}</h2>
);
const Lead = ({ children }: { children: React.ReactNode }) => <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-slate-600">{children}</p>;
const Section = ({ id, children, className = "", labelledBy }: { id?: string; children: React.ReactNode; className?: string; labelledBy?: string }) => (
  <section id={id} aria-labelledby={labelledBy} className={`scroll-mt-16 py-16 sm:py-24 ${className}`}>
    <div className="mx-auto max-w-7xl px-5">{children}</div>
  </section>
);

// ───────────────────────── 2. Первый экран (с видео)

const HERO_STRIP: Array<[string, string, string]> = [
  ["Ранний доступ", "Регистрация и работа в сервисе сейчас бесплатны", "#pricing"],
  ["Выписка ЕГРН", "XML-выписка заполняет карточку объекта", "#features"],
  ["Проверки", "Ошибки видны до формирования отчёта", "#checks"],
  ["Отчёт", "DOCX и PDF из данных этой же оценки", "#how"],
];

export function Hero({ authed }: { authed: boolean }) {
  return (
    <section className="bg-brand-deep text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-12 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,11fr)_minmax(0,10fr)] lg:gap-14 lg:pb-16 lg:pt-20">
        <div>
          <span className="inline-flex rounded-full bg-white/15 px-3.5 py-1.5 text-[13.5px] text-white/95">Для оценщиков · квартиры, сравнительный подход</span>
          <h1 className="mt-5 text-[34px] font-bold leading-[1.12] tracking-tight sm:text-[48px] lg:text-[54px]">Оценка недвижимости — в одном рабочем месте</h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/90 sm:text-[19px]">
            Собирайте <b className="font-semibold text-white">данные об объекте</b>, работайте с <b className="font-semibold text-white">аналогами</b>, рассчитывайте корректировки и формируйте <b className="font-semibold text-white">отчёт</b> — без десятков таблиц и вкладок.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            {authed ? (
              <Link href="/app" className="btn bg-white px-6 py-3 text-[16px] font-semibold text-brand-deep hover:bg-blue-50">Открыть кабинет</Link>
            ) : (
              <>
                <Link href="/register" className="btn bg-white px-6 py-3 text-[16px] font-semibold text-brand-deep hover:bg-blue-50">Создать аккаунт</Link>
                <Link href="/login" className="text-[16px] font-medium text-white hover:underline">Войти →</Link>
              </>
            )}
          </div>
          <p className="mt-5 text-[14px] text-white/75">Для профессиональных оценщиков недвижимости</p>
        </div>
        <HeroVideo />
      </div>
      <div className="mx-auto max-w-7xl px-5">
        <nav className="grid grid-cols-2 lg:grid-cols-4" aria-label="Коротко о сервисе">
          {HERO_STRIP.map(([k, v, href], i) => (
            <a key={k} href={href} className={`border-t px-4 py-4 transition hover:bg-white/10 sm:px-6 sm:py-5 ${i === 0 ? "border-white bg-white/10" : "border-white/30"}`}>
              <div className="text-[12.5px] text-white/70">{k}</div>
              <div className="mt-1.5 text-[14.5px] leading-snug text-white sm:text-[16px]">{v}</div>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}

// ───────────────────────── 3. Задача (две колонки)

const PAINS = [
  "данные об объекте собираются из разных источников",
  "аналоги ищутся и переносятся вручную",
  "характеристики дублируются в нескольких таблицах",
  "корректировки считаются в Excel",
  "расчёт проверяется вручную",
  "отчёт собирается из нескольких документов",
];

export function Problem({ authed }: { authed: boolean }) {
  return (
    <Section id="about" labelledBy="about-h" className="bg-white">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="relative order-2 lg:order-1">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/ui-comparables.jpg" alt="Таблица аналогов рядом с объектом оценки" width={2880} height={1800} loading="lazy" className="block h-auto w-full" />
          </div>
          <div className="absolute -bottom-8 right-2 w-[30%] min-w-[110px] overflow-hidden rounded-[18px] border-[5px] border-slate-900 bg-white shadow-xl sm:right-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/ui-mobile.jpg" alt="Расчёт на телефоне" width={1170} height={2532} loading="lazy" className="block h-auto w-full" />
          </div>
          <span className="absolute -top-4 right-6 rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-medium text-white shadow-md">Выписка ЕГРН · XML</span>
          <span className="absolute -bottom-5 left-4 hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 shadow-md sm:flex">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.2" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            Ошибок: 0 · отчёт можно формировать
          </span>
        </div>
        <div className="order-1 lg:order-2">
          <H2 id="about-h">Сколько времени уходит на <span className="text-brand">одну оценку</span>?</H2>
          <p className="mt-5 text-[17px] leading-relaxed text-slate-600">Сам расчёт занимает немного времени. Основное уходит на подготовку:</p>
          <ul className="mt-4 grid gap-x-6 gap-y-2.5 text-[16px] text-slate-700 sm:grid-cols-2">
            {PAINS.map((p) => (
              <li key={p} className="flex gap-2.5"><span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />{p}</li>
            ))}
          </ul>
          <p className="mt-6 text-[17px] font-semibold text-slate-900">Мы собираем этот процесс в одном рабочем месте.</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={authed ? "/app" : "/register"} className="btn btn-primary px-5 py-2.5 text-[15.5px]">{authed ? "Открыть кабинет" : "Создать аккаунт"}</Link>
            <a href="#example" className="text-[15.5px] font-medium text-brand hover:underline">Пример расчёта →</a>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ───────────────────────── 4–5. Рабочее место и возможности

const Icon = ({ d }: { d: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

const FEATURES: Array<{ title: string; text: string; icon: string }> = [
  { title: "Данные объекта", text: "ЕГРН и характеристики объекта в одной карточке. У каждого поля — источник и дата.", icon: "M4 21V8l8-5 8 5v13M9 21v-6h6v6" },
  { title: "Аналоги", text: "Хранение и сравнение аналогов: ссылка, дата и скриншот. Ручной ввод или импорт CSV.", icon: "M4 6h16M4 12h16M4 18h10" },
  { title: "Корректировки", text: "Расчёт по выбранной редакции справочника. Изменение значения — только с обоснованием.", icon: "M5 4v16M12 4v16M19 4v16M3 9h4M10 15h4M17 7h4" },
  { title: "Расчёт", text: "Прозрачная цепочка: цена → корректировки → веса → итог. Версии расчёта сохраняются.", icon: "M6 3h12v18H6zM9 7h6M9 11h2M13 11h2M9 15h2M13 15h2" },
  { title: "Проверки", text: "Автоматический поиск несоответствий: кадастровый номер, площадь, даты, источники, формулы.", icon: "M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-4.5" },
  { title: "Отчёт", text: "DOCX и PDF на основе выполненной оценки: таблицы, обоснования, источники, приложения.", icon: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" },
];

export function Features() {
  return (
    <Section id="features" labelledBy="features-h" className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-3xl text-center">
        <H2 id="features-h">Рабочее место, а не набор таблиц</H2>
        <p className="mx-auto mt-4 max-w-2xl text-[17px] leading-relaxed text-slate-600">Все этапы оценки квартиры сравнительным подходом — в одной оценке. Ниже реальные экраны сервиса.</p>
      </div>
      <div className="mx-auto mt-10 max-w-5xl">
        <ProductTour />
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200/70">
            <div className="text-brand"><Icon d={f.icon} /></div>
            <h3 className="mt-4 text-[18px] font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{f.text}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

// ───────────────────────── 6. Как работает

const STEPS: Array<[string, string, string]> = [
  ["Создайте оценку", "Введите адрес или кадастровый номер квартиры.", "Раздел «Оценки»"],
  ["Заполните объект", "Загрузите XML-выписку ЕГРН — данные перенесутся в карточку автоматически.", "Вкладки «Задание» и «Объект»"],
  ["Добавьте аналоги", "Занесите рыночные предложения со ссылками и сравните их с объектом.", "Вкладка «Аналоги»"],
  ["Проверьте расчёт", "Сервис применит корректировки и покажет формулу каждого шага.", "Вкладки «Корректировки», «Расчёт», «Проверки»"],
  ["Получите отчёт", "Сформируйте DOCX и PDF. Версия расчёта зафиксируется.", "Вкладка «Отчёт»"],
];

export function HowItWorks() {
  return (
    <Section id="how" labelledBy="how-h" className="border-t border-slate-200">
      <Eyebrow>Как работает</Eyebrow>
      <H2 id="how-h">Пять шагов от заказа до отчёта</H2>
      <ol className="mt-12 grid gap-0 lg:grid-cols-5">
        {STEPS.map(([title, text, where], i) => (
          <li key={title} className="relative border-l-2 border-slate-200 pb-8 pl-6 lg:border-l-0 lg:border-t-2 lg:pb-0 lg:pl-0 lg:pr-6 lg:pt-6">
            <span className="absolute -left-[7px] top-0 h-3 w-3 rounded-full border-2 border-brand bg-white lg:-top-[7px] lg:left-0" aria-hidden="true" />
            <div className="font-mono text-[13px] font-medium text-brand">{String(i + 1).padStart(2, "0")}</div>
            <h3 className="mt-1.5 text-[16px] font-semibold text-slate-900">{title}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{text}</p>
            <p className="mt-3 text-[12px] text-slate-400">{where}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

// ───────────────────────── 7. Пример расчёта

export function Example() {
  const r = exampleResult();
  const n = (v: string, dp = 0) => fmtNumber(v, dp);
  return (
    <Section id="example" labelledBy="example-h" className="border-t border-slate-200 bg-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Механизм</Eyebrow>
          <H2 id="example-h">От объекта до итоговой стоимости</H2>
        </div>
        <span className="w-fit rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[12px] text-amber-800">Пример на демонстрационных данных</span>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-lg border border-slate-200 p-5">
          <div className="text-[12px] uppercase tracking-wide text-slate-500">Объект оценки</div>
          <div className="mt-1 text-[16px] font-semibold text-slate-900">{EXAMPLE_SUBJECT.title}</div>
          <dl className="mt-4 space-y-2 text-[13.5px]">
            {EXAMPLE_SUBJECT.facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100 sm:hidden">
            {r.comparables.map((c, i) => (
              <li key={c.id} className="px-4 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-slate-900">{c.label}</span>
                  <span className="text-[12px] text-slate-500">вес {c.weight.replace(".", ",")}</span>
                </div>
                <div className="num mt-0.5 text-[12px] text-slate-500">{n(EXAMPLE_INPUT.comparables[i].price)} ₽ · {fmtNumber(c.area, 1, true)} м² · {n(c.unitPrice, 2)} ₽/м²</div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {c.steps.map((st) => (
                    <span key={st.code} className={`num rounded border px-1.5 py-0.5 text-[12px] ${d(st.value).isNeg() ? "border-red-100 bg-red-50/60 text-red-700" : "border-green-100 bg-green-50/60 text-green-700"}`}>{st.name} {fmtPercent(st.value, 2, true)}</span>
                  ))}
                </div>
                <div className="num mt-2.5 text-[14px] text-slate-900">→ {n(c.adjustedUnitPrice, 2)} ₽/м²</div>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-[13.5px] sm:table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[12px] text-slate-500">
                <th scope="col" className="px-4 py-2.5 font-medium">Аналог</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Цена за м², ₽</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Корректировки</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Скорр. цена, ₽/м²</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Вес</th>
              </tr>
            </thead>
            <tbody>
              {r.comparables.map((c, i) => (
                <tr key={c.id} className="border-b border-slate-100 align-top">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-slate-900">
                    {c.label}
                    <div className="text-[12px] font-normal text-slate-500">{n(EXAMPLE_INPUT.comparables[i].price)} ₽ · {fmtNumber(c.area, 1, true)} м²</div>
                  </th>
                  <td className="num px-4 py-3 text-right text-slate-700">{n(c.unitPrice, 2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {c.steps.map((s) => (
                        <span key={s.code} className={`num rounded border px-1.5 py-0.5 text-[12px] ${d(s.value).isNeg() ? "border-red-100 bg-red-50/60 text-red-700" : "border-green-100 bg-green-50/60 text-green-700"}`}>
                          {s.name} {fmtPercent(s.value, 2, true)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="num px-4 py-3 text-right font-medium text-slate-900">{n(c.adjustedUnitPrice, 2)}</td>
                  <td className="num px-4 py-3 text-right text-slate-700">{c.weight.replace(".", ",")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-3">
            <div className="bg-slate-50 px-4 py-3">
              <div className="text-[12px] text-slate-500">Средневзвешенная цена</div>
              <div className="num mt-0.5 text-[15px] font-medium text-slate-900">{n(r.weightedUnitPrice, 2)} ₽/м²</div>
            </div>
            <div className="bg-slate-50 px-4 py-3">
              <div className="text-[12px] text-slate-500">× площадь {fmtNumber(r.subjectArea, 1, true)} м²</div>
              <div className="num mt-0.5 text-[15px] font-medium text-slate-900">{n(r.rawValue, 2)} ₽</div>
            </div>
            <div className="bg-white px-4 py-3">
              <div className="text-[12px] text-slate-500">Итог, округлено до 1 000 ₽</div>
              <div className="num mt-0.5 text-[20px] font-semibold text-slate-900">{n(r.finalValue)} ₽</div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-[12.5px] leading-relaxed text-slate-500">
        Числа получены расчётным ядром сервиса. Корректировки применяются последовательно, каждый шаг округляется до копеек, веса обратно пропорциональны суммарной корректировке аналога. Значения корректировок — из демонстрационного справочника; в работе оценщик использует свою или лицензированную редакцию.
      </p>
    </Section>
  );
}

// ───────────────────────── 8. Контроль ошибок

export function Checks() {
  const issues = exampleIssues();
  return (
    <Section id="checks" labelledBy="checks-h" className="border-t border-slate-200 bg-slate-50">
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>Контроль</Eyebrow>
          <H2 id="checks-h">Расчёт проверяется до формирования отчёта</H2>
          <Lead>Пока есть ошибки, отчёт не формируется. Предупреждения не блокируют работу, но остаются на виду. Каждое замечание ведёт к месту, где его нужно исправить.</Lead>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 text-[14px]">
            {[
              ["Объект", "кадастровый номер, площадь, этаж и адрес сверяются с выпиской ЕГРН"],
              ["Даты", "оценки, осмотра, отчёта и предложений аналогов"],
              ["Аналоги", "ссылка, дата, адрес, скриншот, дубликаты"],
              ["Корректировки", "обоснование ручных изменений, диапазоны справочника"],
              ["Расчёт", "сходимость цепочки, весов и итога"],
              ["Тексты", "чужие кадастровые номера и даты — остатки другого отчёта"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium text-slate-900">{k}</dt>
                <dd className="mt-0.5 text-slate-600">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_12px_40px_-16px_rgba(15,23,42,.18)]">
          <div className="grid grid-cols-3 border-b border-slate-200 text-center">
            <div className="px-3 py-3"><div className="text-[11.5px] text-slate-500">Ошибки</div><div className="text-[22px] font-semibold text-err">{issues.filter((i) => i.severity === "error").length}</div></div>
            <div className="border-x border-slate-200 px-3 py-3"><div className="text-[11.5px] text-slate-500">Предупреждения</div><div className="text-[22px] font-semibold text-warn">{issues.filter((i) => i.severity === "warning").length}</div></div>
            <div className="px-3 py-3"><div className="text-[11.5px] text-slate-500">Отчёт</div><div className="mt-1.5 text-[14px] font-semibold text-err">не формируется</div></div>
          </div>
          <ul className="divide-y divide-slate-100">
            {issues.map((i) => (
              <li key={i.code} className="flex items-start gap-3 px-4 py-3 text-[13.5px]">
                <span className={`badge mt-0.5 shrink-0 ${i.severity === "error" ? "bg-red-50 text-err" : "bg-amber-50 text-warn"}`}>{i.severity === "error" ? "Ошибка" : "Внимание"}</span>
                <span className="text-slate-800">{i.message}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11.5px] text-slate-500">Вкладка «Проверки» · сообщения сформированы проверками сервиса на демонстрационных данных</div>
        </div>
      </div>
    </Section>
  );
}

// ───────────────────────── 9. Нормативная база

export function Normative({ authed }: { authed: boolean }) {
  const found = NORMATIVE_SEED.filter((d) => d.kind === "fso");
  const docs = found.slice(0, 4);
  return (
    <Section id="normative" labelledBy="normative-h" className="border-t border-slate-200 bg-white">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div className="lg:order-2">
          <Eyebrow>Нормативная база</Eyebrow>
          <H2 id="normative-h">Нормативная база всегда под рукой</H2>
          <Lead>135-ФЗ, федеральные стандарты оценки, законы о регистрации недвижимости и ипотеке — с поиском по названию, номеру и содержанию. Библиотека пополняется стандартами СРО и методическими материалами.</Lead>
          <ul className="mt-6 space-y-1.5 text-[14px] text-slate-700">
            <li>135-ФЗ «Об оценочной деятельности в Российской Федерации»</li>
            <li>ФСО I–VI, ФСО № 7 «Оценка недвижимости», ФСО № 9</li>
            <li>218-ФЗ, 102-ФЗ</li>
          </ul>
          <Link href={authed ? "/app/normative" : "/register?next=/app/normative"} className="btn btn-secondary mt-8 px-4 py-2">Открыть нормативную базу</Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-[0_24px_60px_-30px_rgba(15,23,42,.3)] sm:p-6 lg:order-1" aria-label="Пример поиска по нормативной базе">
          <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px]">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#64748b" strokeWidth="1.8" aria-hidden="true"><circle cx="9" cy="9" r="6" /><path d="M14 14l4 4" /></svg>
            <span className="text-slate-900">ФСО</span>
            <span className="ml-auto text-[12px] text-slate-400">найдено: {found.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            {docs.map((doc) => (
              <div key={doc.code} className="rounded-md border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[14px] font-medium text-slate-900"><span className="mr-2 text-brand">{doc.code}</span>{doc.title.replace(/^ФСО [^«]*/, "")}</div>
                  <span className="badge shrink-0 bg-green-50 text-ok">действует</span>
                </div>
                <div className="mt-1 text-[12px] text-slate-500">{doc.issuer}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ───────────────────────── 10. Тарифы

export function Pricing() {
  return (
    <Section id="pricing" labelledBy="pricing-h" className="border-t border-slate-200">
      <Eyebrow>Тарифы</Eyebrow>
      <H2 id="pricing-h">Для оценщика и для оценочной компании</H2>
      <p className="mt-4 max-w-2xl rounded-md border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-600">
        Сейчас сервис работает в режиме раннего доступа: регистрация и работа бесплатны, приём оплаты будет подключён позже. Цены ниже — предварительные.
      </p>
      <div className="-mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {PLANS.map((p) => (
          <article
            key={p.code}
            className={`flex w-[82%] shrink-0 snap-start flex-col rounded-lg border bg-white p-6 sm:w-[48%] lg:w-auto ${p.recommended ? "border-brand ring-1 ring-brand" : "border-slate-200"}`}
          >
            <div className="flex h-5 items-center">{p.recommended && <span className="rounded bg-blue-50 px-2 py-0.5 text-[11.5px] font-medium text-brand">Основной тариф</span>}</div>
            <h3 className="mt-2 text-[16px] font-semibold text-slate-900">{p.name}</h3>
            <p className="mt-1 text-[13px] text-slate-500">{p.audience}</p>
            <div className="mt-5 flex items-baseline gap-1.5">
              {p.pricePrefix && <span className="text-[14px] text-slate-500">{p.pricePrefix}</span>}
              <span className="num text-[28px] font-semibold tracking-tight text-slate-900">{p.price} ₽</span>
              <span className="text-[13px] text-slate-500">/ месяц</span>
            </div>
            <ul className="mt-5 flex-1 space-y-2.5 text-[13.5px]">
              {p.items.map((it) => (
                <li key={it.text} className="flex gap-2.5">
                  <svg className="mt-[3px] shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={it.status ? "#94a3b8" : "#1d4ed8"} strokeWidth="2" aria-hidden="true"><path d="M3 8.5l3 3 7-7" /></svg>
                  <span className={it.status ? "text-slate-500" : "text-slate-800"}>
                    {it.text}
                    {it.status === "planned" && <span className="ml-1.5 whitespace-nowrap text-[11.5px] text-slate-400">— в разработке</span>}
                    {it.status === "on_request" && <span className="ml-1.5 whitespace-nowrap text-[11.5px] text-slate-400">— по запросу</span>}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/register" className={`btn mt-6 py-2 ${p.recommended ? "btn-primary" : "btn-secondary"}`}>Создать аккаунт</Link>
          </article>
        ))}
      </div>
    </Section>
  );
}

// ───────────────────────── 11. FAQ

const FAQ: Array<[string, React.ReactNode]> = [
  ["Для кого предназначен сервис?", "Для профессиональных оценщиков недвижимости и оценочных компаний. Сейчас поддерживается оценка квартир сравнительным подходом; другие объекты и подходы появятся в следующих версиях. Сервис работает в браузере на компьютере и телефоне; на iPhone его можно добавить на главный экран, приложение для Android в RuStore планируется."],
  ["Можно ли загрузить собственную выписку ЕГРН?", "Да. XML-выписка разбирается автоматически: кадастровый номер, площадь, адрес, этаж, права и обременения попадают в карточку объекта, а расхождения с уже введёнными данными показываются в проверках. Выписку в PDF можно приложить как документ, данные в этом случае вносятся вручную."],
  ["Откуда берутся аналоги?", "Аналоги вносятся вручную по ссылке на объявление или загружаются из CSV-файла. У каждого аналога хранятся ссылка, дата получения и скриншот. Автоматический подбор аналогов в сервисе пока не работает — он появится после подключения легальных источников данных."],
  ["Можно ли изменить корректировку?", "Да. Сервис предлагает значение по выбранному справочнику, оценщик может его изменить. Изменение требует обоснования, попадает в отчёт и фиксируется в истории оценки."],
  ["Можно ли посмотреть старую версию расчёта?", "Да. Версия расчёта хранит полный снимок данных и коэффициентов. По старой версии можно повторно сформировать отчёт — с теми значениями, которые действовали тогда, а не с текущими."],
  ["Можно ли получить готовый отчёт?", "Да, сервис формирует отчёт в DOCX и PDF: задание, сведения об оценщике, описание объекта, анализ рынка, аналоги, таблицы корректировок, расчёт, итоговая стоимость, источники и приложения. DOCX можно дополнить в Word."],
  ["Заменяет ли сервис оценщика?", "Нет. Сервис автоматизирует сбор данных, расчёты, проверки и подготовку отчёта. Профессиональное суждение и ответственность за результат остаются за оценщиком."],
  [
    "Какие источники данных используются?",
    <>
      <span className="block">Работают сейчас: ручной ввод, загрузка XML-выписки ЕГРН, импорт аналогов из CSV.</span>
      <span className="mt-2 block">Планируются: Росреестр/НСПД, ГИС ЖКХ, ФИАС/ГАР, площадки объявлений, картографические сервисы, Росстат и Банк России. Подключение — только через официальный или партнёрский доступ либо лицензированного поставщика данных. Парсинг сайтов не используется.</span>
    </>,
  ],
];

export function Faq() {
  return (
    <Section id="faq" labelledBy="faq-h" className="border-t border-slate-200 bg-white">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
        <div>
          <Eyebrow>Вопросы</Eyebrow>
          <H2 id="faq-h">Частые вопросы</H2>
        </div>
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15.5px] font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                {q}
                <svg className="shrink-0 text-slate-400 transition group-open:rotate-45" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
              </summary>
              <div className="pb-5 pr-8 text-[14.5px] leading-relaxed text-slate-600">{a}</div>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ───────────────────────── 12. Финальный CTA

export function FinalCta({ authed }: { authed: boolean }) {
  return (
    <section className="bg-brand-deep py-16 sm:py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[28px] font-bold leading-tight tracking-tight text-white sm:text-[36px]">Проведите следующую оценку в одном рабочем месте</h2>
          <p className="mt-3 text-[17px] text-white/85">Создайте аккаунт и попробуйте рабочее место оценщика.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          {authed ? (
            <Link href="/app" className="btn bg-white px-6 py-3 text-[16px] font-semibold text-brand-deep hover:bg-blue-50">Открыть кабинет</Link>
          ) : (
            <>
              <Link href="/register" className="btn bg-white px-6 py-3 text-[16px] font-semibold text-brand-deep hover:bg-blue-50">Создать аккаунт</Link>
              <Link href="/login" className="btn border border-white/50 px-6 py-3 text-[16px] text-white hover:bg-white/10">Войти</Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
