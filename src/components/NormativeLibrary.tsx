"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate } from "@/core/format";
import { Icon } from "@/components/ui/Icon";
import { Badge, EmptyState, Notice, PageHeader, SearchInput, Skeleton } from "@/components/ui/kit";

interface Doc { id: string; kind: string; code: string | null; title: string; issuer: string | null; adoptedAt: string | null; effectiveFrom: string | null; status: string; url: string | null; summary: string | null; tags: string[]; revision: number; updatedAt: string }

const CATEGORIES: Array<{ key: string; label: string; kinds: string[] }> = [
  { key: "all", label: "Все документы", kinds: [] },
  { key: "law", label: "Федеральное законодательство", kinds: ["law"] },
  { key: "fso", label: "ФСО", kinds: ["fso"] },
  { key: "methodology", label: "Методические документы", kinds: ["methodology"] },
  { key: "sro", label: "Стандарты СРО", kinds: ["sro_standard"] },
  { key: "other", label: "Другие материалы", kinds: ["court", "literature"] },
];
const KIND_LABEL: Record<string, string> = { law: "Федеральный закон", fso: "Федеральный стандарт оценки", methodology: "Методический документ", sro_standard: "Стандарт СРО", court: "Судебная практика", literature: "Литература" };

export function NormativeLibrary() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get<Doc[]>(`/api/normative${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setDocs).catch((e) => setError(errorText(e)));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.key, (docs ?? []).filter((d) => !c.kinds.length || c.kinds.includes(d.kind)).length])), [docs]);
  const current = CATEGORIES.find((c) => c.key === cat)!;
  const view = (docs ?? []).filter((d) => !current.kinds.length || current.kinds.includes(d.kind));

  return (
    <div className="mx-auto max-w-[1360px]">
      <PageHeader title="Нормативная база" description="Законы, федеральные стандарты оценки, стандарты СРО и методические материалы" />
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="card h-fit p-2" aria-label="Категории">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] transition ${cat === c.key ? "bg-brand-soft font-medium text-brand" : "text-zinc-700 hover:bg-subtle"}`}
            >
              {c.label}
              <span className="num text-[12px] text-muted">{docs ? counts[c.key] : ""}</span>
            </button>
          ))}
        </nav>
        <section className="card overflow-hidden">
          <div className="border-b border-line p-3">
            <SearchInput value={q} onChange={setQ} placeholder="Поиск по названию, номеру, содержанию и тегам" />
          </div>
          {error ? (
            <div className="p-4"><Notice tone="err">{error}</Notice></div>
          ) : !docs ? (
            <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : view.length === 0 ? (
            <EmptyState icon="book" title={q ? "Ничего не найдено" : "В этой категории пока нет документов"}>
              {q ? "Попробуйте другой запрос или выберите другую категорию." : "Библиотека пополняется без изменения программы — документы добавляет администратор."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {view.map((d) => (
                <li key={d.id}>
                  <div className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-start">
                    <Icon name="doc" size={18} className="mt-0.5 hidden text-muted md:block" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-ink">{d.code && <span className="mr-2 text-brand">{d.code}</span>}{d.title}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted">
                        <span>{KIND_LABEL[d.kind] ?? d.kind}</span>
                        {d.adoptedAt && <span className="num">от {fmtDate(d.adoptedAt)}</span>}
                        {d.issuer && <span>{d.issuer}</span>}
                      </div>
                      {open === d.id && d.summary && <p className="mt-2 max-w-3xl text-[13px] text-zinc-700">{d.summary}</p>}
                      {open === d.id && d.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{d.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge tone={d.status === "active" ? "ok" : "neutral"}>{d.status === "active" ? "Действует" : d.status === "repealed" ? "Утратил силу" : "Проект"}</Badge>
                      {(d.summary || d.tags.length > 0) && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === d.id ? null : d.id)}>{open === d.id ? "Свернуть" : "Подробнее"}</button>
                      )}
                      {d.url && (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" title="Открыть документ в КонсультантПлюс в новой вкладке"><Icon name="external" size={13} />Открыть источник</a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
