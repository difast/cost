"use client";

// Рабочий документ отчёта внутри оценки: структура | документ (редактор / предпросмотр) | свойства блока.
// Автоматические данные подставляются из оценки; правки оценщика хранятся отдельно и не перезаписываются.
// Автосохранение — обычное сохранение черновика; версии создаются только явным действием.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, errorText } from "@/lib/api";
import { fmtNumber } from "@/core/format";
import { BLOCKED_MESSAGE } from "@/core/calc/quality";
import { FIELD_BY_KEY } from "@/core/document/fields";
import { DOC_STATUS_LABEL, hashBlocks, hashText, type DocBlock as RawBlock, type DocStatus, type DocumentContent, type DocTextBlock } from "@/core/document/model";
import type { ResolvedBlock, ResolvedSection } from "@/core/document/render";
import type { ReportDoc } from "@/core/report/model";
import { Icon } from "@/components/ui/Icon";
import { Badge, ConfirmModal, Notice, Segmented, toast, type Tone } from "@/components/ui/kit";
import { DOC_FONT, DocBlocks } from "./report/DocBlocks";
import { PagedPreview } from "./report/PagedPreview";
import type { WsProps } from "./Workspace";

interface DocVersion { id: string; versionNumber: number; status: string; createdAt: string; createdBy: string | null; note: string | null; docxFileId: string | null; pdfFileId: string | null; xlsxFileId: string | null; calculationVersionNumber: number; finalValue: string; outdated: boolean }
interface DocView {
  id: string;
  status: DocStatus;
  updatedAt: string;
  content: DocumentContent;
  sections: ResolvedSection[];
  preview: ReportDoc | null;
  calc: { hasResult: boolean; finalValue: string | null; errors: number; warnings: number; confirmedVersion: number | null; isStale: boolean };
  versions: DocVersion[];
}

const STATUS_TONE: Record<DocStatus, Tone> = { draft: "neutral", review: "warn", approved: "brand", final: "ok" };
const uid = () => `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const TEXT_CLASS: Record<string, string> = {
  p: "text-justify text-[16px]",
  center: "text-center text-[16px]",
  title: "text-center text-[21.33px] font-bold",
  subheading: "text-[16px] font-bold",
};

function AutoText({ rb }: { rb: Extract<ResolvedBlock, { type: "text" }> }) {
  if (!rb.segments) return <>{rb.text}</>;
  return (
    <>
      {rb.segments.map((s, i) =>
        s.field ? (
          <span key={i} title={`${FIELD_BY_KEY.get(s.field)?.label ?? s.field} — из оценки`} className={`rounded-[2px] ${s.missing ? "bg-warn-soft text-[#8a5a12]" : "bg-[#e9f3ee]"}`}>{s.text}</span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

function TextArea({ value, onChange, className, autoFocus }: { value: string; onChange: (v: string) => void; className: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} autoFocus={autoFocus} rows={1} className={`block w-full resize-none overflow-hidden bg-transparent leading-[1.25] outline-none ${className}`} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function ReportTab({ detail, reload, go }: WsProps) {
  const [view, setView] = useState<DocView | null>(null);
  const [content, setContent] = useState<DocumentContent | null>(null);
  const [mode, setMode] = useState<"editor" | "preview">("editor");
  const [preview, setPreview] = useState<ReportDoc | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [save, setSave] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; items?: string[] } | null>(null);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const base = useRef<string | null>(null);
  const dirty = useRef(false);
  const latest = useRef<DocumentContent | null>(null);
  const inflight = useRef<Promise<unknown>>(Promise.resolve());
  latest.current = content;

  const load = useCallback(async (withPreview = false) => {
    const v = await api.get<DocView>(`/api/assessments/${detail.id}/document${withPreview ? "?preview=1" : ""}`);
    setView(v);
    base.current = v.updatedAt;
    if (!dirty.current) setContent(v.content);
    if (v.preview) setPreview(v.preview);
    return v;
  }, [detail.id]);

  useEffect(() => {
    load().catch((e) => setError({ title: errorText(e) }));
  }, [load]);

  // Автосохранение: через 1,2 с после последней правки — без создания версий
  useEffect(() => {
    if (!content || !dirty.current) return;
    setSave("dirty");
    const t = setTimeout(() => {
      // сохранения выполняются строго по очереди — каждое со свежей отметкой версии документа
      inflight.current = inflight.current.then(() => persist(content)).catch(() => undefined);
    }, 1200);
    return () => clearTimeout(t);
    async function persist(sent: DocumentContent) {
      setSave("saving");
      try {
        const r = await api.put<{ updatedAt: string; status: DocStatus }>(`/api/assessments/${detail.id}/document`, { content: sent, baseUpdatedAt: base.current });
        base.current = r.updatedAt;
        setSavedAt(r.updatedAt);
        setView((v) => (v ? { ...v, status: r.status, updatedAt: r.updatedAt } : v));
        // правки, сделанные во время сохранения, остаются несохранёнными и уйдут следующим запросом
        if (latest.current === sent) dirty.current = false;
        setSave("saved");
        load().catch(() => undefined); // обновить признаки «требует обновления»
      } catch (e) {
        setSave("error");
        setError({ title: errorText(e) });
      }
    }
  }, [content, detail.id, load]);

  const edit = (fn: (c: DocumentContent) => DocumentContent) => {
    dirty.current = true;
    setContent((c) => (c ? fn(structuredClone(c)) : c));
  };
  const patchBlock = (id: string, fn: (b: RawBlock) => RawBlock | null) =>
    edit((c) => ({ ...c, sections: c.sections.map((s) => ({ ...s, blocks: s.blocks.flatMap((b) => (b.id === id ? (fn(b) ? [fn(b)!] : []) : [b])) })) }));

  const resolved = useMemo(() => new Map((view?.sections ?? []).flatMap((s) => s.blocks.map((b) => [b.id, b] as const))), [view]);

  async function showPreview() {
    setMode("preview");
    setPreview(null);
    try {
      await load(true);
    } catch (e) {
      setError({ title: errorText(e) });
    }
  }

  async function setStatus(status: "draft" | "review" | "approved") {
    setBusy(status);
    setError(null);
    try {
      await api.post(`/api/assessments/${detail.id}/document/status`, { status });
      toast(`Статус: ${DOC_STATUS_LABEL[status]}`);
      await load();
    } catch (e) {
      setError({ title: e instanceof ApiError ? e.message : errorText(e), items: e instanceof ApiError && Array.isArray(e.details) ? (e.details as Array<{ message: string }>).map((x) => x.message) : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function createVersion(final: boolean) {
    setBusy(final ? "final" : "version");
    setError(null);
    setConfirmFinal(false);
    try {
      const r = await api.post<{ versionNumber: number; calculationVersionNumber: number }>(`/api/assessments/${detail.id}/document/versions`, { final });
      toast(final ? `Сформирована финальная версия № ${r.versionNumber}` : `Создана версия № ${r.versionNumber}`);
      await Promise.all([load(), reload()]);
    } catch (e) {
      setError({ title: e instanceof ApiError ? e.message : errorText(e), items: e instanceof ApiError && Array.isArray(e.details) ? (e.details as Array<{ message: string }>).map((x) => x.message) : undefined });
    } finally {
      setBusy(null);
    }
  }

  if (error && !view) return <Notice tone="err" title="Документ не загружен">{error.title}</Notice>;
  if (!view || !content) return <div className="card h-96 animate-pulse" />;

  const blocked = view.calc.errors > 0 || !view.calc.hasResult;
  const lastFinal = view.versions.find((v) => v.status === "final") ?? null;
  const sel = selected ? resolved.get(selected) ?? null : null;
  const selRaw = selected ? content.sections.flatMap((s) => s.blocks).find((b) => b.id === selected) ?? null : null;
  const selSection = selected ? content.sections.find((s) => s.blocks.some((b) => b.id === selected)) ?? null : null;
  let num = 0;

  // ───────── левая колонка: статус, действия, структура
  const left = (
    <div className="space-y-4">
      <section className="card p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-muted">Статус</span>
          <Badge tone={STATUS_TONE[view.status]}>{DOC_STATUS_LABEL[view.status]}</Badge>
        </div>
        <div className="mt-2.5 grid gap-1.5">
          {view.status === "draft" && <button className="btn btn-secondary btn-sm h-auto justify-center whitespace-normal py-1.5 text-center leading-tight" disabled={!!busy} onClick={() => setStatus("review")}>На проверку</button>}
          {view.status === "review" && <button className="btn btn-secondary btn-sm h-auto justify-center whitespace-normal py-1.5 text-center leading-tight" disabled={!!busy || blocked} onClick={() => setStatus("approved")}>Подтвердить</button>}
          {(view.status === "review" || view.status === "approved") && <button className="btn btn-ghost btn-sm h-auto justify-center whitespace-normal py-1.5 text-center leading-tight" disabled={!!busy} onClick={() => setStatus("draft")}>Вернуть в черновик</button>}
          <button className="btn btn-secondary btn-sm h-auto justify-center whitespace-normal py-1.5 text-center leading-tight" disabled={!!busy || blocked} onClick={() => createVersion(false)} title={blocked ? BLOCKED_MESSAGE : "Зафиксировать документ и расчёт, сформировать файлы"}>
            {busy === "version" ? "Фиксация…" : "Создать версию"}
          </button>
          <button className="btn btn-primary btn-sm h-auto justify-center whitespace-normal py-1.5 text-center leading-tight" disabled={!!busy || blocked} onClick={() => setConfirmFinal(true)}>
            {busy === "final" ? "Формирование…" : "Сформировать финальную версию"}
          </button>
        </div>
        {blocked && (
          <p className="mt-2 text-[12px] leading-snug text-err">
            {view.calc.hasResult ? BLOCKED_MESSAGE : "Расчёт ещё не выполнен."}{" "}
            <button className="underline-offset-2 hover:underline" onClick={() => go(view.calc.hasResult ? "checks" : "comparables")}>Перейти</button>
          </p>
        )}
        {!blocked && view.calc.isStale && <p className="mt-2 text-[12px] leading-snug text-muted">Расчёт не подтверждён — он будет подтверждён при фиксации версии.</p>}
      </section>

      <nav className="card p-2" aria-label="Структура отчёта">
        <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Структура</div>
        {content.sections.map((s) => {
          const n = s.numbered ? ++num : null;
          const hasIssue = s.blocks.some((b) => {
            const r = resolved.get(b.id);
            return r && (r.autoChanged || (r.type === "text" && r.missing.length > 0 && !r.manual));
          });
          return (
            <button key={s.id} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-zinc-700 hover:bg-subtle" onClick={() => document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <span className="num w-5 shrink-0 text-muted">{n ?? ""}</span>
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              {hasIssue && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" title="Есть блоки, требующие внимания" />}
            </button>
          );
        })}
        <button className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-brand hover:bg-subtle" onClick={() => edit((c) => ({ ...c, sections: [...c.sections, { id: uid(), title: "Новый раздел", numbered: true, custom: true, blocks: [{ id: uid(), type: "text", style: "p", text: "" }] }] }))}>
          <Icon name="plus" size={13} />Добавить раздел
        </button>
      </nav>
    </div>
  );

  // ───────── центр: документ
  num = 0;
  const editor = (
    <div className={`bg-white px-6 py-8 shadow-[0_1px_3px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.05)] sm:px-12 ${DOC_FONT}`}>
      {content.sections.map((s) => {
        const n = s.numbered ? ++num : null;
        return (
          <section key={s.id} id={`sec-${s.id}`} className="scroll-mt-4">
            {s.numbered && (
              <h2 className="mb-2 mt-6 flex items-baseline gap-2 text-[18.67px] font-bold leading-tight first:mt-0">
                <span>{n}.</span>
                {s.custom ? (
                  <input className="min-w-0 flex-1 bg-transparent outline-none focus:bg-[#f3f8f5]" value={s.title} onChange={(e) => edit((c) => ({ ...c, sections: c.sections.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) }))} />
                ) : (
                  <span>{s.title}</span>
                )}
              </h2>
            )}
            {s.blocks.map((b) => {
              const r = resolved.get(b.id);
              const isSel = selected === b.id;
              const ring = isSel ? "ring-2 ring-brand/50" : "hover:ring-1 hover:ring-line-strong";
              if (b.type === "text") {
                const rt = r && r.type === "text" ? r : null;
                const manual = b.text !== null && b.text !== undefined;
                const editing = isSel || manual || b.template === undefined;
                const value = manual ? b.text! : rt?.auto ?? "";
                return (
                  <div key={b.id} className={`relative -mx-2 mb-[6.67px] rounded px-2 ${ring}`} onClick={() => setSelected(b.id)}>
                    {(manual || rt?.autoChanged) && <span className={`absolute -left-3 top-1 h-[calc(100%-8px)] w-[3px] rounded ${rt?.autoChanged ? "bg-warn" : "bg-brand/60"}`} title={rt?.autoChanged ? "Данные оценки изменились после правки" : "Текст изменён оценщиком"} />}
                    {editing ? (
                      <TextArea
                        autoFocus={isSel && !manual}
                        className={TEXT_CLASS[b.style]}
                        value={value}
                        onChange={(v) => patchBlock(b.id, (x) => {
                          const t = x as DocTextBlock;
                          if (t.template !== undefined && rt?.auto !== undefined && rt.auto !== null && v === rt.auto) return { ...t, text: null, editedAutoHash: null };
                          return { ...t, text: v, editedAutoHash: t.editedAutoHash ?? (rt?.auto ? hashText(rt.auto) : null) };
                        })}
                      />
                    ) : (
                      <div className={`leading-[1.25] ${TEXT_CLASS[b.style]}`}>{rt ? <AutoText rb={rt} /> : value}</div>
                    )}
                  </div>
                );
              }
              const rd = r && r.type === "data" ? r : null;
              const blocks = b.edited?.blocks ?? rd?.auto ?? [];
              return (
                <div key={b.id} className={`relative -mx-2 mb-2 rounded px-2 pt-1 ${ring}`} onClick={() => setSelected(b.id)}>
                  <div className="mb-1 flex items-center gap-2 font-sans text-[11px] text-muted">
                    <span className="rounded bg-subtle px-1.5 py-0.5">{rd?.label ?? b.key}</span>
                    <span>{b.edited ? "изменено вручную" : "из оценки"}</span>
                    {rd?.autoChanged && <span className="text-warn">данные оценки изменились</span>}
                  </div>
                  <DocBlocks blocks={blocks} onChange={b.edited && isSel ? (nb) => patchBlock(b.id, (x) => ({ ...x, edited: { ...(x as { edited: { blocks: unknown; autoHash: string } }).edited, blocks: nb } } as RawBlock)) : undefined} />
                </div>
              );
            })}
            <button className="mb-2 mt-1 font-sans text-[12px] text-brand opacity-60 hover:opacity-100" onClick={() => {
              const id = uid();
              edit((c) => ({ ...c, sections: c.sections.map((x) => (x.id === s.id ? { ...x, blocks: [...x.blocks, { id, type: "text", style: "p", text: "" }] } : x)) }));
              setSelected(id);
            }}>+ абзац</button>
          </section>
        );
      })}
    </div>
  );

  // ───────── правая колонка: свойства выбранного блока
  const props = (
    <section className="card p-3 text-[12.5px]">
      {!sel && !selRaw ? (
        <p className="text-muted">Выберите блок документа, чтобы увидеть, откуда взяты данные, и изменить его.</p>
      ) : selRaw?.type === "text" ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between"><span className="font-medium text-ink">Текст</span><Badge tone={selRaw.text != null ? "brand" : "neutral"}>{selRaw.text != null ? "изменён" : selRaw.template === undefined ? "свой абзац" : "автоматический"}</Badge></div>
          {sel?.type === "text" && sel.fields.length > 0 && (
            <div>
              <div className="mb-1 text-muted">Данные из оценки</div>
              <ul className="space-y-1">
                {[...new Set(sel.fields)].map((f) => {
                  const seg = sel.segments?.find((x) => x.field === f);
                  const missing = sel.missing.includes(f);
                  return (
                    <li key={f} className="rounded bg-canvas px-2 py-1">
                      <div className="text-muted">{FIELD_BY_KEY.get(f)?.label ?? f}</div>
                      <div className={missing ? "text-warn" : "text-ink"}>{missing ? "не заполнено в оценке" : seg?.text ?? "см. текст"}</div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {sel?.type === "text" && sel.autoChanged && <Notice tone="warn">Данные оценки изменились после правки текста. Проверьте формулировку или верните автоматический текст.</Notice>}
          {selRaw.text != null && selRaw.template !== undefined && <button className="btn btn-secondary btn-sm w-full justify-center" onClick={() => patchBlock(selRaw.id, (x) => ({ ...(x as DocTextBlock), text: null, editedAutoHash: null }))}>Вернуть автоматический текст</button>}
          {selRaw.template === undefined && <button className="btn btn-ghost btn-sm w-full justify-center text-err" onClick={() => { patchBlock(selRaw.id, () => null); setSelected(null); }}><Icon name="trash" size={13} />Удалить абзац</button>}
          {selRaw.template === undefined && (
            <div><label className="label">Оформление</label>
              <select className="input py-1" value={selRaw.style} onChange={(e) => patchBlock(selRaw.id, (x) => ({ ...(x as DocTextBlock), style: e.target.value as DocTextBlock["style"] }))}>
                <option value="p">Абзац</option><option value="subheading">Подзаголовок</option><option value="center">По центру</option>
              </select>
            </div>
          )}
          {selSection?.custom && <button className="btn btn-ghost btn-sm w-full justify-center text-err" onClick={() => { edit((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== selSection.id) })); setSelected(null); }}>Удалить раздел «{selSection.title}»</button>}
        </div>
      ) : selRaw?.type === "data" && sel?.type === "data" ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2"><span className="font-medium text-ink">{sel.label}</span><Badge tone={selRaw.edited ? "brand" : "neutral"}>{selRaw.edited ? "изменено" : "из оценки"}</Badge></div>
          <p className="text-muted">Таблица формируется из данных оценки и расчёта. {sel.available ? "При изменении оценки она обновится автоматически, если не была отредактирована вручную." : "Данных пока нет."}</p>
          {sel.autoChanged && <Notice tone="warn">Данные оценки изменились после ручной правки таблицы. Обновите таблицу из оценки, чтобы отчёт совпадал с расчётом.</Notice>}
          {!selRaw.edited && sel.editable && sel.available && (
            <button className="btn btn-secondary btn-sm w-full justify-center" onClick={() => patchBlock(selRaw.id, (x) => ({ ...x, edited: { blocks: structuredClone(sel.auto), autoHash: hashBlocks(sel.auto) } } as RawBlock))}><Icon name="edit" size={13} />Редактировать таблицу</button>
          )}
          {!sel.editable && <p className="text-muted">Расчётный блок: редактируется только через данные оценки — так отчёт всегда совпадает с расчётом.</p>}
          {selRaw.edited && <button className="btn btn-secondary btn-sm w-full justify-center" onClick={() => patchBlock(selRaw.id, (x) => ({ ...x, edited: null } as RawBlock))}>Обновить из оценки (сбросить правки)</button>}
        </div>
      ) : (
        <p className="text-muted">Блок ещё не сохранён — подождите автосохранения.</p>
      )}
    </section>
  );

  const versions = (
    <section className="card text-[12.5px]">
      <header className="border-b border-line px-3 py-2.5 font-medium text-ink">Версии отчёта</header>
      {view.versions.length === 0 ? (
        <p className="px-3 py-3 text-muted">Версий пока нет. Версия фиксирует документ и подтверждённый расчёт и формирует DOCX, PDF и XLSX из одного снимка.</p>
      ) : (
        <ul className="divide-y divide-line">
          {view.versions.map((v) => (
            <li key={v.id} className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">№ {v.versionNumber}</span>
                <Badge tone={v.status === "final" ? "ok" : "neutral"}>{DOC_STATUS_LABEL[v.status as DocStatus] ?? v.status}</Badge>
              </div>
              <div className="mt-0.5 text-muted">{new Date(v.createdAt).toLocaleString("ru-RU")}{v.createdBy ? ` · ${v.createdBy}` : ""}</div>
              <div className="num mt-0.5 text-zinc-700">Расчёт № {v.calculationVersionNumber}: {fmtNumber(v.finalValue, 0)} ₽</div>
              {v.outdated && <div className="mt-0.5 text-warn">Данные оценки изменились после этой версии</div>}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {v.docxFileId && <a className="btn btn-secondary btn-sm" href={`/api/files/${v.docxFileId}`}><Icon name="download" size={12} />DOCX</a>}
                {v.pdfFileId && <a className="btn btn-secondary btn-sm" href={`/api/files/${v.pdfFileId}`}><Icon name="download" size={12} />PDF</a>}
                {v.xlsxFileId && <a className="btn btn-secondary btn-sm" href={`/api/files/${v.xlsxFileId}`}><Icon name="download" size={12} />XLSX</a>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div>
      {lastFinal?.outdated && (
        <Notice tone="warn" className="mb-4">Данные оценки изменились после финальной версии № {lastFinal.versionNumber}. Финальная версия сохранена без изменений; для актуальных данных сформируйте новую версию.</Notice>
      )}
      {error && <Notice tone="err" className="mb-4" title={error.title}>{error.items?.slice(0, 8).map((x, i) => <div key={i}>• {x}</div>)}</Notice>}
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_290px]">
        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">{left}</div>
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented size="sm" value={mode} onChange={(m) => (m === "preview" ? showPreview() : setMode("editor"))} options={[["editor", "Редактор"], ["preview", "Предпросмотр"]]} />
            <span className="ml-auto text-[12px] text-muted">
              {save === "saving" ? "Сохранение…" : save === "dirty" ? "Есть несохранённые изменения" : save === "error" ? <span className="text-err">Не сохранено</span> : savedAt ? `Сохранено ${new Date(savedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "Черновик сохраняется автоматически"}
            </span>
          </div>
          {mode === "editor" ? editor : preview ? <PagedPreview doc={preview} /> : <div className="card h-96 animate-pulse" />}
        </div>
        <div className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          {mode === "editor" && props}
          {versions}
        </div>
      </div>
      <ConfirmModal open={confirmFinal} tone="primary" confirmLabel="Сформировать" title="Сформировать финальную версию?" onClose={() => setConfirmFinal(false)} onConfirm={() => createVersion(true)}>
        Будет подтверждён текущий расчёт (неизменяемый снимок) и сформированы DOCX, PDF и XLSX из одних данных. Последующие изменения оценки не изменят эту версию — для них создаётся новая.
      </ConfirmModal>
    </div>
  );
}
