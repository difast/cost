"use client";

// Компоненты дизайн-системы личного кабинета.

import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

// ───────── Заголовок страницы

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[12px] text-muted">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
        {description && <p className="mt-1 text-[13.5px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ───────── Панель (поверхность с заголовком)

export function Panel({ title, description, actions, children, className = "", bodyClassName = "p-4", id }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section id={id} className={`card min-w-0 ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[14px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// ───────── Метки

export type Tone = "neutral" | "brand" | "ok" | "warn" | "err" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-subtle text-zinc-600",
  brand: "bg-brand-soft text-brand",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  err: "bg-err-soft text-err",
  info: "bg-zinc-100 text-zinc-700",
};

export function Badge({ tone = "neutral", children, icon, title }: { tone?: Tone; children: ReactNode; icon?: IconName; title?: string }) {
  return (
    <span className={`badge ${TONES[tone]}`} title={title}>
      {icon && <Icon name={icon} size={12} strokeWidth={2} />}
      {children}
    </span>
  );
}

export const ASSESSMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Черновик", tone: "neutral" },
  in_progress: { label: "В работе", tone: "brand" },
  review: { label: "На проверке", tone: "warn" },
  completed: { label: "Завершена", tone: "ok" },
  archived: { label: "Архив", tone: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = ASSESSMENT_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Проверки «пройдено / всего» с цветом по наихудшему состоянию. */
export function ChecksMeter({ passed, total, errors, warnings, compact = false }: { passed: number; total: number; errors: number; warnings: number; compact?: boolean }) {
  const tone = errors ? "text-err" : warnings ? "text-warn" : "text-ok";
  const bar = errors ? "bg-err" : warnings ? "bg-warn" : "bg-ok";
  return (
    <div className="flex items-center gap-2" title={`Пройдено ${passed} из ${total}${errors ? `, ошибок: ${errors}` : ""}${warnings ? `, предупреждений: ${warnings}` : ""}`}>
      <span className={`num text-[13px] font-medium ${tone}`}>{passed} / {total}</span>
      {!compact && (
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-subtle">
          <span className={`block h-full ${bar}`} style={{ width: `${total ? (passed / total) * 100 : 0}%` }} />
        </span>
      )}
    </div>
  );
}

// ───────── Уведомления

const NOTICE: Record<"info" | "ok" | "warn" | "err", { cls: string; icon: IconName }> = {
  info: { cls: "border-line bg-subtle text-zinc-700", icon: "info" },
  ok: { cls: "border-ok/25 bg-ok-soft text-ok", icon: "checkCircle" },
  warn: { cls: "border-warn/25 bg-warn-soft text-[#8a5a12]", icon: "alert" },
  err: { cls: "border-err/25 bg-err-soft text-err", icon: "error" },
};

export function Notice({ tone = "info", title, children, action, className = "" }: { tone?: keyof typeof NOTICE; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const n = NOTICE[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px] ${n.cls} ${className}`} role={tone === "err" ? "alert" : "status"}>
      <Icon name={n.icon} size={16} className="mt-[1px]" />
      <div className="min-w-0 flex-1">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ───────── Пустое состояние

export function EmptyState({ icon = "assessments", title, children, action }: { icon?: IconName; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-subtle text-muted"><Icon name={icon} size={20} /></div>
      <div className="mt-4 text-[15px] font-semibold text-ink">{title}</div>
      {children && <p className="mt-1.5 max-w-md text-[13.5px] text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ───────── Загрузка

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-subtle ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Загрузка">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}

// ───────── Показатель

export function Stat({ label, value, hint, tone, active, onClick }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "ok" | "warn" | "err"; active?: boolean; onClick?: () => void }) {
  const color = tone === "err" ? "text-err" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`card flex min-w-0 flex-col items-start px-4 py-3 text-left transition ${onClick ? "hover:border-line-strong" : ""} ${active ? "border-brand ring-1 ring-brand" : ""}`}
    >
      <span className="text-[12px] text-muted">{label}</span>
      <span className={`num mt-1 text-[22px] font-semibold leading-none ${color}`}>{value}</span>
      {hint && <span className="mt-1.5 text-[11.5px] text-muted">{hint}</span>}
    </Tag>
  );
}

// ───────── Модальное окно

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-4xl" : "max-w-2xl";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-graphite/40 p-3 sm:p-6" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div className={`card my-6 w-full ${w} shadow-[0_20px_60px_-20px_rgba(17,19,18,.45)]`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <button className="btn btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="Закрыть"><Icon name="x" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-canvas px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, children, confirmLabel = "Удалить", onConfirm, onClose, busy }: { open: boolean; title: ReactNode; children?: ReactNode; confirmLabel?: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn bg-err text-white hover:bg-[#a33024]" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <div className="text-[13.5px] text-zinc-700">{children}</div>
    </Modal>
  );
}

// ───────── Всплывающие уведомления

type ToastItem = { id: number; text: string; tone: "ok" | "err" | "info" };
let listeners: Array<(t: ToastItem) => void> = [];
let seq = 0;

export function toast(text: string, tone: ToastItem["tone"] = "ok") {
  const t = { id: ++seq, text, tone };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const l = (t: ToastItem) => {
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 3200);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-2 rounded-md bg-graphite px-3.5 py-2.5 text-[13px] text-white shadow-lg">
          <Icon name={t.tone === "err" ? "error" : t.tone === "info" ? "info" : "checkCircle"} size={16} className={t.tone === "err" ? "text-[#ff9b8f]" : "text-[#7fd1a8]"} />
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ───────── Сегментированный переключатель

export function Segmented<T extends string>({ value, onChange, options, size = "md" }: { value: T; onChange: (v: T) => void; options: Array<[T, ReactNode]>; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-md border border-line bg-subtle p-0.5" role="tablist">
      {options.map(([v, l]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`rounded-[5px] ${size === "sm" ? "px-2.5 py-1 text-[12.5px]" : "px-3 py-1.5 text-[13px]"} font-medium transition ${value === v ? "bg-white text-ink shadow-[0_1px_2px_rgba(17,19,18,.08)]" : "text-muted hover:text-ink"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

// ───────── Поиск

export function SearchInput({ value, onChange, placeholder, className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={`relative block ${className}`}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={15} /></span>
      <input className="input pl-8" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

// ───────── Пара «подпись — значение»

export function KV({ label, children, source }: { label: ReactNode; children: ReactNode; source?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[12px] text-muted">{label}{source}</div>
      <div className="mt-0.5 truncate text-[13.5px] text-ink">{children}</div>
    </div>
  );
}
