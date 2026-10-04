"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate, fmtNumber } from "@/core/format";
import { buildChecklist, type Checklist } from "@/core/checks/catalog";
import { fieldCandidates } from "@/core/checks/target";
import { Icon } from "@/components/ui/Icon";
import { Notice, PageSkeleton, StatusBadge } from "@/components/ui/kit";
import type { CalcState, Detail } from "./types";
import { AssignmentTab } from "./AssignmentTab";
import { PropertyTab } from "./PropertyTab";
import { ComparablesTab } from "./ComparablesTab";
import { AdjustmentsTab } from "./AdjustmentsTab";
import { CalculationTab } from "./CalculationTab";
import { ChecksTab } from "./ChecksTab";
import { ReportTab } from "./ReportTab";
import { HistoryTab } from "./HistoryTab";

const STEPS = [
  ["assignment", "Задание"],
  ["property", "Объект"],
  ["comparables", "Аналоги"],
  ["adjustments", "Корректировки"],
  ["calculation", "Расчёт"],
  ["checks", "Контроль качества"],
  ["report", "Отчёт"],
] as const;
export type TabKey = (typeof STEPS)[number][0] | "history";
const ALL_TABS: TabKey[] = [...STEPS.map(([k]) => k), "history"];

type StepState = "done" | "warn" | "error" | "todo";

export interface WsProps {
  detail: Detail;
  calc: CalcState | null;
  checklist: Checklist | null;
  reload: () => Promise<void>;
  /** Переход на вкладку; field — подсветить поле (путь data-field) после открытия раздела. */
  go: (t: TabKey, field?: string) => void;
  /** Поле, к которому выполняется переход (вкладки раскрывают нужную карточку). */
  focus: string | null;
}

/** Найти поле на странице (ждём отрисовку вкладки), прокрутить, подсветить и поставить фокус. */
function focusField(field: string) {
  const sels = fieldCandidates(field).map((f) => `[data-field="${CSS.escape(f)}"]`);
  let tries = 0;
  const tick = () => {
    const el = sels.map((s) => document.querySelector<HTMLElement>(s)).find(Boolean);
    if (!el) {
      if (++tries < 40) requestAnimationFrame(tick);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("field-flash");
    void el.offsetWidth;
    el.classList.add("field-flash");
    const input = el.matches("input,select,textarea") ? el : el.querySelector<HTMLElement>("input:not([type=hidden]),select,textarea");
    input?.focus({ preventScroll: true });
  };
  requestAnimationFrame(tick);
}

function stepStates(detail: Detail, calc: CalcState | null, cl: Checklist | null): Record<string, StepState> {
  const st = (step: string): StepState => {
    if (!cl) return "todo";
    const items = cl.items.filter((i) => i.step === step);
    if (items.some((i) => i.status === "error")) return "error";
    if (items.some((i) => i.status === "warning")) return "warn";
    return "done";
  };
  const included = detail.comparables.filter((c) => c.included).length;
  const res = calc?.result;
  return {
    assignment: st("assignment"),
    property: st("property"),
    comparables: included === 0 ? "todo" : st("comparables"),
    adjustments: included === 0 ? "todo" : st("adjustments"),
    calculation: !res ? "todo" : st("calculation"),
    checks: !cl ? "todo" : cl.errors ? "error" : cl.warnings ? "warn" : "done",
    report: detail.reports.length && calc && !calc.isStale ? "done" : "todo",
  };
}

function StepIcon({ state, index, active }: { state: StepState; index: number; active: boolean }) {
  if (state === "done") return <span className={`flex h-5 w-5 items-center justify-center rounded-full ${active ? "bg-brand text-white" : "bg-ok-soft text-ok"}`}><Icon name="check" size={12} strokeWidth={2.6} /></span>;
  if (state === "error") return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-err text-[11px] font-bold text-white">!</span>;
  if (state === "warn") return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warn text-[11px] font-bold text-white">!</span>;
  return <span className={`num flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${active ? "bg-graphite text-white" : "bg-subtle text-muted"}`}>{index + 1}</span>;
}

export function Workspace({ id }: { id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [calc, setCalc] = useState<CalcState | null>(null);
  const [tab, setTab] = useState<TabKey>("assignment");
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([api.get<Detail>(`/api/assessments/${id}`), api.get<CalcState>(`/api/assessments/${id}/calculation`)]);
      setDetail(d);
      setCalc(c);
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);

  useEffect(() => {
    const fromHash = () => {
      const h = location.hash.replace("#", "") as TabKey;
      if (ALL_TABS.includes(h)) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    reload();
    return () => window.removeEventListener("hashchange", fromHash);
  }, [reload]);

  const checklist = useMemo(() => (calc ? buildChecklist(calc.issues, !!calc.result) : null), [calc]);

  const go = (t: TabKey, field?: string) => {
    setTab(t);
    setFocus(field ?? null);
    history.replaceState(null, "", `#${t}`);
    if (field) focusField(field);
    else window.scrollTo({ top: 0 });
  };

  if (error) return <Notice tone="err" title="Не удалось открыть оценку">{error}</Notice>;
  if (!detail) return <PageSkeleton />;

  const p = detail.property;
  const states = stepStates(detail, calc, checklist);
  const props: WsProps = { detail, calc, checklist, reload, go, focus };
  const r = calc?.result;
  const address = (p.address as string) || "Адрес не указан";

  return (
    <div className="mx-auto max-w-[1360px]">
      <nav className="mb-3 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label="Навигация">
        <Link href="/app" className="hover:text-ink">Оценки</Link>
        <Icon name="chevronRight" size={12} />
        <span className="text-zinc-700">№ {detail.number}</span>
      </nav>

      <header className="card mb-4 overflow-hidden">
        <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.01em] text-ink">
                <span className="text-muted">{(p.objectType as string) || "Квартира"} — </span>{address}
              </h1>
              <StatusBadge status={detail.status} />
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
              {[
                ["Кадастровый номер", (p.cadastralNumber as string) || "—"],
                ["Площадь", p.area ? `${fmtNumber(p.area as string, 2, true)} м²` : "—"],
                ["Дата оценки", fmtDate(detail.valuationDate)],
                ["№ отчёта", detail.number],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-1.5"><dt className="text-muted">{k}</dt><dd className="num text-zinc-800">{v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="flex shrink-0 items-center gap-5">
            <div className="text-left lg:text-right">
              <div className="text-[11.5px] uppercase tracking-[0.04em] text-muted">Рыночная стоимость</div>
              <div className="num text-[22px] font-semibold leading-tight text-ink">{r ? `${fmtNumber(r.finalValue, 0)} ₽` : "—"}</div>
              <div className="num text-[12px] text-muted">{r ? `${fmtNumber(r.finalUnitPrice, 0)} ₽/м²` : "расчёт не выполнен"}</div>
            </div>
            <button className="btn btn-secondary" onClick={() => go("history")} title="История изменений"><Icon name="history" size={15} /><span className="hidden sm:inline">История</span></button>
          </div>
        </div>

        <ol className="flex overflow-x-auto border-t border-line bg-canvas/60 px-2" aria-label="Этапы оценки">
          {STEPS.map(([k, l], i) => {
            const active = tab === k;
            const s = states[k];
            return (
              <li key={k} className="flex shrink-0 items-center">
                <button
                  onClick={() => go(k)}
                  aria-current={active ? "step" : undefined}
                  className={`relative flex items-center gap-2 px-3 py-3 text-[13px] transition ${active ? "font-semibold text-ink" : "text-zinc-600 hover:text-ink"}`}
                >
                  <StepIcon state={s} index={i} active={active} />
                  {l}
                  {k === "comparables" && <span className="num text-[11.5px] font-normal text-muted">{detail.comparables.filter((c) => c.included).length}</span>}
                  {active && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-brand" />}
                </button>
                {i < STEPS.length - 1 && <Icon name="chevronRight" size={12} className="text-zinc-300" />}
              </li>
            );
          })}
        </ol>
      </header>

      {tab === "assignment" && <AssignmentTab {...props} />}
      {tab === "property" && <PropertyTab {...props} />}
      {tab === "comparables" && <ComparablesTab {...props} />}
      {tab === "adjustments" && <AdjustmentsTab {...props} />}
      {tab === "calculation" && <CalculationTab {...props} />}
      {tab === "checks" && <ChecksTab {...props} />}
      {tab === "report" && <ReportTab {...props} />}
      {tab === "history" && <HistoryTab {...props} />}
    </div>
  );
}
