"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate, fmtPercent } from "@/core/format";

interface Cat { id: string; code: string; label: string; coefficient: string; minCoefficient: string | null; maxCoefficient: string | null }
interface Factor { id: string; code: string; name: string; kind: string; attribute: string | null; stage: number; value: string | null; minValue: string | null; maxValue: string | null; params: Record<string, unknown>; reference: string | null; description: string | null; enabled: boolean; categories: Cat[] }
interface Src { id: string; name: string; edition: string; publisher: string | null; actualDate: string | null; licenseType: string; licenseNote: string | null; isDemo: boolean; editable: boolean; factors: Factor[]; _count: { assessments: number } }

const KIND: Record<string, string> = { discount: "фиксированная скидка", category: "коэффициенты категорий: k(объект)/k(аналог) − 1", power: "степенная функция: (S₀/S_i)^b − 1", manual: "определяется оценщиком" };

function FactorCard({ f, sid, editable, onSaved }: { f: Factor; sid: string; editable: boolean; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [state, setState] = useState({ value: f.value ?? "", minValue: f.minValue ?? "", maxValue: f.maxValue ?? "", reference: f.reference ?? "", enabled: f.enabled, exponent: String(f.params.exponent ?? ""), cats: f.categories.map((c) => ({ id: c.id, coefficient: c.coefficient })) });
  const [error, setError] = useState<string | null>(null);
  async function save() {
    try {
      await api.patch(`/api/directory/${sid}/factors/${f.id}`, {
        value: state.value || null, minValue: state.minValue || null, maxValue: state.maxValue || null,
        reference: state.reference || null, enabled: state.enabled,
        ...(f.kind === "power" ? { exponent: state.exponent } : {}),
        ...(f.kind === "category" ? { categories: state.cats } : {}),
      });
      setEdit(false);
      onSaved();
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <div className={`card p-4 ${f.enabled ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{f.name} <span className="text-xs font-normal text-muted">· {f.stage === 1 ? "1-я группа" : "2-я группа"}</span></div>
          <div className="text-xs text-muted">{KIND[f.kind]}{f.reference ? ` · ${f.reference}` : ""}</div>
          {f.description && <div className="mt-1 text-xs text-muted">{f.description}</div>}
        </div>
        {editable && !edit && <button className="btn btn-ghost" onClick={() => setEdit(true)}>Изменить</button>}
      </div>
      {f.kind === "discount" && <div className="num mt-2">Значение: <b>{f.value ? fmtPercent(f.value) : "—"}</b> · диапазон {f.minValue ? fmtPercent(f.minValue) : "—"} … {f.maxValue ? fmtPercent(f.maxValue) : "—"}</div>}
      {f.kind === "power" && <div className="num mt-2">Показатель степени b = <b>{String(f.params.exponent)}</b></div>}
      {f.kind === "manual" && (f.minValue || f.maxValue) && <div className="num mt-2 text-xs text-muted">Допустимый диапазон: {f.minValue ? fmtPercent(f.minValue) : "—"} … {f.maxValue ? fmtPercent(f.maxValue) : "—"}</div>}
      {f.kind === "category" && (
        <table className="tbl mt-2">
          <thead><tr><th>Категория</th><th className="text-right">Коэффициент</th><th className="text-right">Диапазон</th></tr></thead>
          <tbody>
            {f.categories.map((c, i) => (
              <tr key={c.id}>
                <td>{c.label}</td>
                <td className="num text-right">{edit ? <input className="input num w-24 text-right" value={state.cats[i].coefficient} onChange={(e) => { const cats = [...state.cats]; cats[i] = { ...cats[i], coefficient: e.target.value.replace(",", ".") }; setState({ ...state, cats }); }} /> : c.coefficient}</td>
                <td className="num text-right text-muted">{c.minCoefficient && c.maxCoefficient ? `${c.minCoefficient} … ${c.maxCoefficient}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {edit && (
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {f.kind === "discount" && <div><label className="label">Значение (доля)</label><input className="input num" value={state.value} onChange={(e) => setState({ ...state, value: e.target.value.replace(",", ".") })} /></div>}
          {f.kind === "power" && <div><label className="label">Показатель b</label><input className="input num" value={state.exponent} onChange={(e) => setState({ ...state, exponent: e.target.value.replace(",", ".") })} /></div>}
          <div><label className="label">Мин. (доля)</label><input className="input num" value={state.minValue} onChange={(e) => setState({ ...state, minValue: e.target.value.replace(",", ".") })} /></div>
          <div><label className="label">Макс. (доля)</label><input className="input num" value={state.maxValue} onChange={(e) => setState({ ...state, maxValue: e.target.value.replace(",", ".") })} /></div>
          <div className="md:col-span-2"><label className="label">Ссылка на таблицу/страницу источника</label><input className="input" value={state.reference} onChange={(e) => setState({ ...state, reference: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.enabled} onChange={(e) => setState({ ...state, enabled: e.target.checked })} /> Применять</label>
          {error && <div className="text-err md:col-span-4">{error}</div>}
          <div className="flex justify-end gap-2 md:col-span-4"><button className="btn btn-ghost" onClick={() => setEdit(false)}>Отмена</button><button className="btn btn-primary" onClick={save}>Сохранить</button></div>
        </div>
      )}
    </div>
  );
}

export function DirectoryDetail({ id }: { id: string }) {
  const [s, setS] = useState<Src | null>(null);
  const load = () => api.get<Src>(`/api/directory/${id}`).then(setS);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!s) return <div className="text-muted">Загрузка…</div>;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="text-xs text-muted"><Link href="/app/directory" className="hover:text-brand">Справочник корректировок</Link> / {s.name}</div>
      <div className="card p-4">
        <h1 className="text-lg font-semibold">{s.name}</h1>
        <div className="mt-1 text-muted">Редакция {s.edition} · {s.publisher ?? "издатель не указан"} · актуален на {fmtDate(s.actualDate)} · используется в оценках: {s._count.assessments}</div>
        {s.licenseNote && <div className={`mt-2 rounded-md px-3 py-2 text-xs ${s.isDemo ? "bg-amber-50 text-warn" : "bg-slate-50 text-muted"}`}>{s.licenseNote}</div>}
        {!s.editable && <div className="mt-2 text-xs text-muted">Системная редакция доступна только для чтения. Создайте собственную редакцию, чтобы изменить значения.</div>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {s.factors.map((f) => <FactorCard key={f.id} f={f} sid={s.id} editable={s.editable} onSaved={load} />)}
      </div>
    </div>
  );
}
