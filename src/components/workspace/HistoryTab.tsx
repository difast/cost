"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WsProps } from "./Workspace";

interface Ev { id: string; action: string; entity: string; summary: string; diff: unknown; createdAt: string; user: { email: string; name: string | null } | null }

const ACTIONS: Record<string, string> = { create: "Создание", update: "Изменение", delete: "Удаление", calculate: "Расчёт", report: "Отчёт", import: "Импорт" };

function DiffView({ diff }: { diff: unknown }) {
  if (!diff || typeof diff !== "object") return null;
  if (Array.isArray(diff)) return <pre className="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 text-[11px]">{JSON.stringify(diff, null, 1)}</pre>;
  const entries = Object.entries(diff as Record<string, unknown>);
  const isPairs = entries.every(([, v]) => Array.isArray(v) && v.length === 2);
  if (!isPairs) return <pre className="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 text-[11px]">{JSON.stringify(diff, null, 1)}</pre>;
  return (
    <table className="mt-1 text-[11px]">
      <tbody>
        {entries.map(([k, v]) => {
          const [a, b] = v as [unknown, unknown];
          return (
            <tr key={k}>
              <td className="pr-3 text-muted">{k}</td>
              <td className="pr-2 text-err line-through">{a === null ? "∅" : String(a).slice(0, 80)}</td>
              <td className="text-ok">{b === null ? "∅" : String(b).slice(0, 80)}</td>
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
  if (!events) return <div className="text-muted">Загрузка…</div>;
  return (
    <div className="card">
      <div className="card-h"><div className="card-t">История изменений</div><span className="text-xs text-muted">{events.length} событий</span></div>
      <ul className="divide-y divide-zinc-100">
        {events.map((e) => (
          <li key={e.id} className="px-4 py-2.5">
            <div className="flex cursor-pointer items-start gap-3" onClick={() => setOpen(open === e.id ? null : e.id)}>
              <span className="num w-36 shrink-0 text-xs text-muted">{new Date(e.createdAt).toLocaleString("ru-RU")}</span>
              <span className="badge shrink-0 bg-zinc-100 text-zinc-600">{ACTIONS[e.action] ?? e.action}</span>
              <span className="flex-1">{e.summary}</span>
              <span className="shrink-0 text-xs text-muted">{e.user?.name || e.user?.email}</span>
            </div>
            {open === e.id && <div className="ml-40"><DiffView diff={e.diff} /></div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
