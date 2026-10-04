"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "@/lib/api";
import { comparePeriods, demoRows, groupBy, histogram, monthLabel, monthly, regionOf, stats, unitPrice, type AnalyticsRow, type Stats } from "@/core/analytics";
import { d } from "@/core/calc/decimal";
import { fmtNumber, fmtPercent } from "@/core/format";
import { Icon } from "@/components/ui/Icon";
import { Badge, EmptyState, Notice, PageHeader, PageSkeleton, Panel, Segmented, Stat } from "@/components/ui/kit";
import { BarChart, LineChart } from "./Charts";

type Period = "all" | "12" | "6" | "3";
const MIN_ROWS = 3;

const rub = (v: string | null) => (v ? fmtNumber(v, 0) : "—");

function addMonths(iso: string, n: number) {
  const dt = new Date(iso);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + n, dt.getUTCDate())).toISOString().slice(0, 10);
}

function StatsRow({ title, s, change, range = true }: { title: string; s: Stats; change?: string | null; range?: boolean }) {
  return (
    <tr>
      <td className="font-medium">{title}</td>
      <td className="num text-right">{s.count}</td>
      <td className="num text-right">{rub(s.mean)}</td>
      <td className="num text-right font-semibold">{rub(s.median)}</td>
      {range && <td className="num text-right text-zinc-700">{rub(s.min)} – {rub(s.max)}</td>}
      {change !== undefined && <td className={`num text-right ${change ? (d(change).isNeg() ? "text-err" : "text-ok") : "text-muted"}`}>{change ? fmtPercent(change, 1, true) : "—"}</td>}
    </tr>
  );
}

export function AnalyticsView() {
  const [real, setReal] = useState<AnalyticsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [period, setPeriod] = useState<Period>("all");
  const [region, setRegion] = useState("");
  const [rooms, setRooms] = useState("");
  const [onlyIncluded, setOnlyIncluded] = useState(false);
  const [compareLen, setCompareLen] = useState<"1" | "3" | "6">("3");

  useEffect(() => {
    api.get<{ rows: AnalyticsRow[] }>("/api/analytics").then((r) => setReal(r.rows)).catch((e) => setError(errorText(e)));
  }, []);

  const source = useMemo(() => (demo ? demoRows() : real ?? []), [demo, real]);
  const lastDate = useMemo(() => source.map((r) => r.date).filter(Boolean).sort().pop() ?? new Date().toISOString(), [source]);
  const regions = useMemo(() => [...new Set(source.map((r) => regionOf(r.address)))].sort((a, b) => a.localeCompare(b, "ru")), [source]);

  const rows = useMemo(() => {
    let r = source;
    if (period !== "all") {
      const from = addMonths(lastDate, -Number(period));
      r = r.filter((x) => x.date && x.date.slice(0, 10) > from);
    }
    if (region) r = r.filter((x) => regionOf(x.address) === region);
    if (rooms) r = r.filter((x) => (rooms === "4" ? (x.rooms ?? 0) >= 4 : String(x.rooms ?? "") === rooms));
    if (onlyIncluded) r = r.filter((x) => x.included);
    return r;
  }, [source, period, region, rooms, onlyIncluded, lastDate]);

  if (error) return <Notice tone="err" title="Не удалось загрузить данные">{error}</Notice>;
  if (!real) return <PageSkeleton />;

  const enoughReal = real.length >= MIN_ROWS;
  const header = (
    <PageHeader
      title="Аналитика"
      description="Цены предложений по аналогам из ваших оценок"
      actions={
        (enoughReal || demo) && (
          <Segmented size="sm" value={demo ? "demo" : "mine"} onChange={(v) => setDemo(v === "demo")} options={[["mine", `Мои данные · ${real.length}`], ["demo", "Демонстрационные"]]} />
        )
      }
    />
  );

  if (!enoughReal && !demo) {
    return (
      <div className="mx-auto max-w-[1360px]">
        {header}
        <div className="card">
          <EmptyState
            icon="calculator"
            title="Недостаточно данных для аналитики"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/app" className="btn btn-primary">Перейти к оценкам</Link>
                <button className="btn btn-secondary" onClick={() => setDemo(true)}>Показать пример на демонстрационных данных</button>
              </div>
            }
          >
            Аналитика строится по аналогам из ваших оценок: цена, площадь, дата предложения и адрес. Сейчас аналогов: {real.length}, нужно не меньше {MIN_ROWS}. Внешние источники рыночных данных пока не подключены.
          </EmptyState>
        </div>
      </div>
    );
  }

  const prices = rows.map(unitPrice);
  const st = stats(prices);
  const months = monthly(rows);
  const byMonth = new Map<string, Stats>();
  for (const m of months) byMonth.set(m.month, stats(rows.filter((r) => r.date?.startsWith(m.month)).map(unitPrice)));
  const hist = histogram(prices);
  const regionStats = groupBy(rows, (r) => regionOf(r.address));
  const sourceStats = groupBy(rows, (r) => r.sourceName || "Не указан");
  const roomStats = groupBy(rows, (r) => (r.rooms ? (r.rooms >= 4 ? "4+ комнаты" : `${r.rooms}-комн.`) : "Не указано")).sort((a, b) => a.key.localeCompare(b.key, "ru"));
  const n = Number(compareLen);
  const bTo = lastDate.slice(0, 10);
  const bFrom = addMonths(bTo, -n);
  const aTo = bFrom;
  const aFrom = addMonths(aTo, -n);
  const cmp = comparePeriods(rows, [addMonths(aFrom, 0), aTo], [addMonths(bFrom, 0), bTo]);
  const withCalc = rows.filter((r) => r.totalChange !== null);
  const avgChange = withCalc.length ? withCalc.reduce((s, r) => s.plus(r.totalChange!), d(0)).div(withCalc.length).toString() : null;
  const dateRu = (iso: string) => iso.split("-").reverse().join(".");

  return (
    <div className="mx-auto max-w-[1360px]">
      {header}
      {demo && (
        <Notice tone="warn" className="mb-4" title="Демонстрационные данные">
          Синтетический набор для знакомства с разделом. Цифры не отражают реальный рынок и нигде не сохраняются.
          {enoughReal ? "" : " Добавьте аналоги в свои оценки, чтобы увидеть собственную аналитику."}
        </Notice>
      )}

      <section className="card mb-4 flex flex-col gap-2 p-3 lg:flex-row lg:items-center">
        <Segmented size="sm" value={period} onChange={setPeriod} options={[["all", "Всё время"], ["12", "12 мес"], ["6", "6 мес"], ["3", "3 мес"]]} />
        <select className="input lg:w-56" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Регион">
          <option value="">Все регионы</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="input lg:w-44" value={rooms} onChange={(e) => setRooms(e.target.value)} aria-label="Комнат">
          <option value="">Любое число комнат</option>
          <option value="1">1-комнатные</option><option value="2">2-комнатные</option><option value="3">3-комнатные</option><option value="4">4+ комнаты</option>
        </select>
        <label className="flex items-center gap-2 text-[13px] text-zinc-700 lg:ml-2"><input type="checkbox" className="h-4 w-4 accent-[#176b4d]" checked={onlyIncluded} onChange={(e) => setOnlyIncluded(e.target.checked)} />Только включённые в расчёт</label>
        <span className="text-[12px] text-muted lg:ml-auto">Выборка: {rows.length} из {source.length}</span>
      </section>

      {rows.length === 0 ? (
        <div className="card"><EmptyState icon="search" title="Нет аналогов по выбранным условиям" action={<button className="btn btn-secondary" onClick={() => { setPeriod("all"); setRegion(""); setRooms(""); setOnlyIncluded(false); }}>Сбросить фильтры</button>}>Измените период, регион или число комнат.</EmptyState></div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
            <Stat label="Аналогов" value={st.count} />
            <Stat label="Средняя цена 1 м², ₽" value={rub(st.mean)} />
            <Stat label="Медиана 1 м², ₽" value={rub(st.median)} />
            <Stat label="Межквартильный диапазон" value={<span className="whitespace-normal text-[17px]">{rub(st.p25)} – {rub(st.p75)}</span>} hint="50 % предложений внутри" />
            <Stat label="Мин – макс, ₽/м²" value={<span className="whitespace-normal text-[17px]">{rub(st.min)} – {rub(st.max)}</span>} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Panel title="Динамика цены 1 м²" description="Медиана по месяцу предложения; полоса — 25–75 % предложений">
              {months.length >= 2 ? (
                <LineChart
                  valueLabel="Медиана 1 м²"
                  points={months.map((m) => ({ label: monthLabel(m.month), value: Number(m.median), lo: Number(byMonth.get(m.month)!.p25), hi: Number(byMonth.get(m.month)!.p75), count: m.count }))}
                />
              ) : (
                <div className="flex h-48 flex-col items-center justify-center text-center text-[13px] text-muted">
                  <Icon name="clock" size={20} className="mb-2" />
                  Для динамики нужны предложения минимум за два разных месяца.
                </div>
              )}
            </Panel>
            <Panel title="Распределение цены 1 м²" description="Количество аналогов в ценовых интервалах">
              <BarChart
                ariaLabel="Распределение цены 1 м²"
                data={hist.map((b) => {
                  const width = Number(b.to) - Number(b.from);
                  const dp = width >= 1000 ? 0 : width >= 100 ? 1 : 2;
                  return { label: fmtNumber(Number(b.from) / 1000, dp, true), value: b.count, hint: `${fmtNumber(b.from, 0)} – ${fmtNumber(b.to, 0)} ₽/м²` };
                })}
              />
              <div className="mt-1 text-right text-[11.5px] text-muted">тыс. ₽ за м²</div>
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Panel title="Рынок по регионам" description="Регион определяется по адресу аналога" bodyClassName="">
              <div className="overflow-x-auto">
                <table className="tbl min-w-[520px]">
                  <thead><tr><th>Регион</th><th className="text-right">Аналогов</th><th className="text-right">Средняя, ₽/м²</th><th className="text-right">Медиана, ₽/м²</th><th className="text-right">Диапазон, ₽/м²</th></tr></thead>
                  <tbody>{regionStats.map((g) => <StatsRow key={g.key} title={g.key} s={g} />)}</tbody>
                </table>
              </div>
            </Panel>
            <Panel
              title="Сравнение периодов"
              description={`${dateRu(aFrom)} – ${dateRu(aTo)} и ${dateRu(bFrom)} – ${dateRu(bTo)}`}
              actions={<Segmented size="sm" value={compareLen} onChange={setCompareLen} options={[["1", "1 мес"], ["3", "3 мес"], ["6", "6 мес"]]} />}
              bodyClassName=""
            >
              <div className="overflow-x-auto">
                <table className="tbl min-w-[440px]">
                  <thead><tr><th>Период</th><th className="text-right">Аналогов</th><th className="text-right">Средняя, ₽/м²</th><th className="text-right">Медиана, ₽/м²</th><th className="text-right">Δ медианы</th></tr></thead>
                  <tbody>
                    <StatsRow title="Предыдущий" s={cmp.a} change={null} range={false} />
                    <StatsRow title="Последний" s={cmp.b} change={cmp.medianChange} range={false} />
                  </tbody>
                </table>
              </div>
              {(cmp.a.count === 0 || cmp.b.count === 0) && <p className="px-4 py-2.5 text-[12px] text-muted">В одном из периодов нет предложений — изменение не рассчитывается.</p>}
            </Panel>
          </div>

          <Panel className="mt-4" title="Статистика по аналогам" bodyClassName="">
            <div className="grid gap-px bg-line lg:grid-cols-3">
              <div className="bg-white">
                <div className="px-4 pb-1 pt-3 text-[12px] font-medium uppercase tracking-[0.04em] text-muted">По площадкам</div>
                <table className="tbl">
                  <thead><tr><th>Источник</th><th className="text-right">Аналогов</th><th className="text-right">Доля</th><th className="text-right">Медиана, ₽/м²</th></tr></thead>
                  <tbody>{sourceStats.map((g) => <tr key={g.key}><td>{g.key}</td><td className="num text-right">{g.count}</td><td className="num text-right text-muted">{fmtPercent(g.count / rows.length, 0)}</td><td className="num text-right">{rub(g.median)}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="bg-white">
                <div className="px-4 pb-1 pt-3 text-[12px] font-medium uppercase tracking-[0.04em] text-muted">По числу комнат</div>
                <table className="tbl">
                  <thead><tr><th>Сегмент</th><th className="text-right">Аналогов</th><th className="text-right">Медиана, ₽/м²</th></tr></thead>
                  <tbody>{roomStats.map((g) => <tr key={g.key}><td>{g.key}</td><td className="num text-right">{g.count}</td><td className="num text-right">{rub(g.median)}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="space-y-3 bg-white px-4 py-3 text-[13px]">
                <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-muted">В расчётах</div>
                <div className="flex justify-between"><span className="text-muted">Включены в расчёт</span><span className="num">{rows.filter((r) => r.included).length} из {rows.length}</span></div>
                <div className="flex justify-between"><span className="text-muted">Есть в зафиксированных расчётах</span><span className="num">{withCalc.length}</span></div>
                <div className="flex justify-between"><span className="text-muted">Средний итог корректировок</span><span className="num">{avgChange ? fmtPercent(avgChange, 1, true) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Оценок с аналогами</span><span className="num">{new Set(rows.map((r) => r.assessmentId)).size}</span></div>
                {!demo && <p className="pt-1 text-[12px] text-muted">Итог корректировок берётся из последней зафиксированной версии расчёта каждой оценки.</p>}
                {demo && <Badge tone="warn">демонстрационные значения</Badge>}
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
