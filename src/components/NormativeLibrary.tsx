"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtDate } from "@/core/format";

interface Doc { id: string; kind: string; code: string | null; title: string; issuer: string | null; adoptedAt: string | null; status: string; url: string | null; summary: string | null; tags: string[]; revision: number; updatedAt: string }

const KINDS: Array<[string, string]> = [["", "Все"], ["law", "Законы"], ["fso", "ФСО"], ["sro_standard", "Стандарты СРО"], ["methodology", "Методические материалы"], ["court", "Судебная практика"], ["literature", "Литература"]];

export function NormativeLibrary() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [docs, setDocs] = useState<Doc[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (kind) sp.set("kind", kind);
      api.get<Doc[]>(`/api/normative?${sp}`).then(setDocs);
    }, 200);
    return () => clearTimeout(t);
  }, [q, kind]);
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Нормативная база</h1>
        <p className="text-muted">Законы, федеральные стандарты оценки, стандарты СРО, методические материалы и судебная практика. Библиотека обновляется без изменения кода.</p>
      </div>
      <div className="card flex flex-col gap-3 p-3 md:flex-row">
        <input className="input flex-1" placeholder="Поиск по названию, номеру, содержанию" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1">
          {KINDS.map(([k, l]) => <button key={k} className={`btn ${kind === k ? "btn-primary" : "btn-ghost"}`} onClick={() => setKind(k)}>{l}</button>)}
        </div>
      </div>
      <div className="space-y-2">
        {docs?.map((d) => (
          <div key={d.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{d.code && <span className="mr-2 text-brand">{d.code}</span>}{d.title}</div>
                <div className="text-xs text-muted">{d.issuer}{d.adoptedAt ? ` · ${fmtDate(d.adoptedAt)}` : ""} · ред. {d.revision}</div>
              </div>
              <span className={`badge shrink-0 ${d.status === "active" ? "bg-green-50 text-ok" : "bg-zinc-100 text-zinc-500"}`}>{d.status === "active" ? "действует" : d.status === "repealed" ? "утратил силу" : "проект"}</span>
            </div>
            {d.summary && <p className="mt-2 text-sm text-zinc-600">{d.summary}</p>}
            <div className="mt-2 flex flex-wrap gap-1">{d.tags.map((t) => <span key={t} className="badge bg-zinc-100 text-zinc-600">{t}</span>)}</div>
            {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-brand hover:underline">Официальный текст →</a>}
          </div>
        ))}
        {docs && !docs.length && <div className="card p-8 text-center text-muted">Ничего не найдено.</div>}
      </div>
    </div>
  );
}
