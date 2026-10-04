"use client";

import { useRef, useState } from "react";
import { api, errorText } from "@/lib/api";
import { Field, NumInput, Select, TextArea, TextInput, TriState } from "@/components/ui/Field";
import { useDraft } from "@/components/ui/useDraft";
import { Icon } from "@/components/ui/Icon";
import { ConfirmModal, EmptyState, Modal, Notice, toast } from "@/components/ui/kit";
import { CONDITION_OPTIONS, FINISHING_OPTIONS, WALL_OPTIONS, label } from "@/lib/labels";
import { fmtDate, fmtNumber, isoDate } from "@/core/format";
import { d } from "@/core/calc/decimal";
import { NextStep, StepIssues } from "./common";
import type { WsProps } from "./Workspace";
import type { ComparableRow } from "./types";

const EMPTY = {
  sourceName: "", sourceUrl: "", retrievedAt: new Date().toISOString().slice(0, 10), offerDate: "", address: "",
  price: "", area: "", rooms: "", floor: "", floors: "", wallMaterial: "", yearBuilt: "", finishing: "", furniture: null,
  houseCondition: "", metroDistanceM: "", rights: "Собственность", description: "",
};

function ComparableModal({ assessmentId, initial, onDone, onCancel }: { assessmentId: string; initial: ComparableRow | null; onDone: () => void; onCancel: () => void }) {
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

function SourceCell({ c }: { c: ComparableRow }) {
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

export function ComparablesTab({ detail, reload, calc, checklist, go }: WsProps) {
  const [editing, setEditing] = useState<ComparableRow | null | "new">(null);
  const [removing, setRemoving] = useState<ComparableRow | null>(null);
  const [importMsg, setImportMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const p = detail.property;
  const b = detail.building;
  const resById = Object.fromEntries((calc?.result?.comparables ?? []).map((c) => [c.id, c]));
  const items = checklist?.items.filter((i) => i.step === "comparables") ?? [];
  const differs = (a: unknown, s: unknown) => a !== null && a !== undefined && a !== "" && s !== null && s !== undefined && s !== "" && String(a) !== String(s);
  const hl = (on: boolean) => (on ? "bg-warn-soft/70" : "");

  async function toggle(c: ComparableRow) {
    await api.patch(`/api/assessments/${detail.id}/comparables/${c.id}`, { included: !c.included });
    toast(c.included ? "Аналог исключён из расчёта" : "Аналог включён в расчёт", "info");
    await reload();
  }
  async function remove(c: ComparableRow) {
    try {
      await api.del(`/api/assessments/${detail.id}/comparables/${c.id}`);
      toast("Аналог удалён");
      await reload();
    } catch (e) {
      toast(errorText(e), "err");
    } finally {
      setRemoving(null);
    }
  }
  async function importCsv(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await api.upload<{ imported: number; errors: string[] }>(`/api/assessments/${detail.id}/comparables/import`, fd);
      setImportMsg({ tone: "ok", text: `Импортировано аналогов: ${r.imported}${r.errors.length ? `. Замечания: ${r.errors.join("; ")}` : ""}` });
      await reload();
    } catch (e) {
      setImportMsg({ tone: "err", text: errorText(e) });
    }
  }

  const unitOf = (c: ComparableRow) => d(c.price).div(c.area);

  return (
    <div>
      <StepIssues items={items} go={go} />
      <section className="card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">Объекты-аналоги <span className="num ml-1 font-normal text-muted">{detail.comparables.filter((c) => c.included).length} в расчёте из {detail.comparables.length}</span></h2>
            <p className="mt-0.5 text-[12.5px] text-muted">Отличия от объекта оценки подсвечены. У каждого аналога должны быть ссылка, дата получения и скриншот.</p>
          </div>
          <div className="flex gap-2">
            <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { if (e.target.files?.[0]) importCsv(e.target.files[0]); e.target.value = ""; }} />
            <button className="btn btn-secondary" onClick={() => csvRef.current?.click()} title="Колонки: Ссылка; Источник; Дата получения; Адрес; Цена; Площадь; Комнаты; Этаж; Этажность; Материал; Год постройки; Отделка; Мебель; До метро">
              <Icon name="upload" size={15} />Импорт CSV
            </button>
            <button className="btn btn-primary" onClick={() => setEditing("new")}><Icon name="plus" size={15} />Добавить аналог</button>
          </div>
        </header>
        {importMsg && <div className="border-b border-line p-3"><Notice tone={importMsg.tone}>{importMsg.text}</Notice></div>}

        {detail.comparables.length === 0 ? (
          <EmptyState icon="building" title="Аналоги ещё не добавлены" action={<button className="btn btn-primary" onClick={() => setEditing("new")}><Icon name="plus" size={15} />Добавить аналог</button>}>
            Добавьте не менее трёх рыночных предложений: по ссылке на объявление со скриншотом или импортом из CSV. Корректировки рассчитаются автоматически.
          </EmptyState>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="tbl tbl-hover min-w-[980px] text-[13px]">
                <thead>
                  <tr>
                    <th className="w-14" title="Включён в расчёт">№</th>
                    <th>Адрес</th>
                    <th>Источник</th>
                    <th className="text-right">Цена, ₽</th>
                    <th className="text-right">Площадь, м²</th>
                    <th className="text-right">Цена/м², ₽</th>
                    <th className="text-center">Комн.</th>
                    <th className="text-center">Этаж</th>
                    <th>Материал</th>
                    <th>Состояние</th>
                    <th>Дата</th>
                    <th className="w-0"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-brand-soft/40 hover:bg-brand-soft/40">
                    <td className="text-[11px] font-semibold uppercase text-brand">Объект</td>
                    <td className="max-w-[160px] truncate font-medium">{(p.address as string) || "—"}</td>
                    <td className="text-[12px] text-muted">оценка на {fmtDate(detail.valuationDate)}</td>
                    <td></td>
                    <td className="num text-right">{p.area ? fmtNumber(p.area as string, 2, true) : "—"}</td>
                    <td className="num text-right text-[12px] text-muted">{calc?.result ? `≈ ${fmtNumber(calc.result.weightedUnitPrice, 0)}` : ""}</td>
                    <td className="num text-center">{(p.rooms as number) ?? "—"}</td>
                    <td className="num text-center">{(p.floor as number) ?? "—"}/{(b.floors as number) ?? "—"}</td>
                    <td>{label(WALL_OPTIONS, b.wallMaterial as string)}</td>
                    <td className="text-[12.5px]">{label(FINISHING_OPTIONS, p.finishing as string)}</td>
                    <td></td>
                    <td></td>
                  </tr>
                  {detail.comparables.map((c, i) => {
                    const r = resById[c.id];
                    return (
                      <tr key={c.id} className={`cursor-pointer ${c.included ? "" : "text-muted opacity-60"}`} onClick={() => setEditing(c)}>
                        <td onClick={(e) => e.stopPropagation()}>
                          <label className="flex cursor-pointer items-center gap-2" title={c.included ? "Включён в расчёт" : "Исключён из расчёта"}>
                            <input type="checkbox" className="h-4 w-4 accent-[#176b4d]" checked={c.included} onChange={() => toggle(c)} aria-label="Включить в расчёт" />
                            <span className="num font-medium">{i + 1}</span>
                          </label>
                        </td>
                        <td className="max-w-[160px]">
                          <div className="truncate" title={c.address ?? ""}>{c.address ?? <span className="text-err">адрес не указан</span>}</div>
                          {r && <div className="num text-[11.5px] text-muted">скорр. {fmtNumber(r.adjustedUnitPrice, 0)} ₽/м²</div>}
                        </td>
                        <td><SourceCell c={c} /></td>
                        <td className="num text-right font-semibold">{fmtNumber(c.price, 0)}</td>
                        <td className={`num text-right ${hl(differs(c.area, p.area))}`}>{fmtNumber(c.area, 2, true)}</td>
                        <td className="num text-right font-semibold text-ink">{fmtNumber(unitOf(c), 0)}</td>
                        <td className={`num text-center ${hl(differs(c.rooms, p.rooms))}`}>{c.rooms ?? "—"}</td>
                        <td className={`num text-center ${hl(c.floor === 1 || (!!c.floor && c.floor === c.floors))}`}>{c.floor ?? "—"}/{c.floors ?? "—"}</td>
                        <td className={hl(differs(c.wallMaterial, b.wallMaterial))}>{label(WALL_OPTIONS, c.wallMaterial)}</td>
                        <td className={`text-[12.5px] ${hl(differs(c.finishing, p.finishing))}`}>
                          {label(FINISHING_OPTIONS, c.finishing)}
                          {c.furniture !== null && <div className={`text-[11.5px] ${differs(c.furniture, p.furniture) ? "text-warn" : "text-muted"}`}>{c.furniture ? "с мебелью" : "без мебели"}</div>}
                        </td>
                        <td className="num text-[12.5px]">{fmtDate(c.offerDate ?? c.retrievedAt)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            {c.screenshotFileId ? (
                              <a className="rounded p-1.5 text-muted hover:bg-subtle hover:text-ink" href={`/api/files/${c.screenshotFileId}?inline=1`} target="_blank" rel="noreferrer" title="Скриншот объявления"><Icon name="image" size={15} /></a>
                            ) : (
                              <span className="rounded p-1.5 text-warn" title="Нет скриншота"><Icon name="image" size={15} /></span>
                            )}
                            <button className="rounded p-1.5 text-muted hover:bg-subtle hover:text-ink" onClick={() => setEditing(c)} title="Редактировать"><Icon name="edit" size={15} /></button>
                            <button className="rounded p-1.5 text-muted hover:bg-err-soft hover:text-err" onClick={() => setRemoving(c)} title="Удалить"><Icon name="trash" size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line lg:hidden">
              {detail.comparables.map((c, i) => (
                <li key={c.id} className={`px-4 py-3 ${c.included ? "" : "opacity-60"}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[#176b4d]" checked={c.included} onChange={() => toggle(c)} aria-label="Включить в расчёт" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">Аналог {i + 1}</span>
                        <span className="num text-[14px] font-semibold">{fmtNumber(unitOf(c), 0)} ₽/м²</span>
                      </div>
                      <div className="truncate text-[13px] text-zinc-700">{c.address ?? "адрес не указан"}</div>
                      <div className="num mt-1 text-[12px] text-muted">{fmtNumber(c.price, 0)} ₽ · {fmtNumber(c.area, 2, true)} м² · {c.floor ?? "—"}/{c.floors ?? "—"} эт. · {fmtDate(c.offerDate ?? c.retrievedAt)}</div>
                      <div className="mt-2 flex items-center gap-2"><SourceCell c={c} /><button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>Изменить</button><button className="btn btn-ghost btn-sm text-err" onClick={() => setRemoving(c)}>Удалить</button></div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="border-t border-line bg-canvas/60 px-4 py-2.5 text-[12px] text-muted">
          Аналоги вносятся вручную или из CSV. Автоматический подбор аналогов появится после подключения легальных источников данных.
        </div>
      </section>
      {detail.comparables.length > 0 && <NextStep to="adjustments" go={go} />}
      {editing && (
        <ComparableModal
          assessmentId={detail.id}
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onDone={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
      <ConfirmModal open={!!removing} title="Удалить аналог?" onClose={() => setRemoving(null)} onConfirm={() => removing && remove(removing)}>
        Аналог и его корректировки будут удалены из оценки. Зафиксированные версии расчёта не изменятся.
      </ConfirmModal>
    </div>
  );
}
