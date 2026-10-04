"use client";

import type { ReactNode } from "react";

export function Field({ label, children, hint, className = "", source }: { label: string; children: ReactNode; hint?: ReactNode; className?: string; source?: ReactNode }) {
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {source}
      </div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

type Draft = Record<string, unknown>;

export function TextInput({ d, k, set, type = "text", placeholder, disabled }: { d: Draft; k: string; set: (k: string, v: unknown) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  const raw = d[k];
  const v = type === "date" ? (typeof raw === "string" ? raw.slice(0, 10) : "") : raw === null || raw === undefined ? "" : String(raw);
  return <input className="input" type={type} value={v} placeholder={placeholder} disabled={disabled} onChange={(e) => set(k, e.target.value)} />;
}

export function NumInput({ d, k, set, placeholder }: { d: Draft; k: string; set: (k: string, v: unknown) => void; placeholder?: string }) {
  const raw = d[k];
  return <input className="input num" inputMode="decimal" value={raw === null || raw === undefined ? "" : String(raw)} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} />;
}

export function TextArea({ d, k, set, rows = 3, placeholder }: { d: Draft; k: string; set: (k: string, v: unknown) => void; rows?: number; placeholder?: string }) {
  return <textarea className="input" rows={rows} placeholder={placeholder} value={(d[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} />;
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

export function SaveBar({ dirty, busy, onSave, onReset, error, saved }: { dirty: boolean; busy: boolean; onSave: () => void; onReset: () => void; error?: string | null; saved?: boolean }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex items-center justify-end gap-3 border-t border-line bg-white/95 px-4 py-2.5 backdrop-blur">
      {error && <span className="mr-auto text-err">{error}</span>}
      {!error && saved && !dirty && <span className="mr-auto text-ok">Сохранено</span>}
      {dirty && <span className="mr-auto text-warn">Есть несохранённые изменения</span>}
      <button className="btn btn-ghost" disabled={!dirty || busy} onClick={onReset}>Отменить</button>
      <button className="btn btn-primary" disabled={!dirty || busy} onClick={onSave}>{busy ? "Сохранение…" : "Сохранить"}</button>
    </div>
  );
}
