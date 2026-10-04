"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { fmtDate } from "@/core/format";

/** field — путь поля для перехода из «Контроля качества» (см. focusField). */
export function Field({ label, children, hint, className = "", source, required, error, field }: { label: string; children: ReactNode; hint?: ReactNode; className?: string; source?: ReactNode; required?: boolean; error?: ReactNode; field?: string }) {
  return (
    <div className={`min-w-0 rounded-md ${className}`} data-field={field}>
      <div className="mb-1 flex min-h-[18px] items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-muted">{label}{required && <span className="ml-0.5 text-err">*</span>}</span>
        {source}
      </div>
      {children}
      {error ? <div className="mt-1 text-[11.5px] text-err">{error}</div> : hint ? <div className="mt-1 text-[11.5px] text-muted">{hint}</div> : null}
    </div>
  );
}

/** Метка происхождения значения: источник и дата получения — во всплывающей подсказке. */
export function SourceTag({ source, title, at }: { source?: string; title?: string; at?: string }) {
  if (!source) return null;
  const egrn = source.startsWith("egrn");
  const label = egrn ? "ЕГРН" : source === "manual" ? "Вручную" : source === "yandex" ? "Яндекс" : source;
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        className={`inline-flex cursor-default items-center gap-1 rounded px-1 text-[10.5px] font-medium uppercase tracking-wide outline-none ${egrn ? "bg-brand-soft text-brand" : "bg-subtle text-muted"}`}
      >
        {egrn && <Icon name="check" size={10} strokeWidth={2.4} />}
        {label}
      </span>
      <span className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-30 hidden w-60 rounded-md border border-line bg-white p-2.5 text-left text-[12px] normal-case tracking-normal text-zinc-700 shadow-lg group-hover:block group-focus-within:block">
        <span className="block"><span className="text-muted">Источник: </span>{title ?? label}</span>
        <span className="mt-0.5 block"><span className="text-muted">Дата получения: </span>{fmtDate(at ?? null)}</span>
      </span>
    </span>
  );
}

type Draft = Record<string, unknown>;

export function TextInput({ d, k, set, type = "text", placeholder, disabled }: { d: Draft; k: string; set: (k: string, v: unknown) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  const raw = d[k];
  const v = type === "date" ? (typeof raw === "string" ? raw.slice(0, 10) : "") : raw === null || raw === undefined ? "" : String(raw);
  return <input className="input" type={type} value={v} placeholder={placeholder} disabled={disabled} onChange={(e) => set(k, e.target.value)} />;
}

export function NumInput({ d, k, set, placeholder, suffix }: { d: Draft; k: string; set: (k: string, v: unknown) => void; placeholder?: string; suffix?: string }) {
  const raw = d[k];
  const input = <input className={`input num ${suffix ? "pr-9" : ""}`} inputMode="decimal" value={raw === null || raw === undefined ? "" : String(raw)} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} />;
  if (!suffix) return input;
  return (
    <div className="relative">
      {input}
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">{suffix}</span>
    </div>
  );
}

export function TextArea({ d, k, set, rows = 3, placeholder }: { d: Draft; k: string; set: (k: string, v: unknown) => void; rows?: number; placeholder?: string }) {
  return <textarea className="input leading-relaxed" rows={rows} placeholder={placeholder} value={(d[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} />;
}

export function Select({ d, k, set, options }: { d: Draft; k: string; set: (k: string, v: unknown) => void; options: Array<[string, string]> }) {
  return (
    <select className="input" value={(d[k] as string) ?? ""} onChange={(e) => set(k, e.target.value || null)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function TriState({ d, k, set, yes = "Да", no = "Нет" }: { d: Draft; k: string; set: (k: string, v: unknown) => void; yes?: string; no?: string }) {
  const v = d[k];
  return (
    <select className="input" value={v === true ? "1" : v === false ? "0" : ""} onChange={(e) => set(k, e.target.value === "" ? null : e.target.value === "1")}>
      <option value="">—</option>
      <option value="1">{yes}</option>
      <option value="0">{no}</option>
    </select>
  );
}

/** Нижняя панель сохранения формы. */
export function SaveBar({ dirty, busy, onSave, onReset, error, saved }: { dirty: boolean; busy: boolean; onSave: () => void; onReset: () => void; error?: string | null; saved?: boolean }) {
  if (!dirty && !error) return null;
  void saved;
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-line bg-white/95 px-4 py-2.5 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="flex items-center justify-end gap-3">
        <span className="mr-auto flex items-center gap-1.5 text-[13px]">
          {error ? (
            <span className="text-err">{error}</span>
          ) : dirty ? (
            <><span className="h-1.5 w-1.5 rounded-full bg-warn" /><span className="text-zinc-700">Есть несохранённые изменения</span></>
          ) : (
            <><Icon name="check" size={14} className="text-ok" /><span className="text-ok">Изменения сохранены</span></>
          )}
        </span>
        <button className="btn btn-ghost" disabled={!dirty || busy} onClick={onReset}>Отменить</button>
        <button className="btn btn-primary" disabled={!dirty || busy} onClick={onSave}>{busy ? "Сохранение…" : "Сохранить"}</button>
      </div>
    </div>
  );
}
