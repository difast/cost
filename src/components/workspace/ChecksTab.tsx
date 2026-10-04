"use client";

import Link from "next/link";
import { useState } from "react";
import type { ChecklistItem } from "@/core/checks/catalog";
import { Icon } from "@/components/ui/Icon";
import { Notice, Segmented, Stat } from "@/components/ui/kit";
import type { WsProps, TabKey } from "./Workspace";

const GROUPS: Array<{ step: ChecklistItem["step"]; title: string; tab?: TabKey; href?: string }> = [
  { step: "assignment", title: "Задание и тексты", tab: "assignment" },
  { step: "property", title: "Объект оценки", tab: "property" },
  { step: "comparables", title: "Аналоги", tab: "comparables" },
  { step: "adjustments", title: "Корректировки", tab: "adjustments" },
  { step: "calculation", title: "Расчёт", tab: "calculation" },
  { step: "appraiser", title: "Оценщик", href: "/app/profile" },
];

function StatusIcon({ status }: { status: ChecklistItem["status"] }) {
  if (status === "passed") return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok"><Icon name="check" size={12} strokeWidth={2.6} /></span>;
  if (status === "error") return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-err text-white"><Icon name="x" size={11} strokeWidth={2.6} /></span>;
  if (status === "warning") return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warn text-[11px] font-bold text-white">!</span>;
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-subtle text-muted"><Icon name="clock" size={12} /></span>;
}

export function ChecksTab({ calc, checklist, go }: WsProps) {
  const [filter, setFilter] = useState<"all" | "problems">("problems");
  if (!calc || !checklist) return null;
  const cl = checklist;
  const show = (i: ChecklistItem) => filter === "all" || i.status === "error" || i.status === "warning";
  const problems = cl.errors + cl.warnings;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Пройдено" value={`${cl.passed} / ${cl.total}`} tone="ok" />
        <Stat label="Требует внимания" value={cl.warnings} tone={cl.warnings ? "warn" : undefined} hint="Не блокирует отчёт" />
        <Stat label="Ошибки" value={cl.errors} tone={cl.errors ? "err" : undefined} hint="Блокируют формирование отчёта" />
        <div className={`card flex flex-col justify-center px-4 py-3 ${calc.canGenerate ? "border-ok/30" : "border-err/30"}`}>
          <span className="text-[12px] text-muted">Отчёт</span>
          <span className={`mt-1 flex items-center gap-1.5 text-[15px] font-semibold ${calc.canGenerate ? "text-ok" : "text-err"}`}>
            <Icon name={calc.canGenerate ? "checkCircle" : "error"} size={17} />
            {calc.canGenerate ? "Можно формировать" : "Заблокирован"}
          </span>
          {calc.canGenerate && <button className="mt-1.5 text-left text-[12.5px] text-brand hover:underline" onClick={() => go("report")}>Перейти к отчёту →</button>}
        </div>
      </div>

      <section className="card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">Контроль качества оценки</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">Проверки выполняются автоматически при каждом изменении данных</p>
          </div>
          <Segmented size="sm" value={filter} onChange={setFilter} options={[["problems", `Замечания · ${problems}`], ["all", `Все проверки · ${cl.total}`]]} />
        </header>

        {filter === "problems" && problems === 0 ? (
          <div className="flex items-center gap-3 px-4 py-8">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ok-soft text-ok"><Icon name="check" size={18} strokeWidth={2.4} /></span>
            <div>
              <div className="font-medium text-ink">Замечаний нет</div>
              <div className="text-[13px] text-muted">Все {cl.passed} проверок пройдены{cl.pending ? `, ещё ${cl.pending} будут выполнены после расчёта` : ""}.</div>
            </div>
            <button className="btn btn-secondary btn-sm ml-auto" onClick={() => setFilter("all")}>Показать все проверки</button>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {GROUPS.map((g) => {
              const items = cl.items.filter((i) => i.step === g.step && show(i));
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
                              <>
                                <ul className="mt-1 space-y-0.5 text-[13px] text-zinc-700">
                                  {item.issues.map((is, k) => (
                                    <li key={k} className="flex gap-1.5"><span className={is.severity === "error" ? "text-err" : "text-warn"}>•</span>{is.message}</li>
                                  ))}
                                </ul>
                                <div className="mt-1 text-[12px] text-muted">Что проверяется: {item.hint}</div>
                              </>
                            )}
                          </div>
                          {(item.status === "error" || item.status === "warning") &&
                            (g.href ? (
                              <Link href={g.href} className="btn btn-secondary btn-sm shrink-0">Исправить <Icon name="arrowRight" size={13} /></Link>
                            ) : (
                              <button className="btn btn-secondary btn-sm shrink-0" onClick={() => go(g.tab!)}>Исправить <Icon name="arrowRight" size={13} /></button>
                            ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        {cl.other.length > 0 && (
          <div className="border-t border-line p-4"><Notice tone="warn" title="Прочие замечания">{cl.other.map((i, k) => <div key={k}>{i.message}</div>)}</Notice></div>
        )}
      </section>
    </div>
  );
}
