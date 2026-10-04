"use client";

// Контроль качества оценки: все замечания (проверки расчётного ядра + сверка отчёта) с уровнем,
// источником, статусом и переходом к полю. Замечания информируют — отчёт доступен всегда.

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate } from "@/core/format";
import type { Checklist, ChecklistItem } from "@/core/checks/catalog";
import { goLabel, issueTarget } from "@/core/checks/target";
import type { QualityItem, QualityStatus } from "@/core/checks/tracking";
import { Icon } from "@/components/ui/Icon";
import { Badge, Notice, Segmented, Stat, type Tone } from "@/components/ui/kit";
import type { WsProps, TabKey } from "./Workspace";

interface Quality {
  summary: string;
  counts: { errors: number; warnings: number; info: number; fixed: number };
  items: QualityItem[];
  checklist: Checklist;
  hasResult: boolean;
}

const STATUS: Record<QualityStatus, { label: string; tone: Tone }> = {
  error: { label: "Ошибка", tone: "err" },
  warning: { label: "Предупреждение", tone: "warn" },
  info: { label: "Информация", tone: "info" },
  fixed: { label: "Исправлено", tone: "ok" },
};

const GROUPS: Array<{ step: ChecklistItem["step"]; title: string; tab?: TabKey; href?: string }> = [
  { step: "assignment", title: "Задание и тексты", tab: "assignment" },
  { step: "property", title: "Объект оценки", tab: "property" },
  { step: "comparables", title: "Аналоги", tab: "comparables" },
  { step: "adjustments", title: "Корректировки", tab: "adjustments" },
  { step: "calculation", title: "Расчёт", tab: "calculation" },
  { step: "report", title: "Отчёт", tab: "report" },
  { step: "appraiser", title: "Оценщик", href: "/app/profile" },
];

function StatusIcon({ status }: { status: ChecklistItem["status"] }) {
  if (status === "passed") return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok"><Icon name="check" size={12} strokeWidth={2.6} /></span>;
  if (status === "error") return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-err text-white"><Icon name="x" size={11} strokeWidth={2.6} /></span>;
  if (status === "warning") return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warn text-[11px] font-bold text-white">!</span>;
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-subtle text-muted"><Icon name="clock" size={12} /></span>;
}

type Filter = "active" | "error" | "warning" | "info" | "fixed" | "catalog";

export function ChecksTab({ detail, calc, go }: WsProps) {
  const [q, setQ] = useState<Quality | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");

  // перепроверка после каждого сохранения: calc обновляется при reload() вкладок
  useEffect(() => {
    let alive = true;
    api.get<Quality>(`/api/assessments/${detail.id}/quality`).then((r) => alive && setQ(r)).catch((e) => alive && setError(errorText(e)));
    return () => { alive = false; };
  }, [detail.id, calc]);

  if (error && !q) return <Notice tone="err" title="Контроль качества не загружен">{error}</Notice>;
  if (!q) return <div className="card h-72 animate-pulse" />;

  const { counts } = q;
  const active = counts.errors + counts.warnings + counts.info;
  const list = q.items.filter((i) => (filter === "active" ? i.status !== "fixed" : i.status === filter));
  const toggle = (f: Filter) => setFilter(filter === f ? "active" : f);

  const open = (i: QualityItem) => {
    const t = issueTarget(i);
    if (t.tab) go(t.tab, t.field);
  };

  return (
    <div>
      <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-[13.5px] ${counts.errors || counts.warnings ? "border-warn/30 bg-warn-soft" : "border-ok/30 bg-ok-soft"}`}>
        <Icon name={counts.errors || counts.warnings ? "alert" : "checkCircle"} size={17} className={counts.errors || counts.warnings ? "text-warn" : "text-ok"} />
        <span className="min-w-0 flex-1 font-medium text-ink">
          {q.summary}
          <span className="ml-1 font-normal text-zinc-700">Замечания не блокируют работу: отчёт можно открыть, редактировать и выгрузить, а замечания попадут в раздел «Замечания к оценке».</span>
        </span>
        <button className="btn btn-secondary btn-sm" onClick={() => go("report")}>Открыть отчёт <Icon name="arrowRight" size={13} /></button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ошибки" value={counts.errors} tone={counts.errors ? "err" : undefined} hint="Требуют исправления" active={filter === "error"} onClick={() => toggle("error")} />
        <Stat label="Предупреждения" value={counts.warnings} tone={counts.warnings ? "warn" : undefined} hint="Проверьте и подтвердите" active={filter === "warning"} onClick={() => toggle("warning")} />
        <Stat label="Информация" value={counts.info} hint="Для сведения" active={filter === "info"} onClick={() => toggle("info")} />
        <Stat label="Исправлено" value={counts.fixed} tone={counts.fixed ? "ok" : undefined} hint="За последние 14 дней" active={filter === "fixed"} onClick={() => toggle("fixed")} />
      </div>

      <section className="card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">Контроль качества</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">Проверяются задание, объект, аналоги, корректировки, расчёт и соответствие отчёта расчёту — после каждого сохранения</p>
          </div>
          <Segmented
            size="sm"
            value={filter === "catalog" ? "catalog" : filter === "fixed" ? "fixed" : "active"}
            onChange={(v) => setFilter(v as Filter)}
            options={[["active", `Замечания · ${active}`], ["fixed", `Исправлено · ${counts.fixed}`], ["catalog", `Все проверки · ${q.checklist.total}`]]}
          />
        </header>

        {filter === "catalog" ? (
          <Catalog cl={q.checklist} go={go} />
        ) : list.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-8">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ok-soft text-ok"><Icon name="check" size={18} strokeWidth={2.4} /></span>
            <div>
              <div className="font-medium text-ink">{filter === "fixed" ? "Исправленных замечаний пока нет" : "Замечаний нет"}</div>
              <div className="text-[13px] text-muted">
                {filter === "fixed" ? "Здесь появятся замечания, которые пропали после изменения данных." : `Пройдено проверок: ${q.checklist.passed} из ${q.checklist.total}${q.checklist.pending ? `, ещё ${q.checklist.pending} — после расчёта` : ""}.`}
              </div>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((i) => {
              const t = issueTarget(i);
              const st = STATUS[i.status];
              return (
                <li key={i.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
                  <div className="w-[128px] shrink-0"><Badge tone={st.tone}>{st.label}</Badge></div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13.5px] [overflow-wrap:anywhere] ${i.status === "fixed" ? "text-muted line-through decoration-[#c4cbc7]" : "text-ink"}`}>{i.message}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
                      <span>Источник: {t.source}</span>
                      {i.status === "fixed" ? <span>исправлено {fmtDate(i.fixedAt!)}</span> : <span>Уровень: {STATUS[i.severity].label.toLowerCase()}</span>}
                    </div>
                  </div>
                  {i.status !== "fixed" &&
                    (t.href ? (
                      <Link href={t.href} className="btn btn-secondary btn-sm shrink-0 self-start">{goLabel(t)} <Icon name="arrowRight" size={13} /></Link>
                    ) : (
                      <button className="btn btn-secondary btn-sm shrink-0 self-start" onClick={() => open(i)}>{goLabel(t)} <Icon name="arrowRight" size={13} /></button>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Catalog({ cl, go }: { cl: Checklist; go: (t: TabKey, field?: string) => void }) {
  return (
    <div className="divide-y divide-line">
      {GROUPS.map((g) => {
        const items = cl.items.filter((i) => i.step === g.step);
        if (!items.length) return null;
        return (
          <div key={g.step}>
            <div className="bg-canvas/70 px-4 py-1.5 text-[11.5px] font-medium uppercase tracking-[0.04em] text-muted">{g.title}</div>
            <ul>
              {items.map((item) => (
                <li key={item.id} className="border-t border-line/60 px-4 py-2.5 first:border-t-0">
                  <div className="flex items-start gap-3">
                    <StatusIcon status={item.status} />
                    <div className="min-w-0 flex-1">
                      <div className={`text-[13.5px] ${item.status === "passed" || item.status === "pending" ? "text-zinc-700" : "font-medium text-ink"}`}>
                        {item.title}
                        {item.status === "pending" && <span className="ml-2 text-[12px] font-normal text-muted">будет выполнена после расчёта</span>}
                      </div>
                      {(item.status === "error" || item.status === "warning") && (
                        <ul className="mt-1 space-y-0.5 text-[13px] text-zinc-700">
                          {item.issues.map((is, k) => (
                            <li key={k} className="flex gap-1.5 [overflow-wrap:anywhere]"><span className={is.severity === "error" ? "text-err" : "text-warn"}>•</span>{is.message}</li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-0.5 text-[12px] text-muted">Что проверяется: {item.hint}</div>
                    </div>
                    {(item.status === "error" || item.status === "warning") &&
                      (g.href ? (
                        <Link href={g.href} className="btn btn-secondary btn-sm shrink-0">Перейти <Icon name="arrowRight" size={13} /></Link>
                      ) : (
                        <button className="btn btn-secondary btn-sm shrink-0" onClick={() => { const t = issueTarget(item.issues[0]); go(t.tab ?? g.tab!, t.field); }}>Перейти <Icon name="arrowRight" size={13} /></button>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {cl.other.length > 0 && (
        <div className="p-4"><Notice tone="warn" title="Прочие замечания">{cl.other.map((i, k) => <div key={k}>{i.message}</div>)}</Notice></div>
      )}
    </div>
  );
}
