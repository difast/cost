"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate } from "@/core/format";

interface Src { id: string; code: string; name: string; edition: string; publisher: string | null; actualDate: string | null; licenseType: string; isDemo: boolean; editable: boolean; _count: { factors: number; assessments: number } }

const LICENSE: Record<string, string> = { own: "собственный", licensed: "лицензированный", public: "открытый источник", demo: "демонстрационный" };

export function DirectoryList() {
  const [list, setList] = useState<Src[] | null>(null);
  const [cloneFrom, setCloneFrom] = useState<Src | null>(null);
  const [form, setForm] = useState({ name: "", edition: "", publisher: "", actualDate: "", licenseType: "own", licenseNote: "" });
  const [error, setError] = useState<string | null>(null);
  const load = () => api.get<Src[]>("/api/directory").then(setList);
  useEffect(() => {
    load();
  }, []);

  async function clone(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post<{ id: string }>("/api/directory", { fromId: cloneFrom!.id, ...form });
      location.href = `/app/directory/${r.id}`;
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Справочник корректировок</h1>
        <p className="text-muted">Показатель → коэффициент → диапазон → источник → редакция → дата актуальности. Редакции неизменяемы после использования: старые оценки всегда пересчитываются на своих коэффициентах.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Справочник</th><th>Редакция</th><th>Издатель</th><th>Актуален на</th><th>Лицензия</th><th className="text-right">Показателей</th><th className="text-right">Оценок</th><th></th></tr></thead>
          <tbody>
            {list?.map((s) => (
              <tr key={s.id}>
                <td><Link className="font-medium text-brand hover:underline" href={`/app/directory/${s.id}`}>{s.name}</Link>{s.isDemo && <span className="badge ml-2 bg-amber-50 text-warn">демо</span>}{s.editable && <span className="badge ml-2 bg-brand-soft text-brand">мой</span>}</td>
                <td className="num">{s.edition}</td>
                <td>{s.publisher ?? "—"}</td>
                <td className="num">{fmtDate(s.actualDate)}</td>
                <td>{LICENSE[s.licenseType] ?? s.licenseType}</td>
                <td className="num text-right">{s._count.factors}</td>
                <td className="num text-right">{s._count.assessments}</td>
                <td className="text-right"><button className="btn btn-secondary" onClick={() => { setCloneFrom(s); setForm({ ...form, name: s.isDemo ? "Мой справочник корректировок" : s.name, edition: "" }); }}>Новая редакция</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cloneFrom && (
        <form onSubmit={clone} className="card space-y-3 p-4">
          <div className="card-t">Новая редакция на основе «{cloneFrom.name}», ред. {cloneFrom.edition}</div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2"><label className="label">Название</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Номер редакции</label><input className="input" required placeholder="2026.2" value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })} /></div>
            <div><label className="label">Издатель / автор</label><input className="input" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} /></div>
            <div><label className="label">Дата актуальности</label><input className="input" type="date" value={form.actualDate} onChange={(e) => setForm({ ...form, actualDate: e.target.value })} /></div>
            <div><label className="label">Тип лицензии</label>
              <select className="input" value={form.licenseType} onChange={(e) => setForm({ ...form, licenseType: e.target.value })}>
                <option value="own">Собственные исследования</option><option value="licensed">Лицензированный справочник</option><option value="public">Открытый источник</option>
              </select>
            </div>
            <div className="md:col-span-3"><label className="label">Сведения о лицензии / источнике</label><input className="input" value={form.licenseNote} onChange={(e) => setForm({ ...form, licenseNote: e.target.value })} placeholder="Договор, издание, таблица, страница" /></div>
          </div>
          {error && <div className="text-err">{error}</div>}
          <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => setCloneFrom(null)}>Отмена</button><button className="btn btn-primary">Создать редакцию</button></div>
        </form>
      )}
    </div>
  );
}
