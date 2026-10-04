"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate, fmtNumber } from "@/core/format";
import { Icon } from "@/components/ui/Icon";
import { ChecksMeter, EmptyState, Modal, Notice, PageHeader, SearchInput, Skeleton, Stat, StatusBadge, ASSESSMENT_STATUS } from "@/components/ui/kit";

interface Row {
  id: string;
  number: string;
  status: string;
  valuationDate: string | null;
  updatedAt: string;
  customerName: string | null;
  approach: string;
  property: { address: string | null; cadastralNumber: string | null; area: string | null; objectType: string | null; rooms: number | null } | null;
  checks: { passed: number; total: number; errors: number; warnings: number; finalValue: string | null } | null;
  lastVersion: { versionNumber: number; finalValue: string | null } | null;
  _count: { comparables: number; reports: number };
}

type Filter = "all" | "active" | "attention" | "completed";
type Sort = "updated" | "valuation" | "address" | "number";

const ACTIVE = new Set(["draft", "in_progress", "review"]);
const needsAttention = (r: Row) => ACTIVE.has(r.status) && !!r.checks && (r.checks.errors > 0 || r.checks.warnings > 0);

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`;
  return fmtDate(iso);
}

function NewAssessmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCad = /^\d{2}:\d{2}:\d{6,7}:\d+$/.test(query.trim());
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ id: string }>("/api/assessments", { query });
      location.href = `/app/assessments/${r.id}`;
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Новая оценка" description="Квартира · сравнительный подход" size="sm">
      <form onSubmit={create} className="space-y-3">
        <div>
          <label className="label" htmlFor="new-q">Адрес или кадастровый номер</label>
          <input id="new-q" autoFocus className="input py-2 text-[14px]" placeholder="г. Москва, ул. Ленина, д. 25, кв. 10" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="mt-1.5 text-[12px] text-muted">
            {query.trim() ? (isCad ? "Распознан кадастровый номер" : "Будет сохранён как адрес объекта") : "Например, 77:01:0001001:1234. Данные можно дополнить позже — загрузкой выписки ЕГРН."}
          </div>
        </div>
        {error && <Notice tone="err">{error}</Notice>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Создание…" : "Создать оценку"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function AssessmentList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("new")) setCreating(true);
    api.get<Row[]>("/api/assessments").then(setRows).catch((e) => setError(errorText(e)));
  }, []);

  const counts = useMemo(() => {
    const r = rows ?? [];
    return {
      all: r.filter((x) => x.status !== "archived").length,
      active: r.filter((x) => ACTIVE.has(x.status)).length,
      attention: r.filter(needsAttention).length,
      completed: r.filter((x) => x.status === "completed").length,
    };
  }, [rows]);

  const view = useMemo(() => {
    let r = rows ?? [];
    if (filter === "all" && !status) r = r.filter((x) => x.status !== "archived");
    if (filter === "active") r = r.filter((x) => ACTIVE.has(x.status));
    if (filter === "attention") r = r.filter(needsAttention);
    if (filter === "completed") r = r.filter((x) => x.status === "completed");
    if (status) r = r.filter((x) => x.status === status);
    const s = q.trim().toLowerCase();
    if (s) r = r.filter((x) => [x.number, x.customerName, x.property?.address, x.property?.cadastralNumber].some((v) => v?.toLowerCase().includes(s)));
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      valuation: (a, b) => (b.valuationDate ?? "").localeCompare(a.valuationDate ?? ""),
      address: (a, b) => (a.property?.address ?? "яя").localeCompare(b.property?.address ?? "яя", "ru"),
      number: (a, b) => b.number.localeCompare(a.number, "ru", { numeric: true }),
    };
    return [...r].sort(by[sort]);
  }, [rows, filter, status, q, sort]);

  const filtersActive = !!q || !!status || filter !== "all";

  return (
    <div className="mx-auto max-w-[1360px]">
      <PageHeader
        title="Оценки"
        description="Ваши объекты и текущие расчёты"
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} />Новая оценка</button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Все оценки" value={rows ? counts.all : "—"} active={filter === "all" && !status} onClick={() => { setFilter("all"); setStatus(""); }} />
        <Stat label="В работе" value={rows ? counts.active : "—"} active={filter === "active"} onClick={() => { setFilter("active"); setStatus(""); }} />
        <Stat label="Требуют внимания" value={rows ? counts.attention : "—"} tone={counts.attention ? "warn" : undefined} hint="Есть ошибки или предупреждения проверок" active={filter === "attention"} onClick={() => { setFilter("attention"); setStatus(""); }} />
        <Stat label="Завершены" value={rows ? counts.completed : "—"} active={filter === "completed"} onClick={() => { setFilter("completed"); setStatus(""); }} />
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-3 md:flex-row md:items-center">
          <SearchInput className="md:w-80" value={q} onChange={setQ} placeholder="Поиск: адрес, номер, заказчик, кадастровый номер" />
          <div className="flex flex-wrap gap-2 md:ml-auto">
            <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setFilter("all"); }} aria-label="Статус">
              <option value="">Все статусы</option>
              {Object.entries(ASSESSMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Сортировка">
              <option value="updated">Сначала недавно изменённые</option>
              <option value="valuation">По дате оценки</option>
              <option value="number">По номеру</option>
              <option value="address">По адресу</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="p-4"><Notice tone="err" title="Не удалось загрузить оценки">{error}</Notice></div>
        ) : !rows ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : view.length === 0 ? (
          filtersActive ? (
            <EmptyState icon="search" title="Ничего не найдено" action={<button className="btn btn-secondary" onClick={() => { setQ(""); setStatus(""); setFilter("all"); }}>Сбросить фильтры</button>}>
              Измените условия поиска или фильтры.
            </EmptyState>
          ) : (
            <EmptyState title="Пока нет оценок" action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} />Создать оценку</button>}>
              Создайте первую оценку, чтобы начать работу: достаточно адреса или кадастрового номера квартиры.
            </EmptyState>
          )
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="tbl tbl-hover min-w-[900px]">
                <thead>
                  <tr>
                    <th>Объект</th>
                    <th>Тип</th>
                    <th>Дата оценки</th>
                    <th>Статус</th>
                    <th>Проверки</th>
                    <th className="hidden text-right xl:table-cell">Стоимость, ₽</th>
                    <th>Изменено</th>
                    <th className="w-0"></th>
                  </tr>
                </thead>
                <tbody>
                  {view.map((r) => (
                    <tr key={r.id} className="cursor-pointer" onClick={() => (location.href = `/app/assessments/${r.id}`)}>
                      <td>
                        <Link href={`/app/assessments/${r.id}`} className="block max-w-[340px] truncate font-medium text-ink hover:text-brand" onClick={(e) => e.stopPropagation()}>
                          {r.property?.address || <span className="text-muted">Адрес не указан</span>}
                        </Link>
                        <div className="num mt-0.5 max-w-[340px] truncate text-[12px] text-muted">
                          № {r.number}{r.property?.cadastralNumber ? ` · ${r.property.cadastralNumber}` : ""}{r.customerName ? ` · ${r.customerName}` : ""}
                        </div>
                      </td>
                      <td className="text-[13px] text-zinc-700">
                        {r.property?.objectType ?? "Квартира"}
                        <div className="num text-[12px] text-muted">{r.property?.area ? `${fmtNumber(r.property.area, 2, true)} м²` : "площадь —"}{r.property?.rooms ? ` · ${r.property.rooms}-комн.` : ""}</div>
                      </td>
                      <td className="num text-zinc-700">{fmtDate(r.valuationDate)}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>{r.checks ? <ChecksMeter {...r.checks} /> : <span className="text-muted">—</span>}</td>
                      <td className="num hidden text-right font-medium xl:table-cell">{r.checks?.finalValue ? fmtNumber(r.checks.finalValue, 0) : <span className="font-normal text-muted">—</span>}</td>
                      <td className="text-[12.5px] text-muted" title={new Date(r.updatedAt).toLocaleString("ru-RU")}>{relTime(r.updatedAt)}</td>
                      <td className="text-right"><Link href={`/app/assessments/${r.id}`} onClick={(e) => e.stopPropagation()} className="btn btn-secondary btn-sm">Открыть</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {view.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/assessments/${r.id}`} className="block px-4 py-3 active:bg-canvas">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-ink">{r.property?.address || "Адрес не указан"}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="num mt-1 text-[12px] text-muted">№ {r.number} · {fmtDate(r.valuationDate)}{r.property?.area ? ` · ${fmtNumber(r.property.area, 2, true)} м²` : ""}</div>
                    <div className="mt-2 flex items-center justify-between">
                      {r.checks ? <ChecksMeter {...r.checks} /> : <span />}
                      <span className="num text-[13px] font-medium">{r.checks?.finalValue ? `${fmtNumber(r.checks.finalValue, 0)} ₽` : ""}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-4 py-2 text-[12px] text-muted">Показано: {view.length}</div>
          </>
        )}
      </section>
      <NewAssessmentModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
