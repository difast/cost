"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, EmptyState, Skeleton, type Tone } from "@/components/ui/kit";
import type { WsProps } from "./Workspace";

interface Ev { id: string; action: string; entity: string; summary: string; diff: unknown; createdAt: string; user: { email: string; name: string | null } | null }

const ACTIONS: Record<string, [string, Tone]> = {
  create: ["Создание", "brand"], update: ["Изменение", "neutral"], delete: ["Удаление", "err"],
  calculate: ["Расчёт", "ok"], report: ["Отчёт", "ok"], import: ["Импорт", "info"],
};

function DiffView({ diff }: { diff: unknown }) {
  if (!diff || typeof diff !== "object") return null;
  const entries = Object.entries(diff as Record<string, unknown>);
  const isPairs = !Array.isArray(diff) && entries.every(([, v]) => Array.isArray(v) && v.length === 2);
  if (!isPairs) return <pre className="mt-2 overflow-x-auto rounded-md bg-canvas p-2.5 text-[11.5px] text-zinc-700">{JSON.stringify(diff, null, 1)}</pre>;
  return (
    <table className="mt-2 w-full max-w-2xl text-[12px]">
      <tbody>
        {entries.map(([k, v]) => {
          const [a, b] = v as [unknown, unknown];
          return (
            <tr key={k} className="border-b border-line/60 last:border-0">
              <td className="w-40 py-1 pr-3 text-muted">{k}</td>
              <td className="py-1 pr-3 text-err line-through decoration-err/40">{a === null ? "∅" : String(a).slice(0, 100)}</td>
              <td className="py-1 text-ok">{b === null ? "∅" : String(b).slice(0, 100)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function HistoryTab({ detail }: WsProps) {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    api.get<Ev[]>(`/api/assessments/${detail.id}/history`).then(setEvents);
  }, [detail.id]);
  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[14px] font-semibold">История изменений</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Кто, когда и что изменил в оценке. Нажмите на событие, чтобы увидеть «было → стало».</p>
        </div>
        {events && <span className="num text-[12.5px] text-muted">{events.length} событий</span>}
      </header>
      {!events ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : events.length === 0 ? (
        <EmptyState icon="history" title="Событий пока нет" />
      ) : (
        <ol className="divide-y divide-line">
          {events.map((e) => {
            const [label, tone] = ACTIONS[e.action] ?? [e.action, "neutral" as Tone];
            const hasDiff = !!e.diff;
            return (
              <li key={e.id} className="px-4 py-2.5">
                <button className={`flex w-full items-start gap-3 text-left ${hasDiff ? "cursor-pointer" : "cursor-default"}`} onClick={() => hasDiff && setOpen(open === e.id ? null : e.id)}>
                  <span className="num w-[132px] shrink-0 pt-px text-[12px] text-muted">{new Date(e.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="w-[86px] shrink-0"><Badge tone={tone}>{label}</Badge></span>
                  <span className="min-w-0 flex-1 text-[13px] text-ink">{e.summary}</span>
                  <span className="hidden shrink-0 text-[12px] text-muted sm:block">{e.user?.name || e.user?.email}</span>
                </button>
                {open === e.id && <div className="pl-0 sm:pl-[230px]"><DiffView diff={e.diff} /></div>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
