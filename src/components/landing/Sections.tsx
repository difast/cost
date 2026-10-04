import Link from "next/link";
import { fmtNumber, fmtPercent } from "@/core/format";
import { d } from "@/core/calc/decimal";
import { NORMATIVE_SEED } from "@/server/seed/normative";
import { PLANS } from "@/lib/plans";
import { EXAMPLE_INPUT, EXAMPLE_SUBJECT, exampleIssues, exampleResult } from "./data";
import { ProductTour } from "./ProductTour";

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-brand">{children}</div>
);
const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2 id={id} className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[32px]">{children}</h2>
);
const Lead = ({ children }: { children: React.ReactNode }) => <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-slate-600">{children}</p>;
const Section = ({ id, children, className = "", labelledBy }: { id?: string; children: React.ReactNode; className?: string; labelledBy?: string }) => (
  <section id={id} aria-labelledby={labelledBy} className={`scroll-mt-16 py-16 sm:py-24 ${className}`}>
    <div className="mx-auto max-w-6xl px-5">{children}</div>
  </section>
);

// ───────────────────────── 2–3. Первый экран и интерфейс

export function Hero({ authed }: { authed: boolean }) {
  return (
    <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/80 pt-14 sm:pt-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-3xl">
          <h1 className="text-[32px] font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-[46px]">
            Оценка недвижимости — в одном рабочем месте
          </h1>
          <p className="mt-5 max-w-2xl text-[16.5px] leading-relaxed text-slate-600 sm:text-[18px]">
            Данные объекта, аналоги, корректировки, расчёт и отчёт — в одной оценке, а не в десятке таблиц и вкладок. Каждая цифра расчёта видна и проверяема.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {authed ? (
              <Link href="/app" className="btn btn-primary px-5 py-2.5 text-[15px]">Открыть кабинет</Link>
            ) : (
              <>
                <Link href="/register" className="btn btn-primary px-5 py-2.5 text-[15px]">Создать аккаунт</Link>
                <Link href="/login" className="btn btn-secondary px-5 py-2.5 text-[15px]">Войти</Link>
              </>
            )}
          </div>
          <p className="mt-4 text-[13px] text-slate-500">Для профессиональных оценщиков недвижимости · сейчас — квартиры, сравнительный подход</p>
        </div>
        <div className="mt-12 pb-14 sm:mt-14 sm:pb-20">
          <ProductTour />
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── 4. Проблема

const ROUTINE: Array<[string, string, string]> = [
  ["Данные объекта", "Выписка, сайты, справочники — и ручной перенос в таблицу", "XML-выписка ЕГРН заполняет карточку, у каждого поля сохраняется источник"],
  ["Аналоги", "Поиск по площадкам, копирование ссылок и цен в Excel", "Аналог хранится вместе со ссылкой, датой получения и скриншотом; можно загрузить CSV"],
  ["Характеристики", "Одни и те же значения в нескольких таблицах и в тексте отчёта", "Вводятся один раз и используются в расчёте и во всех разделах отчёта"],
  ["Корректировки", "Формулы в Excel, коэффициенты из разных источников", "Предлагаются по выбранной редакции справочника, изменения — с обоснованием"],
  ["Проверка", "Пересчёт вручную, сверка дат, номеров и площадей", "Автоматические проверки согласованности до формирования отчёта"],
  ["Отчёт", "Сборка из нескольких документов и вставка таблиц", "DOCX и PDF по шаблону из данных этой же оценки"],
];

export function Problem() {
  return (
    <Section id="about" labelledBy="about-h">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <Eyebrow>Задача</Eyebrow>
          <H2 id="about-h">Сколько времени уходит на одну оценку?</H2>
          <Lead>
            Сам расчёт сравнительным подходом занимает немного времени. Основное уходит на подготовку: собрать сведения, найти и перенести аналоги, свести всё в таблицы, перепроверить и оформить отчёт.
          </Lead>
          <p className="mt-6 border-l-2 border-brand pl-4 text-[15.5px] font-medium text-slate-800">Мы собираем этот процесс в одном рабочем месте.</p>
        </div>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:hidden">
          {ROUTINE.map(([stage, before, after]) => (
            <li key={stage} className="px-4 py-4">
              <div className="text-[15px] font-medium text-slate-900">{stage}</div>
              <div className="mt-2 text-[13.5px] text-slate-500"><span className="text-[11.5px] uppercase tracking-wide text-slate-400">Обычно · </span>{before}</div>
              <div className="mt-1.5 text-[13.5px] text-slate-800"><span className="text-[11.5px] uppercase tracking-wide text-brand">В сервисе · </span>{after}</div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white sm:block">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[12px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-2.5 font-medium">Этап</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Обычно</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-brand">В рабочем месте</th>
              </tr>
            </thead>
            <tbody>
              {ROUTINE.map(([stage, before, after]) => (
                <tr key={stage} className="border-b border-slate-100 align-top last:border-0">
                  <th scope="row" className="w-[22%] px-4 py-3 font-medium text-slate-900">{stage}</th>
                  <td className="w-[36%] px-4 py-3 text-slate-500">{before}</td>
                  <td className="px-4 py-3 text-slate-800">{after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

// ───────────────────────── 5. Возможности

const FEATURES: Array<{ title: string; lead: string; points: string[] }> = [
  {
    title: "Данные объекта",
    lead: "Одна карточка вместо выписки, заметок и таблицы.",
    points: ["Импорт XML-выписки ЕГРН: кадастровый номер, площадь, адрес, этаж, права", "Источник и дата у каждого поля", "Характеристики дома, фото и документы"],
  },
  {
    title: "Аналоги",
    lead: "Рыночные предложения рядом с объектом оценки.",
    points: ["Ссылка, дата получения и скриншот у каждого аналога", "Отличия от объекта подсвечены", "Ручной ввод или импорт CSV"],
  },
  {
    title: "Корректировки",
    lead: "Не нужно переносить коэффициенты в Excel.",
    points: ["Расчёт по выбранной редакции справочника", "Любое значение можно изменить — с обоснованием", "Собственные редакции справочника"],
  },
  {
    title: "Расчёт",
    lead: "Прозрачная цепочка без скрытых коэффициентов.",
    points: ["Цена → корректировка 1 → … → скорректированная цена", "Веса с формулой, статистика выборки", "Версии расчёта сохраняются"],
  },
  {
    title: "Проверки",
    lead: "Несоответствия видны до того, как их увидит заказчик.",
    points: ["Сверка с выпиской ЕГРН", "Даты, источники, сроки документов оценщика", "Итог = цена за м² × площадь"],
  },
  {
    title: "Отчёт",
    lead: "Документ собирается из той же оценки, а не вручную.",
    points: ["DOCX для редактирования и PDF", "Таблицы аналогов, корректировок и расчёта", "Источники и приложения со скриншотами"],
  },
];

export function Features() {
  return (
    <Section id="features" labelledBy="features-h" className="border-t border-slate-200 bg-white">
      <Eyebrow>Возможности</Eyebrow>
      <H2 id="features-h">Всё, что нужно для оценки квартиры сравнительным подходом</H2>
      <div className="mt-12 grid border-l border-t border-slate-200 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <article key={f.title} className="border-b border-r border-slate-200 p-6 sm:p-7">
            <div className="font-mono text-[12px] text-slate-400">{String(i + 1).padStart(2, "0")}</div>
            <h3 className="mt-2 text-[17px] font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1.5 text-[14.5px] text-slate-600">{f.lead}</p>
            <ul className="mt-4 space-y-2 text-[13.5px] text-slate-700">
              {f.points.map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
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
    <Section labelledBy="example-h" className="border-t border-slate-200 bg-white">
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
    <Section labelledBy="checks-h" className="border-t border-slate-200">
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
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
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
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5" aria-label="Пример поиска по нормативной базе">
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
    <section className="bg-slate-900 py-16 sm:py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-[30px]">Проведите следующую оценку в одном рабочем месте</h2>
          <p className="mt-3 text-[15.5px] text-slate-300">Создайте аккаунт и попробуйте рабочее место оценщика.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          {authed ? (
            <Link href="/app" className="btn bg-white px-5 py-2.5 text-[15px] text-slate-900 hover:bg-slate-100">Открыть кабинет</Link>
          ) : (
            <>
              <Link href="/register" className="btn bg-white px-5 py-2.5 text-[15px] text-slate-900 hover:bg-slate-100">Создать аккаунт</Link>
              <Link href="/login" className="btn border border-slate-600 px-5 py-2.5 text-[15px] text-white hover:bg-slate-800">Войти</Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
