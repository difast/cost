"use client";

import { useRef, useState } from "react";
import { api, errorText } from "@/lib/api";
import { Field, NumInput, SaveBar, Select, TextArea, TextInput, TriState } from "@/components/ui/Field";
import { useDraft } from "@/components/ui/useDraft";
import { CONDITION_OPTIONS, FINISHING_OPTIONS, WALL_OPTIONS } from "@/lib/labels";
import { fmtDate } from "@/core/format";
import type { WsProps } from "./Workspace";
import type { Provenance } from "./types";

const P_KEYS = ["objectType", "address", "cadastralNumber", "area", "livingArea", "kitchenArea", "purpose", "rights", "rightHolders", "encumbrances", "rooms", "floor", "ceilingHeight", "finishing", "condition", "furniture", "balcony", "bathroom", "communications", "metroName", "metroDistanceM", "district", "description"] as const;
const B_KEYS = ["cadastralNumber", "yearBuilt", "floors", "wallMaterial", "series", "houseCondition", "elevators", "parking", "overhaulYear", "description"] as const;

function pick(o: Record<string, unknown>, keys: readonly string[]) {
  return Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));
}

function Src({ prov, k }: { prov: Provenance; k: string }) {
  const p = prov?.[k];
  if (!p) return null;
  const egrn = p.source?.startsWith("egrn");
  return (
    <span title={`${p.title ?? ""} · ${fmtDate(p.at ?? null)}`} className={`badge ${egrn ? "bg-green-50 text-ok" : "bg-slate-100 text-slate-500"}`}>
      {egrn ? "ЕГРН" : "вручную"}
    </span>
  );
}

export function PropertyTab({ detail, reload }: WsProps) {
  const prop = useDraft(pick(detail.property, P_KEYS));
  const bld = useDraft(pick(detail.building, B_KEYS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [egrnMsg, setEgrnMsg] = useState<string | null>(null);
  const egrnRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const pv = detail.property.provenance;
  const bv = detail.building.provenance;
  const P = prop.draft, sP = prop.set, B = bld.draft, sB = bld.set;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/assessments/${detail.id}/property`, {
        ...(prop.dirty ? { property: prop.changes } : {}),
        ...(bld.dirty ? { building: bld.changes } : {}),
      });
      setSaved(true);
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadEgrn(f: File) {
    setEgrnMsg("Загрузка…");
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await api.upload<{ applied: string[]; extracted: { recognized: string[] } | null }>(`/api/assessments/${detail.id}/egrn`, fd);
      setEgrnMsg(r.extracted ? `Распознано полей: ${r.extracted.recognized.length}, заполнено пустых: ${r.applied.length}. Расхождения с уже введёнными данными — во вкладке «Проверки».` : "PDF сохранён как документ. Внесите данные вручную.");
      await reload();
    } catch (e) {
      setEgrnMsg(errorText(e));
    }
  }

  async function uploadFiles(files: FileList, kind: "photo" | "document") {
    const fd = new FormData();
    fd.append("kind", kind);
    for (const f of Array.from(files)) fd.append("file", f);
    try {
      await api.upload(`/api/assessments/${detail.id}/files`, fd);
      await reload();
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function removeFile(id: string) {
    if (!confirm("Удалить файл?")) return;
    try {
      await api.del(`/api/files/${id}`);
      await reload();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const photos = detail.files.filter((f) => f.kind === "photo");
  const docs = detail.files.filter((f) => f.kind === "document" || f.kind === "egrn");

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="card-t">Выписка из ЕГРН</div>
          <div className="text-xs text-muted">Загрузите XML-выписку — кадастровый номер, площадь, адрес, этаж, права и обременения будут заполнены автоматически и сверены с введёнными данными.</div>
          {egrnMsg && <div className="mt-1 text-xs text-brand">{egrnMsg}</div>}
          {detail.sources.filter((s) => s.kind.startsWith("egrn")).map((s) => (
            <div key={s.id} className="mt-1 text-xs text-muted">✓ {s.title} · загружено {fmtDate(s.retrievedAt)}</div>
          ))}
        </div>
        <div>
          <input ref={egrnRef} type="file" accept=".xml,.pdf,application/xml,text/xml,application/pdf" hidden onChange={(e) => e.target.files?.[0] && uploadEgrn(e.target.files[0])} />
          <button className="btn btn-secondary" onClick={() => egrnRef.current?.click()}>Загрузить выписку (XML / PDF)</button>
        </div>
      </div>

      <div className="card p-4">
        <div className="card-t mb-3">Объект оценки</div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Адрес" className="md:col-span-3" source={<Src prov={pv} k="address" />}><TextInput d={P} k="address" set={sP} /></Field>
          <Field label="Вид объекта"><TextInput d={P} k="objectType" set={sP} /></Field>
          <Field label="Кадастровый номер" source={<Src prov={pv} k="cadastralNumber" />}><TextInput d={P} k="cadastralNumber" set={sP} placeholder="77:01:0001001:1234" /></Field>
          <Field label="Общая площадь, м²" source={<Src prov={pv} k="area" />}><NumInput d={P} k="area" set={sP} /></Field>
          <Field label="Жилая площадь, м²"><NumInput d={P} k="livingArea" set={sP} /></Field>
          <Field label="Площадь кухни, м²"><NumInput d={P} k="kitchenArea" set={sP} /></Field>
          <Field label="Комнат"><NumInput d={P} k="rooms" set={sP} /></Field>
          <Field label="Этаж" source={<Src prov={pv} k="floor" />}><NumInput d={P} k="floor" set={sP} /></Field>
          <Field label="Высота потолков, м"><NumInput d={P} k="ceilingHeight" set={sP} /></Field>
          <Field label="Назначение" source={<Src prov={pv} k="purpose" />}><TextInput d={P} k="purpose" set={sP} /></Field>
          <Field label="Отделка"><Select d={P} k="finishing" set={sP} options={FINISHING_OPTIONS} /></Field>
          <Field label="Мебель"><TriState d={P} k="furniture" set={sP} yes="С мебелью" no="Без мебели" /></Field>
          <Field label="Состояние квартиры"><TextInput d={P} k="condition" set={sP} /></Field>
          <Field label="Санузел"><TextInput d={P} k="bathroom" set={sP} /></Field>
          <Field label="Балкон / лоджия"><TextInput d={P} k="balcony" set={sP} /></Field>
          <Field label="Коммуникации" className="md:col-span-3"><TextInput d={P} k="communications" set={sP} /></Field>
          <Field label="Вид права" source={<Src prov={pv} k="rights" />}><TextInput d={P} k="rights" set={sP} /></Field>
          <Field label="Правообладатель" className="md:col-span-2"><TextInput d={P} k="rightHolders" set={sP} /></Field>
          <Field label="Обременения" source={<Src prov={pv} k="encumbrances" />}><TextInput d={P} k="encumbrances" set={sP} /></Field>
          <Field label="Описание объекта" className="md:col-span-4"><TextArea d={P} k="description" set={sP} rows={3} /></Field>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="card-t mb-3">Здание</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Кадастровый номер здания"><TextInput d={B} k="cadastralNumber" set={sB} /></Field>
            <Field label="Год постройки" source={<Src prov={bv} k="yearBuilt" />}><NumInput d={B} k="yearBuilt" set={sB} /></Field>
            <Field label="Этажность"><NumInput d={B} k="floors" set={sB} /></Field>
            <Field label="Материал стен"><Select d={B} k="wallMaterial" set={sB} options={WALL_OPTIONS} /></Field>
            <Field label="Серия"><TextInput d={B} k="series" set={sB} /></Field>
            <Field label="Техническое состояние"><Select d={B} k="houseCondition" set={sB} options={CONDITION_OPTIONS} /></Field>
            <Field label="Лифты"><TextInput d={B} k="elevators" set={sB} /></Field>
            <Field label="Год капремонта"><NumInput d={B} k="overhaulYear" set={sB} /></Field>
            <Field label="Описание здания" className="col-span-2"><TextArea d={B} k="description" set={sB} rows={2} /></Field>
          </div>
        </div>
        <div className="card p-4">
          <div className="card-t mb-3">Местоположение и окружение</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Район"><TextInput d={P} k="district" set={sP} /></Field>
            <Field label="Ближайшее метро"><TextInput d={P} k="metroName" set={sP} /></Field>
            <Field label="Расстояние до метро, м" hint="Используется в корректировке на транспортную доступность"><NumInput d={P} k="metroDistanceM" set={sP} /></Field>
          </div>
          <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-muted">
            Автоматический расчёт расстояний до метро, остановок, школ и другой инфраструктуры появится после подключения картографического сервиса по договору (версия 2).
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-h">
            <div className="card-t">Фотографии объекта ({photos.length})</div>
            <input ref={photoRef} type="file" accept="image/png,image/jpeg" multiple hidden onChange={(e) => e.target.files && uploadFiles(e.target.files, "photo")} />
            <button className="btn btn-secondary" onClick={() => photoRef.current?.click()}>Добавить фото</button>
          </div>
          <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4">
            {photos.map((f) => (
              <div key={f.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${f.id}?inline=1`} alt={f.filename} className="aspect-square w-full rounded border border-line object-cover" />
                <button className="absolute right-1 top-1 hidden rounded bg-white/90 px-1 text-xs text-err group-hover:block" onClick={() => removeFile(f.id)}>✕</button>
              </div>
            ))}
            {!photos.length && <div className="col-span-full text-xs text-muted">Фото попадут в приложение к отчёту.</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <div className="card-t">Документы ({docs.length})</div>
            <input ref={docRef} type="file" accept="image/png,image/jpeg,application/pdf" multiple hidden onChange={(e) => e.target.files && uploadFiles(e.target.files, "document")} />
            <button className="btn btn-secondary" onClick={() => docRef.current?.click()}>Добавить документ</button>
          </div>
          <ul className="divide-y divide-slate-100">
            {docs.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-4 py-2">
                <a href={`/api/files/${f.id}`} className="truncate text-brand hover:underline">{f.caption ?? f.filename}</a>
                <span className="text-xs text-muted">{fmtDate(f.createdAt)}</span>
              </li>
            ))}
            {!docs.length && <li className="px-4 py-3 text-xs text-muted">Выписки, правоустанавливающие документы, техпаспорт.</li>}
          </ul>
        </div>
      </div>

      <SaveBar dirty={prop.dirty || bld.dirty} busy={busy} onSave={save} onReset={() => { prop.reset(); bld.reset(); }} error={error} saved={saved} />
    </div>
  );
}
