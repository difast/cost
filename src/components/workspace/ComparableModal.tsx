"use client";

import { useRef, useState } from "react";
import { api, errorText } from "@/lib/api";
import { Field, NumInput, Select, TextArea, TextInput, TriState } from "@/components/ui/Field";
import { useDraft } from "@/components/ui/useDraft";
import { Icon } from "@/components/ui/Icon";
import { Modal, toast } from "@/components/ui/kit";
import { CONDITION_OPTIONS, FINISHING_OPTIONS, WALL_OPTIONS } from "@/lib/labels";
import { fmtNumber, isoDate } from "@/core/format";
import { d } from "@/core/calc/decimal";
import type { ComparableRow } from "./types";

const EMPTY = {
  sourceName: "", sourceUrl: "", retrievedAt: new Date().toISOString().slice(0, 10), offerDate: "", address: "",
  price: "", area: "", rooms: "", floor: "", floors: "", wallMaterial: "", yearBuilt: "", finishing: "", furniture: null,
  houseCondition: "", metroDistanceM: "", rights: "Собственность", description: "",
};

export function ComparableModal({ assessmentId, initial, onDone, onCancel }: { assessmentId: string; initial: ComparableRow | null; onDone: () => void; onCancel: () => void }) {
  const init = initial
    ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, k === "retrievedAt" || k === "offerDate" ? isoDate((initial as unknown as Record<string, string>)[k]) : (initial as unknown as Record<string, unknown>)[k] ?? ""]))
    : EMPTY;
  const { draft: D, set } = useDraft(init as Record<string, unknown>);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shotRef = useRef<HTMLInputElement>(null);
  const [shot, setShot] = useState<File | null>(null);
  const num = (v: unknown) => String(v ?? "").replace(/\s/g, "").replace(",", ".");
  const unit = D.price && D.area && Number(num(D.area)) > 0 && /^\d+(\.\d+)?$/.test(num(D.price)) ? d(num(D.price)).div(num(D.area)) : null;

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
      toast(initial ? "Аналог сохранён" : "Аналог добавлен");
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onCancel}
      size="lg"
      title={initial ? "Редактирование аналога" : "Новый аналог"}
      description="Корректировки по справочнику пересчитаются автоматически после сохранения"
      footer={
        <>
          {error && <span className="mr-auto text-[13px] text-err">{error}</span>}
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Отмена</button>
          <button className="btn btn-primary" form="comparable-form" disabled={busy}>{busy ? "Сохранение…" : "Сохранить аналог"}</button>
        </>
      }
    >
      <form id="comparable-form" onSubmit={submit} className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">Источник</legend>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Ссылка на объявление" required className="md:col-span-3"><TextInput d={D} k="sourceUrl" set={set} placeholder="https://…" /></Field>
            <Field label="Площадка">
              <input className="input" list="srcs" value={(D.sourceName as string) ?? ""} onChange={(e) => set("sourceName", e.target.value)} />
              <datalist id="srcs"><option value="ЦИАН" /><option value="Авито" /><option value="Домклик" /><option value="Яндекс Недвижимость" /></datalist>
            </Field>
            <Field label="Дата получения" required><TextInput d={D} k="retrievedAt" set={set} type="date" /></Field>
            <Field label="Дата предложения"><TextInput d={D} k="offerDate" set={set} type="date" /></Field>
            <Field label="Скриншот объявления" className="md:col-span-2" hint="PNG или JPEG — попадёт в приложение к отчёту">
              <input ref={shotRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => setShot(e.target.files?.[0] ?? null)} />
              <button type="button" className="btn btn-secondary w-full justify-start" onClick={() => shotRef.current?.click()}>
                <Icon name="image" size={15} />{shot ? shot.name : initial?.screenshotFileId ? "Заменить скриншот" : "Выбрать файл"}
              </button>
            </Field>
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">Объект и цена</legend>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Адрес" required className="md:col-span-4"><TextInput d={D} k="address" set={set} /></Field>
            <Field label="Цена предложения" required><NumInput d={D} k="price" set={set} suffix="₽" /></Field>
            <Field label="Общая площадь" required><NumInput d={D} k="area" set={set} suffix="м²" /></Field>
            <Field label="Цена за м²"><div className="input num flex items-center bg-subtle font-medium">{unit ? `${fmtNumber(unit, 2)} ₽` : "—"}</div></Field>
            <Field label="Комнат"><NumInput d={D} k="rooms" set={set} /></Field>
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">Характеристики</legend>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Этаж"><NumInput d={D} k="floor" set={set} /></Field>
            <Field label="Этажность"><NumInput d={D} k="floors" set={set} /></Field>
            <Field label="Материал стен"><Select d={D} k="wallMaterial" set={set} options={WALL_OPTIONS} /></Field>
            <Field label="Год постройки"><NumInput d={D} k="yearBuilt" set={set} /></Field>
            <Field label="Отделка"><Select d={D} k="finishing" set={set} options={FINISHING_OPTIONS} /></Field>
            <Field label="Мебель"><TriState d={D} k="furniture" set={set} yes="С мебелью" no="Без мебели" /></Field>
            <Field label="Состояние дома"><Select d={D} k="houseCondition" set={set} options={CONDITION_OPTIONS} /></Field>
            <Field label="До метро"><NumInput d={D} k="metroDistanceM" set={set} suffix="м" /></Field>
            <Field label="Права"><TextInput d={D} k="rights" set={set} /></Field>
            <Field label="Примечание" className="md:col-span-3"><TextArea d={D} k="description" set={set} rows={1} /></Field>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

export function SourceCell({ c }: { c: ComparableRow }) {
  if (!c.sourceUrl) return <span className="inline-flex items-center gap-1 text-[12.5px] text-err"><Icon name="alert" size={13} />нет ссылки</span>;
  let host = "";
  try {
    host = new URL(c.sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    host = c.sourceUrl;
  }
  return (
    <a href={c.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex max-w-[96px] items-center gap-1 rounded border border-line bg-white px-1.5 py-0.5 text-[12px] text-zinc-700 hover:border-brand hover:text-brand" title={c.sourceUrl}>
      <Icon name="external" size={12} />
      <span className="truncate">{c.sourceName || host}</span>
    </a>
  );
}

