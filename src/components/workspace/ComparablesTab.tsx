"use client";

import { useRef, useState } from "react";
import { api, errorText } from "@/lib/api";
import { Field, NumInput, Select, TextArea, TextInput, TriState } from "@/components/ui/Field";
import { useDraft } from "@/components/ui/useDraft";
import { CONDITION_OPTIONS, FINISHING_OPTIONS, WALL_OPTIONS, label } from "@/lib/labels";
import { fmtDate, fmtNumber, isoDate } from "@/core/format";
import { d } from "@/core/calc/decimal";
import type { WsProps } from "./Workspace";
import type { ComparableRow } from "./types";

const EMPTY = {
  sourceName: "", sourceUrl: "", retrievedAt: new Date().toISOString().slice(0, 10), offerDate: "", address: "",
  price: "", area: "", rooms: "", floor: "", floors: "", wallMaterial: "", yearBuilt: "", finishing: "", furniture: null,
  houseCondition: "", metroDistanceM: "", rights: "Собственность", description: "",
};

function ComparableForm({ assessmentId, initial, onDone, onCancel }: { assessmentId: string; initial: ComparableRow | null; onDone: () => void; onCancel: () => void }) {
  const init = initial
    ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, k === "retrievedAt" || k === "offerDate" ? isoDate((initial as unknown as Record<string, string>)[k]) : (initial as unknown as Record<string, unknown>)[k] ?? ""]))
    : EMPTY;
  const { draft: D, set } = useDraft(init as Record<string, unknown>);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shotRef = useRef<HTMLInputElement>(null);
  const [shot, setShot] = useState<File | null>(null);
  const unit = D.price && D.area && Number(String(D.area).replace(",", ".")) > 0 ? d(String(D.price).replace(/\s/g, "").replace(",", ".")).div(String(D.area).replace(",", ".")) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = Object.fromEntries(Object.entries(D).map(([k, v]) => [k, v === "" ? null : v]));
      const saved = initial
        ? await api.patch<{ id: string }>(`/api/assessments/${assessmentId}/comparables/${initial.id}`, payload)
        : await api.post<{ id: string }>(`/api/assessments/${assessmentId}/comparables`, payload);
      if (shot) {
        const fd = new FormData();
        fd.append("kind", "screenshot");
        fd.append("comparableId", saved.id);
        fd.append("caption", `Скриншот объявления: ${D.sourceUrl || D.address || ""}`);
        fd.append("file", shot);
        await api.upload(`/api/assessments/${assessmentId}/files`, fd);
      }
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={onCancel}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card my-8 w-full max-w-3xl p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold">{initial ? "Редактирование аналога" : "Новый аналог"}</div>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>✕</button>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Ссылка на объявление *" className="md:col-span-3"><TextInput d={D} k="sourceUrl" set={set} placeholder="https://…" /></Field>
          <Field label="Источник"><input className="input" list="srcs" value={(D.sourceName as string) ?? ""} onChange={(e) => set("sourceName", e.target.value)} /><datalist id="srcs"><option value="ЦИАН" /><option value="Авито" /><option value="Домклик" /><option value="Яндекс Недвижимость" /></datalist></Field>
          <Field label="Дата получения данных *"><TextInput d={D} k="retrievedAt" set={set} type="date" /></Field>
          <Field label="Дата предложения"><TextInput d={D} k="offerDate" set={set} type="date" /></Field>
          <Field label="Скриншот объявления" className="md:col-span-2">
            <input ref={shotRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => setShot(e.target.files?.[0] ?? null)} />
            <button type="button" className="btn btn-secondary w-full" onClick={() => shotRef.current?.click()}>{shot ? shot.name : initial?.screenshotFileId ? "Заменить скриншот" : "Загрузить PNG/JPEG"}</button>
          </Field>
          <Field label="Адрес *" className="md:col-span-4"><TextInput d={D} k="address" set={set} /></Field>
          <Field label="Цена предложения, ₽ *"><NumInput d={D} k="price" set={set} /></Field>
          <Field label="Общая площадь, м² *"><NumInput d={D} k="area" set={set} /></Field>
          <Field label="Цена за м²"><div className="input num bg-slate-50">{unit ? fmtNumber(unit, 2) : "—"}</div></Field>
          <Field label="Комнат"><NumInput d={D} k="rooms" set={set} /></Field>
          <Field label="Этаж"><NumInput d={D} k="floor" set={set} /></Field>
          <Field label="Этажность"><NumInput d={D} k="floors" set={set} /></Field>
          <Field label="Материал стен"><Select d={D} k="wallMaterial" set={set} options={WALL_OPTIONS} /></Field>
          <Field label="Год постройки"><NumInput d={D} k="yearBuilt" set={set} /></Field>
          <Field label="Отделка"><Select d={D} k="finishing" set={set} options={FINISHING_OPTIONS} /></Field>
          <Field label="Мебель"><TriState d={D} k="furniture" set={set} yes="С мебелью" no="Без мебели" /></Field>
          <Field label="Состояние дома"><Select d={D} k="houseCondition" set={set} options={CONDITION_OPTIONS} /></Field>
          <Field label="До метро, м"><NumInput d={D} k="metroDistanceM" set={set} /></Field>
          <Field label="Права"><TextInput d={D} k="rights" set={set} /></Field>
          <Field label="Описание / примечание" className="md:col-span-4"><TextArea d={D} k="description" set={set} rows={2} /></Field>
        </div>
        {error && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-err">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Отмена</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Сохранение…" : "Сохранить аналог"}</button>
        </div>
      </form>
    </div>
  );
}

export function ComparablesTab({ detail, reload, calc, go }: WsProps) {
  const [editing, setEditing] = useState<ComparableRow | null | "new">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const p = detail.property;
  const b = detail.building;

  const diff = (a: unknown, s: unknown) => (a !== null && a !== undefined && s !== null && s !== undefined && String(a) !== String(s) ? "bg-amber-50" : "");

  async function toggle(c: ComparableRow) {
    await api.patch(`/api/assessments/${detail.id}/comparables/${c.id}`, { included: !c.included });
    await reload();
  }
  async function remove(c: ComparableRow) {
    if (!confirm("Удалить аналог вместе с его корректировками?")) return;
    await api.del(`/api/assessments/${detail.id}/comparables/${c.id}`);
    await reload();
  }
  async function importCsv(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await api.upload<{ imported: number; errors: string[] }>(`/api/assessments/${detail.id}/comparables/import`, fd);
      setMsg(`Импортировано: ${r.imported}${r.errors.length ? `. Замечания: ${r.errors.join("; ")}` : ""}`);
      await reload();
    } catch (e) {
      setMsg(errorText(e));
    }
  }

  const resById = Object.fromEntries((calc?.result?.comparables ?? []).map((c) => [c.id, c]));

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-h flex-wrap">
          <div>
            <div className="card-t">Объекты-аналоги</div>
            <div className="text-xs text-muted">Отличия от объекта оценки подсвечены. Для каждого аналога обязательны ссылка и дата получения.</div>
          </div>
          <div className="flex gap-2">
            <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            <button className="btn btn-secondary" onClick={() => csvRef.current?.click()} title="Колонки: Ссылка; Источник; Дата получения; Адрес; Цена; Площадь; Комнаты; Этаж; Этажность; Материал; Год постройки; Отделка; Мебель; До метро">Импорт CSV</button>
            <button className="btn btn-primary" onClick={() => setEditing("new")}>+ Добавить аналог</button>
          </div>
        </div>
        {msg && <div className="border-b border-line bg-blue-50 px-4 py-2 text-xs text-brand">{msg}</div>}
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th></th><th>Аналог</th><th>Источник / дата</th><th>Адрес</th>
                <th className="text-right">Цена, ₽</th><th className="text-right">S, м²</th><th className="text-right">₽/м²</th>
                <th className="text-right">Скорр. ₽/м²</th><th>Комн.</th><th>Этаж</th><th>Материал</th><th>Отделка</th><th>Мебель</th><th>Метро</th><th>Скрин</th><th></th>
              </tr>
              <tr className="bg-blue-50/40 text-xs">
                <td className="px-2.5 py-1.5"></td>
                <td className="px-2.5 py-1.5 font-medium">Объект</td>
                <td className="px-2.5 py-1.5 text-muted">дата оценки {fmtDate(detail.valuationDate)}</td>
                <td className="px-2.5 py-1.5">{(p.address as string) ?? "—"}</td>
                <td></td>
                <td className="num px-2.5 py-1.5 text-right">{p.area ? fmtNumber(p.area as string, 2, true) : "—"}</td>
                <td></td>
                <td className="num px-2.5 py-1.5 text-right font-semibold">{calc?.result ? fmtNumber(calc.result.weightedUnitPrice) : "—"}</td>
                <td className="px-2.5 py-1.5">{(p.rooms as number) ?? "—"}</td>
                <td className="px-2.5 py-1.5">{(p.floor as number) ?? "—"}/{(b.floors as number) ?? "—"}</td>
                <td className="px-2.5 py-1.5">{label(WALL_OPTIONS, b.wallMaterial as string)}</td>
                <td className="px-2.5 py-1.5">{label(FINISHING_OPTIONS, p.finishing as string)}</td>
                <td className="px-2.5 py-1.5">{p.furniture === true ? "да" : p.furniture === false ? "нет" : "—"}</td>
                <td className="px-2.5 py-1.5">{(p.metroDistanceM as number) ?? "—"}</td>
                <td></td><td></td>
              </tr>
            </thead>
            <tbody>
              {detail.comparables.map((c, i) => {
                const r = resById[c.id];
                return (
                  <tr key={c.id} className={c.included ? "" : "opacity-50"}>
                    <td><input type="checkbox" checked={c.included} onChange={() => toggle(c)} title="Включить в расчёт" /></td>
                    <td className="font-medium">Аналог {i + 1}</td>
                    <td className="text-xs">
                      {c.sourceUrl ? <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">{c.sourceName ?? "ссылка"}</a> : <span className="text-err">нет ссылки</span>}
                      <div className="text-muted">{fmtDate(c.retrievedAt)}</div>
                    </td>
                    <td className="max-w-56">{c.address ?? <span className="text-err">—</span>}</td>
                    <td className="num text-right">{fmtNumber(c.price, 0)}</td>
                    <td className={`num text-right ${diff(c.area, p.area)}`}>{fmtNumber(c.area, 2, true)}</td>
                    <td className="num text-right">{fmtNumber(d(c.price).div(c.area), 0)}</td>
                    <td className="num text-right font-medium">{r ? fmtNumber(r.adjustedUnitPrice, 0) : "—"}</td>
                    <td className={diff(c.rooms, p.rooms)}>{c.rooms ?? "—"}</td>
                    <td className={c.floor === 1 || (c.floor && c.floor === c.floors) ? "bg-amber-50" : ""}>{c.floor ?? "—"}/{c.floors ?? "—"}</td>
                    <td className={diff(c.wallMaterial, b.wallMaterial)}>{label(WALL_OPTIONS, c.wallMaterial)}</td>
                    <td className={diff(c.finishing, p.finishing)}>{label(FINISHING_OPTIONS, c.finishing)}</td>
                    <td className={diff(c.furniture, p.furniture)}>{c.furniture === true ? "да" : c.furniture === false ? "нет" : "—"}</td>
                    <td>{c.metroDistanceM ?? "—"}</td>
                    <td>{c.screenshotFileId ? <a className="text-brand" href={`/api/files/${c.screenshotFileId}?inline=1`} target="_blank" rel="noreferrer">✓</a> : <span className="text-warn">нет</span>}</td>
                    <td className="whitespace-nowrap text-right">
                      <button className="btn btn-ghost px-2" onClick={() => setEditing(c)}>Изм.</button>
                      <button className="btn btn-ghost px-2 text-err" onClick={() => remove(c)}>✕</button>
                    </td>
                  </tr>
                );
              })}
              {!detail.comparables.length && (
                <tr><td colSpan={16} className="py-10 text-center text-muted">Добавьте не менее трёх аналогов: вручную по ссылке со скриншотом или импортом CSV.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {detail.comparables.length > 0 && (
        <div className="flex justify-end"><button className="btn btn-primary" onClick={() => go("adjustments")}>Перейти к корректировкам →</button></div>
      )}
      <div className="card p-4 text-xs text-muted">
        Автоматический подбор аналогов будет доступен после подключения легальных источников (партнёрский API площадок или лицензированный поставщик данных). Парсинг сайтов без разрешения правообладателя не используется.
      </div>
      {editing && (
        <ComparableForm
          assessmentId={detail.id}
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onDone={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}
