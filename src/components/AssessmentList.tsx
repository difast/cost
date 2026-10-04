"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/api";
import { STATUS } from "@/lib/labels";
import { fmtDate, fmtNumber } from "@/core/format";

interface Row {
  id: string;
  number: string;
  status: string;
  valuationDate: string | null;
  updatedAt: string;
  customerName: string | null;
  property: { address: string | null; cadastralNumber: string | null; area: string | null } | null;
  lastVersion: { versionNumber: number; finalValue: string | null } | null;
  _count: { comparables: number; reports: number };
}

export function AssessmentList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get<Row[]>(`/api/assessments${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setRows).catch((e) => setError(errorText(e)));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

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
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Оценки</h1>
        <p className="text-muted">Квартиры · сравнительный подход</p>
      </div>

      <form onSubmit={create} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label">Новая оценка: адрес или кадастровый номер квартиры</label>
          <input className="input py-2 text-base" placeholder="г. Москва, ул. Тверская, д. 1, кв. 10  или  77:01:0001001:1234" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="btn btn-primary py-2" disabled={busy}>{busy ? "Создание…" : "Создать оценку"}</button>
      </form>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-err">{error}</div>}

      <div className="card overflow-hidden">
        <div className="card-h">
          <div className="card-t">Мои оценки</div>
          <input className="input max-w-xs" placeholder="Поиск: номер, адрес, заказчик, КН" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!rows ? (
          <div className="p-6 text-muted">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted">Оценок пока нет. Введите адрес или кадастровый номер выше, чтобы начать.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Объект</th>
                  <th>Заказчик</th>
                  <th>Дата оценки</th>
                  <th className="text-right">Аналоги</th>
                  <th className="text-right">Стоимость, ₽</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => (location.href = `/app/assessments/${r.id}`)}>
                    <td className="num font-medium"><Link href={`/app/assessments/${r.id}`} className="text-brand">{r.number}</Link></td>
                    <td>
                      <div>{r.property?.address ?? <span className="text-muted">Адрес не указан</span>}</div>
                      <div className="num text-xs text-muted">{r.property?.cadastralNumber ?? "КН —"}{r.property?.area ? ` · ${fmtNumber(r.property.area, 2, true)} м²` : ""}</div>
                    </td>
                    <td>{r.customerName ?? "—"}</td>
                    <td className="num">{fmtDate(r.valuationDate)}</td>
                    <td className="num text-right">{r._count.comparables}</td>
                    <td className="num text-right">{r.lastVersion?.finalValue ? fmtNumber(r.lastVersion.finalValue, 0) : "—"}</td>
                    <td><span className={`badge ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label ?? r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
