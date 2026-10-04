"use client";

import { useRef, useState } from "react";
import { api, errorText } from "@/lib/api";
import { Field, NumInput, SaveBar, Select, SourceTag, TextArea, TextInput, TriState } from "@/components/ui/Field";
import { useDraft } from "@/components/ui/useDraft";
import { Icon } from "@/components/ui/Icon";
import { ConfirmModal, Notice, Panel, toast } from "@/components/ui/kit";
import { CONDITION_OPTIONS, FINISHING_OPTIONS, WALL_OPTIONS } from "@/lib/labels";
import { fmtDate, fmtNumber } from "@/core/format";
import type { InfrastructureSnapshot } from "@/core/infrastructure";
import { NextStep, StepIssues } from "./common";
import { InfrastructurePanel, mapUrl } from "./InfrastructurePanel";
import { AddressInput } from "./AddressInput";
import type { AddressDetails, AddressSuggestion } from "@/core/address";
import { EnvironmentMap, infraPoints, subjectPoint, type MapPoint } from "./EnvironmentMap";
import { STATUS_LABEL } from "./ComparableCard";
import type { WsProps } from "./Workspace";
import type { Provenance } from "./types";

const P_KEYS = ["objectType", "address", "cadastralNumber", "area", "livingArea", "kitchenArea", "purpose", "rights", "rightHolders", "encumbrances", "rooms", "floor", "ceilingHeight", "finishing", "condition", "furniture", "balcony", "bathroom", "communications", "metroName", "metroDistanceM", "district", "description", "latitude", "longitude", "fiasId"] as const;
const B_KEYS = ["cadastralNumber", "yearBuilt", "floors", "wallMaterial", "series", "houseCondition", "elevators", "parking", "overhaulYear", "description"] as const;

const pick = (o: Record<string, unknown>, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));

export function PropertyTab({ detail, reload, checklist, go }: WsProps) {
  const prop = useDraft(pick(detail.property, P_KEYS));
  const bld = useDraft(pick(detail.building, B_KEYS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [egrn, setEgrn] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState<"geocode" | "reverse" | "infra" | null>(null);
  const [geoMsg, setGeoMsg] = useState<{ tone: "ok" | "err" | "info"; text: string; address?: string; top?: boolean } | null>(null);
  const egrnRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const pv = detail.property.provenance as Provenance;
  const bv = detail.building.provenance as Provenance;
  const P = prop.draft, sP = prop.set, B = bld.draft, sB = bld.set;
  const src = (prov: Provenance, k: string) => <SourceTag source={prov?.[k]?.source} title={prov?.[k]?.title} at={prov?.[k]?.at} />;

  const persist = () =>
    api.put<{ ok: boolean; geocode: { updated: boolean; warning: string | null } | null }>(`/api/assessments/${detail.id}/property`, {
      ...(prop.dirty ? { property: prop.changes } : {}),
      ...(bld.dirty ? { building: bld.changes } : {}),
    });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await persist();
      toast("Данные объекта сохранены");
      if (r.geocode?.updated) setGeoMsg({ tone: "ok", text: "Адрес изменён — координаты объекта определены заново.", top: true });
      else if (r.geocode?.warning) setGeoMsg({ tone: "info", text: r.geocode.warning, top: true });
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  /** Выбор подсказки: сервер сохраняет адрес, ГАР-идентификаторы, разобранный адрес и координаты. */
  async function pickAddress(sg: AddressSuggestion) {
    sP("address", sg.fullAddress);
    setGeoBusy("geocode");
    setGeoMsg(null);
    try {
      const { address: _a, fiasId: _f, ...rest } = prop.changes;
      void _a; void _f;
      if (Object.keys(rest).length || bld.dirty) {
        await api.put(`/api/assessments/${detail.id}/property`, { ...(Object.keys(rest).length ? { property: rest } : {}), ...(bld.dirty ? { building: bld.changes } : {}) });
      }
      const r = await api.post<{ lat: number | null; lon: number | null; precisionLabel: string | null; warning: string | null }>(`/api/assessments/${detail.id}/location`, { action: "select", suggestion: sg });
      setGeoMsg(r.lat !== null && r.lon !== null
        ? { tone: "ok", top: true, text: `Адрес сохранён (${sg.source === "gar" ? "ГАР" : "Яндекс Геокодер"}), координаты: ${r.lat.toFixed(6)}, ${r.lon.toFixed(6)}${r.precisionLabel ? ` — ${r.precisionLabel}` : ""}.` }
        : { tone: "info", top: true, text: r.warning ?? "Адрес сохранён, координаты не определены." });
      await reload();
    } catch (e) {
      setGeoMsg({ tone: "err", text: errorText(e), top: true });
    } finally {
      setGeoBusy(null);
    }
  }

  /** Действия с картографическим сервисом. Несохранённые правки сначала сохраняются,
   *  чтобы координаты и инфраструктура соответствовали сохранённому адресу. */
  async function locate(action: "geocode" | "reverse" | "infra") {
    setGeoBusy(action);
    setGeoMsg(null);
    try {
      if (action === "reverse") {
        const r = await api.post<{ address: string }>(`/api/assessments/${detail.id}/location`, { action: "reverse", lat: P.latitude, lon: P.longitude });
        setGeoMsg({ tone: "info", text: `По координатам найден адрес: ${r.address}`, address: r.address });
        return;
      }
      if (prop.dirty || bld.dirty) await persist();
      if (action === "geocode") {
        const r = await api.post<{ lat: number; lon: number; formatted: string; precisionLabel: string }>(`/api/assessments/${detail.id}/location`, { action: "geocode", address: P.address });
        setGeoMsg({ tone: "ok", text: `Координаты определены: ${r.lat.toFixed(6)}, ${r.lon.toFixed(6)} — «${r.formatted}» (${r.precisionLabel}).` });
      } else {
        await api.post(`/api/assessments/${detail.id}/location`, { action: "infrastructure" });
        toast("Инфраструктура получена и сохранена в оценке");
      }
      await reload();
    } catch (e) {
      setGeoMsg({ tone: "err", text: errorText(e) });
    } finally {
      setGeoBusy(null);
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

  const envPoints: MapPoint[] = [
    ...[subjectPoint(detail.property.latitude, detail.property.longitude, detail.property.address)].filter((x): x is MapPoint => !!x),
    ...detail.comparables
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => ({
        id: `cmp:${c.id}`, kind: "comparable" as const, status: c.status, caption: String(detail.comparables.indexOf(c) + 1), lat: Number(c.latitude), lon: Number(c.longitude),
        title: `Аналог ${detail.comparables.indexOf(c) + 1} · ${STATUS_LABEL[c.status]}`,
        lines: [c.address ?? "", c.distanceM !== null ? `${fmtNumber(c.distanceM, 0)} м от объекта` : ""].filter(Boolean),
      })),
    ...infraPoints((detail.property.infrastructure as InfrastructureSnapshot | null) ?? null),
  ];
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
              <Field field="address" label="Адрес" required className="sm:col-span-2 lg:col-span-3" source={src(pv, "address")}><AddressInput value={String(P.address ?? "")} onChange={(v) => sP("address", v)} onPick={pickAddress} /></Field>
              <Field field="objectType" label="Вид объекта"><TextInput d={P} k="objectType" set={sP} /></Field>
              <Field field="cadastralNumber" label="Кадастровый номер" required source={src(pv, "cadastralNumber")}><TextInput d={P} k="cadastralNumber" set={sP} placeholder="77:01:0001001:1234" /></Field>
              <Field field="area" label="Общая площадь" required source={src(pv, "area")}><NumInput d={P} k="area" set={sP} suffix="м²" /></Field>
              <Field field="livingArea" label="Жилая площадь"><NumInput d={P} k="livingArea" set={sP} suffix="м²" /></Field>
              <Field field="kitchenArea" label="Площадь кухни"><NumInput d={P} k="kitchenArea" set={sP} suffix="м²" /></Field>
              <Field field="rooms" label="Комнат" required><NumInput d={P} k="rooms" set={sP} /></Field>
              <Field field="floor" label="Этаж" required source={src(pv, "floor")}><NumInput d={P} k="floor" set={sP} /></Field>
              <Field field="building.floors" label="Этажность дома" required source={src(bv, "floors")}><NumInput d={B} k="floors" set={sB} /></Field>
              <Field field="purpose" label="Назначение" source={src(pv, "purpose")}><TextInput d={P} k="purpose" set={sP} /></Field>
              <Field field="building.wallMaterial" label="Материал стен" required source={src(bv, "wallMaterial")}><Select d={B} k="wallMaterial" set={sB} options={WALL_OPTIONS} /></Field>
              <Field field="building.yearBuilt" label="Год постройки" source={src(bv, "yearBuilt")}><NumInput d={B} k="yearBuilt" set={sB} /></Field>
              <Field field="ceilingHeight" label="Высота потолков"><NumInput d={P} k="ceilingHeight" set={sP} suffix="м" /></Field>
            </div>
          </Panel>

          <Panel title="Состояние и отделка">
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field field="finishing" label="Отделка"><Select d={P} k="finishing" set={sP} options={FINISHING_OPTIONS} /></Field>
              <Field field="furniture" label="Мебель"><TriState d={P} k="furniture" set={sP} yes="С мебелью" no="Без мебели" /></Field>
              <Field field="condition" label="Состояние квартиры"><TextInput d={P} k="condition" set={sP} /></Field>
              <Field field="bathroom" label="Санузел"><TextInput d={P} k="bathroom" set={sP} /></Field>
              <Field field="balcony" label="Балкон / лоджия"><TextInput d={P} k="balcony" set={sP} /></Field>
              <Field field="communications" label="Коммуникации" className="sm:col-span-2 lg:col-span-3"><TextInput d={P} k="communications" set={sP} /></Field>
              <Field field="description" label="Описание объекта" className="sm:col-span-2 lg:col-span-4"><TextArea d={P} k="description" set={sP} rows={3} /></Field>
            </div>
          </Panel>

          <Panel title="Правовые сведения">
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field field="rights" label="Вид права" source={src(pv, "rights")}><TextInput d={P} k="rights" set={sP} /></Field>
              <Field field="rightHolders" label="Правообладатель" className="lg:col-span-2"><TextInput d={P} k="rightHolders" set={sP} /></Field>
              <Field field="encumbrances" label="Обременения" source={src(pv, "encumbrances")}><TextInput d={P} k="encumbrances" set={sP} /></Field>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Здание">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field field="building.cadastralNumber" label="Кадастровый номер здания"><TextInput d={B} k="cadastralNumber" set={sB} /></Field>
                <Field field="building.series" label="Серия"><TextInput d={B} k="series" set={sB} /></Field>
                <Field field="building.houseCondition" label="Техническое состояние"><Select d={B} k="houseCondition" set={sB} options={CONDITION_OPTIONS} /></Field>
                <Field field="building.overhaulYear" label="Год капремонта"><NumInput d={B} k="overhaulYear" set={sB} /></Field>
                <Field field="building.elevators" label="Лифты"><TextInput d={B} k="elevators" set={sB} /></Field>
                <Field field="building.parking" label="Парковка"><TextInput d={B} k="parking" set={sB} /></Field>
                <Field field="building.description" label="Описание здания" className="col-span-2"><TextArea d={B} k="description" set={sB} rows={2} /></Field>
              </div>
            </Panel>
            <Panel title="Местоположение">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field field="district" label="Район"><TextInput d={P} k="district" set={sP} /></Field>
                <Field field="metroName" label="Ближайшее метро" source={src(pv, "metroName")}><TextInput d={P} k="metroName" set={sP} /></Field>
                <Field field="metroDistanceM" label="Расстояние до метро" hint="Используется в корректировке на транспортную доступность" source={src(pv, "metroDistanceM")}><NumInput d={P} k="metroDistanceM" set={sP} suffix="м" /></Field>
                <Field field="latitude" label="Широта" source={src(pv, "latitude")}><NumInput d={P} k="latitude" set={sP} placeholder="55.753083" /></Field>
                <Field field="longitude" label="Долгота" source={src(pv, "longitude")}><NumInput d={P} k="longitude" set={sP} placeholder="37.587614" /></Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => locate("geocode")} disabled={!!geoBusy || !String(P.address ?? "").trim()} title="Яндекс Геокодер: адрес → координаты">
                  <Icon name="map" size={14} />{geoBusy === "geocode" ? "Определяем…" : "Координаты по адресу"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => locate("reverse")} disabled={!!geoBusy || P.latitude == null || P.latitude === "" || P.longitude == null || P.longitude === ""} title="Яндекс Геокодер: координаты → адрес">
                  {geoBusy === "reverse" ? "Ищем адрес…" : "Адрес по координатам"}
                </button>
                {detail.property.latitude != null && detail.property.longitude != null && (
                  <a href={mapUrl(Number(detail.property.latitude), Number(detail.property.longitude))} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><Icon name="external" size={13} />На карте</a>
                )}
              </div>
              {geoMsg && !geoMsg.top && (
                <Notice tone={geoMsg.tone} className="mt-3" action={geoMsg.address && geoMsg.address !== P.address ? <button className="btn btn-secondary btn-sm" onClick={() => { sP("address", geoMsg.address); setGeoMsg(null); }}>Подставить</button> : undefined}>
                  {geoMsg.text}
                </Notice>
              )}
              <p className="mt-3 text-[12px] text-muted">Координаты определяются Яндекс Геокодером по адресу или вводятся вручную. Район и расстояние до метро можно скорректировать вручную.</p>
            </Panel>
          </div>

          <InfrastructurePanel
            infra={(detail.property.infrastructure as InfrastructureSnapshot | null) ?? null}
            lat={detail.property.latitude}
            lon={detail.property.longitude}
            busy={geoBusy === "infra"}
            onSearch={() => locate("infra")}
            onUseMetro={(name, m) => { sP("metroName", name.replace(/^метро\s+/i, "")); sP("metroDistanceM", m); toast("Метро подставлено в карточку — сохраните изменения"); }}
          />

          <Panel title="Карта окружения" description="Объект оценки, аналоги и найденная инфраструктура — по уже полученным координатам" bodyClassName="p-3">
            <EnvironmentMap
              points={envPoints}
              layers={["comparables", "infra"]}
              height={360}
              emptyText="Определите координаты объекта — карта окружения появится автоматически"
            />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Положение объекта" bodyClassName="p-3">
            <EnvironmentMap points={envPoints.filter((p) => p.kind === "subject")} layers={[]} height={220} emptyText="Введите и выберите адрес, чтобы определить положение объекта." />
            <AddressSummary details={(detail.property.addressDetails as AddressDetails | null) ?? null} lat={detail.property.latitude} lon={detail.property.longitude} source={pv?.latitude?.title} />
            {geoMsg?.top && <Notice tone={geoMsg.tone} className="mt-2">{geoMsg.text}</Notice>}
          </Panel>
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

/** Разобранный адрес и координаты (что сохранено при выборе адреса). */
function AddressSummary({ details, lat, lon, source }: { details: AddressDetails | null; lat: unknown; lon: unknown; source?: string }) {
  const rows: Array<[string, string | null]> = [
    ["Регион", details?.region ?? null],
    ["Населённый пункт", details?.locality ?? null],
    ["Улица", details?.street ?? null],
    ["Дом", details?.house ?? null],
    ["ГАР", details?.garGuid ?? null],
    ["Координаты", lat != null && lon != null ? `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}` : null],
  ];
  return (
    <dl className="mt-2.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[12px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className={`[overflow-wrap:anywhere] ${v ? "text-zinc-800" : "text-muted"}`}>{v ?? "нет данных"}</dd>
        </div>
      ))}
      <dt className="text-muted">Источник</dt>
      <dd className="[overflow-wrap:anywhere] text-zinc-800">{details ? (details.source === "gar" ? "ГАР" : "Яндекс Геокодер") : "адрес не выбран из подсказок"}{source ? ` · ${source}` : ""}</dd>
    </dl>
  );
}
