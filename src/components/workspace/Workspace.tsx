"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/lib/api";
import { STATUS } from "@/lib/labels";
import { fmtDate, fmtNumber } from "@/core/format";
import type { CalcState, Detail } from "./types";
import { AssignmentTab } from "./AssignmentTab";
import { PropertyTab } from "./PropertyTab";
import { ComparablesTab } from "./ComparablesTab";
import { AdjustmentsTab } from "./AdjustmentsTab";
import { CalculationTab } from "./CalculationTab";
import { ChecksTab } from "./ChecksTab";
import { ReportTab } from "./ReportTab";
import { HistoryTab } from "./HistoryTab";

const TABS = [
  ["assignment", "Задание"],
  ["property", "Объект"],
  ["comparables", "Аналоги"],
  ["adjustments", "Корректировки"],
  ["calculation", "Расчёт"],
  ["checks", "Проверки"],
  ["report", "Отчёт"],
  ["history", "История"],
] as const;
export type TabKey = (typeof TABS)[number][0];

export interface WsProps {
  detail: Detail;
  calc: CalcState | null;
  reload: () => Promise<void>;
  go: (t: TabKey) => void;
}

export function Workspace({ id }: { id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [calc, setCalc] = useState<CalcState | null>(null);
  const [tab, setTab] = useState<TabKey>("assignment");
  const [error, setError] = useState<string | null>(null);

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
      if (TABS.some(([k]) => k === h)) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    reload();
    return () => window.removeEventListener("hashchange", fromHash);
  }, [reload]);

  const go = (t: TabKey) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0 });
  };

  if (error) return <div className="rounded-md bg-red-50 p-4 text-err">{error}</div>;
  if (!detail) return <div className="text-muted">Загрузка оценки…</div>;

  const p = detail.property;
  const props: WsProps = { detail, calc, reload, go };
  const included = detail.comparables.filter((c) => c.included).length;
  const counts: Partial<Record<TabKey, React.ReactNode>> = {
    comparables: included,
    checks: calc ? (calc.errors ? <span className="text-err">{calc.errors}</span> : calc.warnings ? <span className="text-warn">{calc.warnings}</span> : "✓") : null,
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-3 text-xs text-muted"><Link href="/app" className="hover:text-brand">Оценки</Link> / № {detail.number}</div>
      <div className="card mb-4 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{(p.address as string) || "Адрес не указан"}</h1>
            <span className={`badge ${STATUS[detail.status]?.cls}`}>{STATUS[detail.status]?.label}</span>
          </div>
          <div className="mt-0.5 text-xs tabular-nums text-muted">
            № {detail.number} · КН {(p.cadastralNumber as string) || "—"} · {p.area ? `${fmtNumber(p.area as string, 2, true)} м²` : "площадь —"} · дата оценки {fmtDate(detail.valuationDate)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <div className="text-right">
            <div className="text-xs text-muted">Рыночная стоимость</div>
            <div className="num text-lg font-semibold">{calc?.result ? `${fmtNumber(calc.result.finalValue, 0)} ₽` : "—"}</div>
            <div className="num text-xs text-muted">{calc?.result ? `${fmtNumber(calc.result.finalUnitPrice, 0)} ₽/м²` : ""}</div>
          </div>
          <button className="btn btn-primary" onClick={() => go(calc?.errors ? "checks" : "report")}>
            {calc?.errors ? `Ошибок: ${calc.errors}` : "Сформировать отчёт"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => go(k)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${tab === k ? "border-brand font-medium text-brand" : "border-transparent text-zinc-600 hover:text-ink"}`}
          >
            {l}
            {counts[k] !== undefined && counts[k] !== null && <span className="badge bg-zinc-100 text-zinc-600">{counts[k]}</span>}
          </button>
        ))}
      </div>

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
