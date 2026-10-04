"use client";

import { useRef, useState } from "react";
import { api, errorText } from "@/lib/api";
import { Field, NumInput, SaveBar, Select, SourceTag, TextArea, TextInput, TriState } from "@/components/ui/Field";
import { useDraft } from "@/components/ui/useDraft";
import { Icon } from "@/components/ui/Icon";
import { ConfirmModal, Notice, Panel, toast } from "@/components/ui/kit";
import { CONDITION_OPTIONS, FINISHING_OPTIONS, WALL_OPTIONS } from "@/lib/labels";
import { fmtDate } from "@/core/format";
import { NextStep, StepIssues } from "./common";
import type { WsProps } from "./Workspace";
import type { Provenance } from "./types";

const P_KEYS = ["objectType", "address", "cadastralNumber", "area", "livingArea", "kitchenArea", "purpose", "rights", "rightHolders", "encumbrances", "rooms", "floor", "ceilingHeight", "finishing", "condition", "furniture", "balcony", "bathroom", "communications", "metroName", "metroDistanceM", "district", "description"] as const;
const B_KEYS = ["cadastralNumber", "yearBuilt", "floors", "wallMaterial", "series", "houseCondition", "elevators", "parking", "overhaulYear", "description"] as const;

const pick = (o: Record<string, unknown>, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));

export function PropertyTab({ detail, reload, checklist, go }: WsProps) {
  const prop = useDraft(pick(detail.property, P_KEYS));
  const bld = useDraft(pick(detail.building, B_KEYS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [egrn, setEgrn] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const egrnRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const pv = detail.property.provenance as Provenance;
  const bv = detail.building.provenance as Provenance;
  const P = prop.draft, sP = prop.set, B = bld.draft, sB = bld.set;
  const src = (prov: Provenance, k: string) => <SourceTag source={prov?.[k]?.source} title={prov?.[k]?.title} at={prov?.[k]?.at} />;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/assessments/${detail.id}/property`, {
        ...(prop.dirty ? { property: prop.changes } : {}),
        ...(bld.dirty ? { building: bld.changes } : {}),
      });
      toast("Данные объекта сохранены");
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadEgrn(f: File) {
    setEgrn({ tone: "info", text: `Загрузка «${f.name}»…` });
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await api.upload<{ applied: string[]; extracted: { recognized: string[] } | null }>(`/api/assessments/${detail.id}/egrn`, fd);
      setEgrn(
        r.extracted
          ? { tone: "ok", text: `Распознано полей: ${r.extracted.recognized.length}. Заполнено пустых: ${r.applied.length}. Расхождения с введёнными данными показаны в проверках.` }
          : { tone: "info", text: "PDF-выписка сохранена как документ. Внесите данные вручную." },
      );
      await reload();
    } catch (e) {
      setEgrn({ tone: "err", text: errorText(e) });
    }
  }

  async function uploadFiles(files: FileList, kind: "photo" | "document") {
    const fd = new FormData();
    fd.append("kind", kind);
    for (const f of Array.from(files)) fd.append("file", f);
    try {
      await api.upload(`/api/assessments/${detail.id}/files`, fd);
      toast(kind === "photo" ? "Фотографии добавлены" : "Документ добавлен");
      await reload();
    } catch (e) {
      toast(errorText(e), "err");
    }
  }

  async function removeFile(id: string) {
    try {
      await api.del(`/api/files/${id}`);
      toast("Файл удалён");
      await reload();
    } catch (e) {
      toast(errorText(e), "err");
    } finally {
      setRemoving(null);
    }
  }

  const photos = detail.files.filter((f) => f.kind === "photo");
  const docs = detail.files.filter((f) => f.kind === "document" || f.kind === "egrn");
  const egrnSources = detail.sources.filter((s) => s.kind.startsWith("egrn"));
  const items = checklist?.items.filter((i) => i.step === "property") ?? [];

  return (
    <div>
      <StepIssues items={items} go={go} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel title="Основные характеристики">
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Адрес" required className="sm:col-span-2 lg:col-span-3" source={src(pv, "address")}><TextInput d={P} k="address" set={sP} /></Field>
              <Field label="Вид объекта"><TextInput d={P} k="objectType" set={sP} /></Field>
              <Field label="Кадастровый номер" required source={src(pv, "cadastralNumber")}><TextInput d={P} k="cadastralNumber" set={sP} placeholder="77:01:0001001:1234" /></Field>
              <Field label="Общая площадь" required source={src(pv, "area")}><NumInput d={P} k="area" set={sP} suffix="м²" /></Field>
              <Field label="Жилая площадь"><NumInput d={P} k="livingArea" set={sP} suffix="м²" /></Field>
              <Field label="Площадь кухни"><NumInput d={P} k="kitchenArea" set={sP} suffix="м²" /></Field>
              <Field label="Комнат" required><NumInput d={P} k="rooms" set={sP} /></Field>
              <Field label="Этаж" required source={src(pv, "floor")}><NumInput d={P} k="floor" set={sP} /></Field>
              <Field label="Этажность дома" required source={src(bv, "floors")}><NumInput d={B} k="floors" set={sB} /></Field>
              <Field label="Назначение" source={src(pv, "purpose")}><TextInput d={P} k="purpose" set={sP} /></Field>
              <Field label="Материал стен" required source={src(bv, "wallMaterial")}><Select d={B} k="wallMaterial" set={sB} options={WALL_OPTIONS} /></Field>
              <Field label="Год постройки" source={src(bv, "yearBuilt")}><NumInput d={B} k="yearBuilt" set={sB} /></Field>
              <Field label="Высота потолков"><NumInput d={P} k="ceilingHeight" set={sP} suffix="м" /></Field>
            </div>
          </Panel>

          <Panel title="Состояние и отделка">
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Отделка"><Select d={P} k="finishing" set={sP} options={FINISHING_OPTIONS} /></Field>
              <Field label="Мебель"><TriState d={P} k="furniture" set={sP} yes="С мебелью" no="Без мебели" /></Field>
              <Field label="Состояние квартиры"><TextInput d={P} k="condition" set={sP} /></Field>
              <Field label="Санузел"><TextInput d={P} k="bathroom" set={sP} /></Field>
              <Field label="Балкон / лоджия"><TextInput d={P} k="balcony" set={sP} /></Field>
              <Field label="Коммуникации" className="sm:col-span-2 lg:col-span-3"><TextInput d={P} k="communications" set={sP} /></Field>
              <Field label="Описание объекта" className="sm:col-span-2 lg:col-span-4"><TextArea d={P} k="description" set={sP} rows={3} /></Field>
            </div>
          </Panel>

          <Panel title="Правовые сведения">
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Вид права" source={src(pv, "rights")}><TextInput d={P} k="rights" set={sP} /></Field>
              <Field label="Правообладатель" className="lg:col-span-2"><TextInput d={P} k="rightHolders" set={sP} /></Field>
              <Field label="Обременения" source={src(pv, "encumbrances")}><TextInput d={P} k="encumbrances" set={sP} /></Field>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Здание">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Кадастровый номер здания"><TextInput d={B} k="cadastralNumber" set={sB} /></Field>
                <Field label="Серия"><TextInput d={B} k="series" set={sB} /></Field>
                <Field label="Техническое состояние"><Select d={B} k="houseCondition" set={sB} options={CONDITION_OPTIONS} /></Field>
                <Field label="Год капремонта"><NumInput d={B} k="overhaulYear" set={sB} /></Field>
                <Field label="Лифты"><TextInput d={B} k="elevators" set={sB} /></Field>
                <Field label="Парковка"><TextInput d={B} k="parking" set={sB} /></Field>
                <Field label="Описание здания" className="col-span-2"><TextArea d={B} k="description" set={sB} rows={2} /></Field>
              </div>
            </Panel>
            <Panel title="Местоположение">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Район"><TextInput d={P} k="district" set={sP} /></Field>
                <Field label="Ближайшее метро"><TextInput d={P} k="metroName" set={sP} /></Field>
                <Field label="Расстояние до метро" hint="Используется в корректировке на транспортную доступность"><NumInput d={P} k="metroDistanceM" set={sP} suffix="м" /></Field>
              </div>
              <p className="mt-3 text-[12px] text-muted">Расстояния вводятся вручную. Автоматический расчёт по карте появится после подключения картографического сервиса.</p>
            </Panel>
          </div>
        </div>

        <div className="space-y-4">
          <Panel
            title="Выписка ЕГРН"
            actions={
              <>
                <input ref={egrnRef} type="file" accept=".xml,.pdf,application/xml,text/xml,application/pdf" hidden onChange={(e) => { if (e.target.files?.[0]) uploadEgrn(e.target.files[0]); e.target.value = ""; }} />
                <button className="btn btn-secondary btn-sm" onClick={() => egrnRef.current?.click()}><Icon name="upload" size={14} />Загрузить</button>
              </>
            }
          >
            <p className="text-[12.5px] text-muted">XML-выписка заполняет пустые поля и сверяется с уже введёнными данными. Поля с меткой <span className="rounded bg-brand-soft px-1 text-[10.5px] font-medium uppercase text-brand">ЕГРН</span> получены из выписки.</p>
            {egrn && <Notice tone={egrn.tone} className="mt-3">{egrn.text}</Notice>}
            {egrnSources.length > 0 ? (
              <ul className="mt-3 divide-y divide-line rounded-md border border-line">
                {egrnSources.map((s) => (
                  <li key={s.id} className="flex items-center gap-2.5 px-3 py-2 text-[13px]">
                    <Icon name="doc" size={16} className="text-brand" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-ink">{s.title}</div>
                      <div className="text-[11.5px] text-muted">получено {fmtDate(s.retrievedAt)}{s.extracted ? ` · распознано полей: ${(s.extracted as { recognized?: string[] }).recognized?.length ?? 0}` : ""}</div>
                    </div>
                    {s.fileId && <a href={`/api/files/${s.fileId}`} className="text-muted hover:text-ink" title="Скачать"><Icon name="download" size={15} /></a>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 rounded-md border border-dashed border-line-strong px-3 py-4 text-center text-[12.5px] text-muted">Выписка ещё не загружена</div>
            )}
          </Panel>

          <Panel
            title={`Фотографии · ${photos.length}`}
            actions={
              <>
                <input ref={photoRef} type="file" accept="image/png,image/jpeg" multiple hidden onChange={(e) => { if (e.target.files) uploadFiles(e.target.files, "photo"); e.target.value = ""; }} />
                <button className="btn btn-secondary btn-sm" onClick={() => photoRef.current?.click()}><Icon name="plus" size={14} />Добавить</button>
              </>
            }
          >
            {photos.length ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((f) => (
                  <div key={f.id} className="group relative">
                    <a href={`/api/files/${f.id}?inline=1`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${f.id}?inline=1`} alt={f.filename} className="aspect-square w-full rounded-md border border-line object-cover" />
                    </a>
                    <button className="absolute right-1 top-1 hidden rounded bg-white/95 p-1 text-err shadow group-hover:block" onClick={() => setRemoving(f.id)} aria-label="Удалить фото"><Icon name="trash" size={13} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted">Фотографии объекта попадут в приложение к отчёту.</p>
            )}
          </Panel>

          <Panel
            title={`Документы · ${docs.length}`}
            actions={
              <>
                <input ref={docRef} type="file" accept="image/png,image/jpeg,application/pdf" multiple hidden onChange={(e) => { if (e.target.files) uploadFiles(e.target.files, "document"); e.target.value = ""; }} />
                <button className="btn btn-secondary btn-sm" onClick={() => docRef.current?.click()}><Icon name="plus" size={14} />Добавить</button>
              </>
            }
            bodyClassName=""
          >
            {docs.length ? (
              <ul className="divide-y divide-line">
                {docs.map((f) => (
                  <li key={f.id} className="flex items-center gap-2.5 px-4 py-2 text-[13px]">
                    <Icon name="file" size={15} className="text-muted" />
                    <a href={`/api/files/${f.id}`} className="min-w-0 flex-1 truncate text-ink hover:text-brand">{f.caption ?? f.filename}</a>
                    <span className="text-[11.5px] text-muted">{fmtDate(f.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-[12.5px] text-muted">Правоустанавливающие документы, техпаспорт, выписки.</p>
            )}
          </Panel>
        </div>
      </div>
      <SaveBar dirty={prop.dirty || bld.dirty} busy={busy} onSave={save} onReset={() => { prop.reset(); bld.reset(); }} error={error} />
      {!(prop.dirty || bld.dirty) && <NextStep to="comparables" go={go} />}
      <ConfirmModal open={!!removing} title="Удалить файл?" onClose={() => setRemoving(null)} onConfirm={() => removing && removeFile(removing)}>
        Файл будет удалён из оценки. Файлы, использованные в зафиксированной версии расчёта, удалить нельзя.
      </ConfirmModal>
    </div>
  );
}
