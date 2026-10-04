"use client";

// Раздел «Аналоги»: объект оценки → поиск объявлений (Metrapi) → отбор → карточка аналога
// (сравнение, корректировки, скорректированная цена) → выбор аналогов для расчёта.
// Ручной ввод и импорт CSV сохранены.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate, fmtNumber, fmtPercent } from "@/core/format";
import { FINISHING, WALL_MATERIALS } from "@/core/adjustments/attributes";
import type { InfrastructureSnapshot } from "@/core/infrastructure";
import type { Listing } from "@/core/listings/model";
import { Icon } from "@/components/ui/Icon";
import { Badge, ConfirmModal, EmptyState, Notice, Panel, Segmented, toast } from "@/components/ui/kit";
import { NextStep, StepIssues } from "./common";
import { ComparableModal, SourceCell } from "./ComparableModal";
import { ComparableCard, STATUS_LABEL, STATUS_TONE, comparableChain } from "./ComparableCard";
import { EnvironmentMap, infraPoints, subjectPoint, unitPriceLine, type MapPoint } from "./EnvironmentMap";
import { ListingSearchPanel, type QueryState } from "./ListingSearchPanel";
import type { WsProps } from "./Workspace";
import type { ComparableRow } from "./types";

type ListingView = Listing & { distanceM: number | null; inAssessment: { comparableId: string; status: string } | null };
type Point = { externalId: string; lat: number; lon: number; unitPrice: number | null; price: number | null; area: number | null; address: string | null; distanceM: number | null; inAssessment: string | null };
interface CascadeInfo { steps: Array<{ label: string; relaxed: string[]; received: number | null; kept: number }>; relaxed: string[]; applied: string[]; message: string | null }
interface SearchMeta { id: string; total: number | null; stats: { received: number; kept: number; noCoords: number; tooFar: number; unitPrice: number; furniture: number }; cascade: CascadeInfo | null; createdAt: string; expiresAt: string; fromCache: boolean; query: QueryState }
interface ListingsResponse { configured: boolean; defaults?: QueryState; search: SearchMeta | null; items: ListingView[]; points: Point[]; total: number; offset: number; limit: number }

const PAGE = 20;
const SOURCE_NAMES: Record<string, string> = { avito: "Авито", cian: "ЦИАН", domclick: "ДомКлик", yandex: "Яндекс Недвижимость", farpost: "FarPost", move: "Move.ru", sob: "sob.ru", youla: "Юла" };
const nd = (v: unknown, suffix = "") => (v === null || v === undefined || v === "" ? <span className="text-muted">нет данных</span> : `${v}${suffix}`);

function ListingRow({ l, active, onAdd, onFocus, busy }: { l: ListingView; active: boolean; onAdd: (status: "use" | "review") => void; onFocus: () => void; busy: boolean }) {
  return (
    <li id={`found-${l.externalId}`} className={`flex gap-3 px-4 py-3 transition ${active ? "bg-brand-soft/50" : "hover:bg-subtle/60"}`} onClick={onFocus}>
      {l.photos[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={l.photos[0]} alt="" loading="lazy" referrerPolicy="no-referrer" className="hidden h-[72px] w-[96px] shrink-0 rounded border border-line object-cover sm:block" />
      ) : (
        <div className="hidden h-[72px] w-[96px] shrink-0 items-center justify-center rounded border border-dashed border-line text-[11px] text-muted sm:flex">нет фото</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium text-ink" title={l.address ?? ""}>{l.address ?? "Адрес не указан"}</div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
              <span>{l.distanceM !== null ? `${fmtNumber(l.distanceM, 0)} м от объекта` : "нет координат"}</span>
              <span>{l.publishedAt ? `опубл. ${fmtDate(l.publishedAt)}` : "дата публикации: нет данных"}</span>
              <span>{SOURCE_NAMES[l.source] ?? l.source}{l.sources.length > 1 ? ` +${l.sources.length - 1}` : ""}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="num text-[14px] font-semibold text-ink">{l.unitPrice !== null ? `${fmtNumber(l.unitPrice, 0)} ₽/м²` : "—"}</div>
            <div className="num text-[12px] text-muted">{l.price !== null ? `${fmtNumber(l.price, 0)} ₽` : "цена: нет данных"}</div>
          </div>
        </div>
        <div className="num mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-zinc-700">
          <span>{nd(l.area !== null ? fmtNumber(l.area, 1, true) : null, " м²")}</span>
          <span>{l.rooms !== null ? `${l.rooms}-комн.` : nd(null)}</span>
          <span>этаж {l.floor ?? "нет данных"}/{l.floors ?? "нет данных"}</span>
          <span>{l.houseTypeRaw ?? <span className="text-muted">тип дома: нет данных</span>}</span>
          <span>{l.renovationRaw ?? <span className="text-muted">ремонт: нет данных</span>}</span>
          {l.buildYear && <span>{l.buildYear} г.</span>}
          {l.metroName && <span>м. {l.metroName}{l.metroMinutes !== null ? `, ${l.metroMinutes} мин` : ""}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {l.inAssessment ? (
            <Badge tone={STATUS_TONE[l.inAssessment.status]} icon="check">В оценке · {STATUS_LABEL[l.inAssessment.status].toLowerCase()}</Badge>
          ) : (
            <>
              <button className="btn btn-primary btn-sm" disabled={busy || l.price === null || l.area === null} onClick={() => onAdd("use")}><Icon name="plus" size={13} />Использовать</button>
              <button className="btn btn-secondary btn-sm" disabled={busy || l.price === null || l.area === null} onClick={() => onAdd("review")}>На проверку</button>
            </>
          )}
          {l.url && <a className="btn btn-ghost btn-sm" href={l.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={13} />Объявление</a>}
        </div>
      </div>
    </li>
  );
}

export function ComparablesTab({ detail, reload, calc, checklist, go, focus }: WsProps) {
  const [data, setData] = useState<ListingsResponse | null>(null);
  const [q, setQ] = useState<QueryState | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"assessment" | "found">(detail.comparables.length ? "assessment" : "found");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<ComparableRow | null | "new">(null);
  const [removing, setRemoving] = useState<ComparableRow | null>(null);
  const [importMsg, setImportMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  // переход из «Контроля качества» к полю аналога: раскрыть его карточку
  useEffect(() => {
    const id = focus?.match(/^comparable\.([^.]+)/)?.[1];
    if (id && detail.comparables.some((c) => c.id === id)) {
      setTab("assessment");
      setExpanded(id);
    }
  }, [focus, detail.comparables]);
  const items = checklist?.items.filter((i) => i.step === "comparables") ?? [];
  const mode = calc?.settings.adjustmentMode ?? "sequential";
  const resById = Object.fromEntries((calc?.result?.comparables ?? []).map((c) => [c.id, c]));
  const p = detail.property, b = detail.building;

  const load = useCallback(async (offset = 0, searchId?: string, focus?: string) => {
    const r = await api.get<ListingsResponse>(`/api/assessments/${detail.id}/listings?offset=${offset}&limit=${PAGE}${searchId ? `&searchId=${searchId}` : ""}${focus ? `&focus=${encodeURIComponent(focus)}` : ""}`);
    setData(r);
    setQ((cur) => cur ?? (r.search?.query ? { ...r.search.query, hints: r.defaults?.hints } : r.defaults ?? null));
    return r;
  }, [detail.id]);

  useEffect(() => {
    load().catch((e) => setError(errorText(e)));
  }, [load]);

  async function search(force: boolean) {
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      const { hints: _h, ...query } = q;
      const r = await api.post<ListingsResponse>(`/api/assessments/${detail.id}/listings`, { query, force });
      setData((cur) => ({ ...r, defaults: cur?.defaults }));
      setTab("found");
      toast(r.search?.fromCache ? "Результаты из кэша (тот же запрос в течение 6 ч)" : `Найдено объявлений: ${r.total}`, "info");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function addListing(externalId: string, status: "use" | "review") {
    if (!data?.search) return;
    setAdding(externalId);
    try {
      await api.post(`/api/assessments/${detail.id}/listings/add`, { searchId: data.search.id, externalId, status });
      toast(status === "use" ? "Аналог добавлен и используется в расчёте" : "Аналог добавлен на проверку");
      await Promise.all([reload(), load(data.offset, data.search.id)]);
    } catch (e) {
      toast(errorText(e), "err");
    } finally {
      setAdding(null);
    }
  }

  async function remove(c: ComparableRow) {
    try {
      await api.del(`/api/assessments/${detail.id}/comparables/${c.id}`);
      toast("Аналог удалён");
      await reload();
      if (data?.search) await load(data.offset, data.search.id);
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

  // Подписи аналогов — те же, что в расчёте и отчёте (по порядку в оценке)
  const labelOf = (c: ComparableRow) => `Аналог ${detail.comparables.indexOf(c) + 1}`;
  const numOf = (c: ComparableRow) => String(detail.comparables.indexOf(c) + 1);

  const points = useMemo<MapPoint[]>(() => {
    const out: MapPoint[] = [];
    if (p.latitude != null && p.longitude != null) {
      const sp = subjectPoint(p.latitude, p.longitude, p.address);
      if (sp) out.push({ ...sp, lines: [String(p.address ?? ""), p.area ? `${fmtNumber(p.area as string, 2, true)} м²` : ""].filter(Boolean) });
    }
    for (const c of detail.comparables) {
      if (c.latitude == null || c.longitude == null) continue;
      const ch = comparableChain(c, mode);
      out.push({
        id: `cmp:${c.id}`, kind: "comparable", status: c.status, caption: numOf(c), lat: Number(c.latitude), lon: Number(c.longitude), title: `${labelOf(c)} · ${STATUS_LABEL[c.status]}`,
        lines: [c.address ?? "", `${fmtNumber(ch.unit, 0)} ₽/м² → ${fmtNumber(ch.adjusted, 0)} ₽/м² (${fmtPercent(ch.total, 1, true)})`, c.distanceM !== null ? `${fmtNumber(c.distanceM, 0)} м от объекта` : "", c.sourceName ?? ""].filter(Boolean),
      });
    }
    for (const pt of data?.points ?? []) {
      if (pt.inAssessment) continue; // уже показан как аналог в оценке
      out.push({ id: `found:${pt.externalId}`, kind: "found", lat: pt.lat, lon: pt.lon, title: pt.address ?? "Объявление", lines: [unitPriceLine(pt.unitPrice), pt.price !== null ? `${fmtNumber(pt.price, 0)} ₽ · ${pt.area !== null ? `${fmtNumber(pt.area, 1, true)} м²` : ""}` : "", pt.distanceM !== null ? `${fmtNumber(pt.distanceM, 0)} м от объекта` : ""].filter(Boolean) });
    }
    out.push(...infraPoints((p.infrastructure as InfrastructureSnapshot | null) ?? null));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, data, mode]);

  async function onMapSelect(pt: MapPoint) {
    setSelected(pt.id);
    if (pt.kind === "comparable") {
      const id = pt.id.slice(4);
      setTab("assessment");
      setExpanded(id);
      setTimeout(() => document.getElementById(`cmp-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } else if (pt.kind === "found" && data?.search) {
      const ext = pt.id.slice(6);
      setTab("found");
      if (!data.items.some((l) => l.externalId === ext)) await load(0, data.search.id, ext);
      setTimeout(() => document.getElementById(`found-${ext}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    }
  }

  const used = detail.comparables.filter((c) => c.status === "use");
  const configured = data?.configured ?? true;
  const s = data?.search;

  const subjectStrip = (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] sm:grid-cols-4 lg:grid-cols-8">
      <div className="col-span-2 min-w-0"><div className="text-muted">Адрес</div><div className="truncate text-ink" title={String(p.address ?? "")}>{(p.address as string) || "—"}</div></div>
      <div><div className="text-muted">Координаты</div><div className="text-ink">{p.latitude != null ? "определены" : <button className="text-warn underline-offset-2 hover:underline" onClick={() => go("property")}>не определены</button>}</div></div>
      <div><div className="text-muted">Площадь</div><div className="num text-ink">{p.area ? `${fmtNumber(p.area as string, 2, true)} м²` : "—"}</div></div>
      <div><div className="text-muted">Комнат</div><div className="num text-ink">{(p.rooms as number) ?? "—"}</div></div>
      <div><div className="text-muted">Этаж</div><div className="num text-ink">{(p.floor as number) ?? "—"}/{(b.floors as number) ?? "—"}</div></div>
      <div><div className="text-muted">Материал / отделка</div><div className="truncate text-ink">{b.wallMaterial ? WALL_MATERIALS[b.wallMaterial as string] : "—"} · {p.finishing ? FINISHING[p.finishing as string] : "—"}</div></div>
      <div><div className="text-muted">Дата оценки</div><div className="num text-ink">{fmtDate(detail.valuationDate)}</div></div>
    </div>
  );

  return (
    <div>
      <StepIssues items={items} go={go} />

      <Panel title="Объект оценки" className="mb-4">{subjectStrip}</Panel>

      <Panel
        title="Поиск аналогов"
        description="Объявления о продаже квартир из 8 площадок через Metrapi. Расстояние, цена за м² и мебель фильтруются по данным объявлений на стороне сервиса."
        className="mb-4"
        actions={
          <>
            <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { if (e.target.files?.[0]) importCsv(e.target.files[0]); e.target.value = ""; }} />
            <button className="btn btn-ghost btn-sm" onClick={() => csvRef.current?.click()}><Icon name="upload" size={14} />Импорт CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing("new")}><Icon name="plus" size={14} />Вручную</button>
          </>
        }
      >
        {!configured && <Notice tone="warn" className="mb-3">Metrapi не подключён: задайте переменную окружения METRAPI_API_KEY. До этого аналоги можно добавить вручную или из CSV.</Notice>}
        {importMsg && <Notice tone={importMsg.tone} className="mb-3">{importMsg.text}</Notice>}
        {q ? <ListingSearchPanel q={q} setQ={setQ} busy={busy || !configured} onSearch={search} onReset={() => data?.defaults && setQ(data.defaults)} /> : <div className="h-24 animate-pulse rounded-md bg-subtle" />}
        {error && <Notice tone="err" className="mt-3">{error}</Notice>}
        {s && (
          <p className="mt-3 text-[12px] leading-relaxed text-muted [overflow-wrap:anywhere]">
            {s.fromCache ? "Последний поиск" : "Поиск"} {fmtDate(s.createdAt)} {new Date(s.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}: у источника {s.total ?? "—"}, получено {s.stats.received}, после фильтров {s.stats.kept}
            {s.stats.tooFar ? ` · дальше радиуса ${s.stats.tooFar}` : ""}{s.stats.noCoords ? ` · без координат ${s.stats.noCoords}` : ""}{s.stats.unitPrice ? ` · по цене за м² ${s.stats.unitPrice}` : ""}{s.stats.furniture ? ` · по мебели ${s.stats.furniture}` : ""}
          </p>
        )}
        {s?.cascade && <CascadeNotice c={s.cascade} />}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="card min-w-0 overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <Segmented size="sm" value={tab} onChange={setTab} options={[["assessment", `В оценке · ${detail.comparables.length}`], ["found", `Результаты поиска · ${data?.total ?? 0}`]]} />
            {tab === "assessment" && <span className="text-[12px] text-muted">в расчёте {used.length} · на проверке {detail.comparables.filter((c) => c.status === "review").length}</span>}
          </header>

          {tab === "assessment" ? (
            detail.comparables.length === 0 ? (
              <EmptyState icon="building" title="Аналоги ещё не выбраны">Найдите объявления через поиск выше и добавьте подходящие, или внесите аналог вручную.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {detail.comparables.map((c) => {
                  const ch = comparableChain(c, mode);
                  const open = expanded === c.id;
                  const r = resById[c.id];
                  return (
                    <li key={c.id} id={`cmp-${c.id}`} data-field={`comparable.${c.id}`} className={selected === `cmp:${c.id}` ? "bg-brand-soft/30" : ""}>
                      <button className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-subtle/60" onClick={() => { setExpanded(open ? null : c.id); setSelected(`cmp:${c.id}`); }} aria-expanded={open}>
                        <span className={`num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white ${c.status === "use" ? "bg-brand" : c.status === "review" ? "bg-warn" : "bg-[#9aa39e]"}`}>{numOf(c)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[13.5px] font-medium text-ink">{c.address ?? "Адрес не указан"}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted">
                                <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                                <span>{c.distanceM !== null ? `${fmtNumber(c.distanceM, 0)} м` : "расстояние: нет данных"}</span>
                                <span className="num">{fmtNumber(c.area, 1, true)} м² · {c.floor ?? "нет данных"}/{c.floors ?? "нет данных"} эт.</span>
                                <span>корр.: {ch.count}</span>
                                <span onClick={(e) => e.stopPropagation()}><SourceCell c={c} /></span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="num text-[12px] text-muted line-through decoration-[#c4cbc7]">{fmtNumber(ch.unit, 0)}</div>
                              <div className="num text-[14px] font-semibold text-brand">{fmtNumber(ch.adjusted, 0)} ₽/м²</div>
                              <div className={`num text-[11.5px] ${ch.total.isNeg() ? "text-err" : ch.total.isZero() ? "text-muted" : "text-ok"}`}>{fmtPercent(ch.total, 2, true)}{r ? ` · вес ${fmtNumber(r.weight, 4)}` : ""}</div>
                            </div>
                          </div>
                        </div>
                        <Icon name="chevronRight" size={16} className={`mt-1 shrink-0 text-muted transition ${open ? "rotate-90" : ""}`} />
                      </button>
                      {open && <ComparableCard c={c} label={labelOf(c)} detail={detail} mode={mode} weight={r?.weight ?? null} reload={reload} onEdit={() => setEditing(c)} onRemove={() => setRemoving(c)} />}
                    </li>
                  );
                })}
              </ul>
            )
          ) : !s ? (
            <EmptyState icon="search" title="Поиск ещё не выполнялся">{configured ? "Задайте параметры и нажмите «Найти аналоги». Параметры заполнены по объекту оценки." : "Подключите Metrapi, чтобы искать объявления."}</EmptyState>
          ) : data && data.items.length === 0 ? (
            <EmptyState icon="search" title="Подходящих объявлений нет">Расширьте радиус, диапазон площади или снимите часть фильтров.</EmptyState>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {data?.items.map((l) => (
                  <Fragment key={l.externalId}>
                    <ListingRow l={l} active={selected === `found:${l.externalId}`} busy={adding === l.externalId} onAdd={(st) => addListing(l.externalId, st)} onFocus={() => setSelected(`found:${l.externalId}`)} />
                  </Fragment>
                ))}
              </ul>
              {data && data.total > PAGE && (
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[12.5px]">
                  <span className="num text-muted">{data.offset + 1}–{Math.min(data.offset + PAGE, data.total)} из {data.total}</span>
                  <div className="flex gap-1.5">
                    <button className="btn btn-secondary btn-sm" disabled={data.offset === 0} onClick={() => load(Math.max(0, data.offset - PAGE), s.id)}>Назад</button>
                    <button className="btn btn-secondary btn-sm" disabled={data.offset + PAGE >= data.total} onClick={() => load(data.offset + PAGE, s.id)}>Далее</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <div className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Panel title="Карта окружения" bodyClassName="p-3">
            <EnvironmentMap points={points} selectedId={selected} onSelect={onMapSelect} height={380} emptyText="Определите координаты объекта в разделе «Объект», чтобы увидеть аналоги и инфраструктуру на карте" />
          </Panel>
          <Panel title={`Выбранные аналоги · ${used.length}`} bodyClassName="">
            {used.length === 0 ? (
              <p className="px-4 py-3 text-[12.5px] text-muted">Отметьте аналоги «Использовать» — они попадут в расчёт.</p>
            ) : (
              <ol className="divide-y divide-line">
                {used.map((c) => {
                  const r = resById[c.id];
                  const ch = comparableChain(c, mode);
                  return (
                    <li key={c.id}>
                      <button className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[12.5px] hover:bg-subtle/60" onClick={() => { setTab("assessment"); setExpanded(c.id); setSelected(`cmp:${c.id}`); setTimeout(() => document.getElementById(`cmp-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }}>
                        <Icon name="check" size={13} className="shrink-0 text-ok" />
                        <span className="shrink-0 font-medium text-ink">{labelOf(c)}</span>
                        <span className="min-w-0 flex-1 truncate text-muted">{c.sourceName ?? "—"} · корр. {ch.count} · {fmtPercent(r ? r.totalChange : ch.total, 1, true)}</span>
                        <span className="num shrink-0 font-semibold text-ink">{fmtNumber(r ? r.adjustedUnitPrice : ch.adjusted, 0)} ₽/м²</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            {calc?.result && used.length > 0 && (
              <div className="num border-t border-line bg-canvas px-4 py-2.5 text-[12.5px]">
                <div className="flex justify-between"><span className="text-muted">Средневзвешенная цена</span><span className="font-semibold text-ink">{fmtNumber(calc.result.weightedUnitPrice, 0)} ₽/м²</span></div>
                <div className="flex justify-between"><span className="text-muted">Разброс (коэф. вариации)</span><span>{fmtPercent(calc.result.stats.cv, 1)}</span></div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {detail.comparables.length > 0 && <NextStep to="adjustments" go={go} note={used.length < 3 ? "Рекомендуется не менее трёх аналогов" : undefined} />}
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

/** Как выполнялся каскадный поиск: шаги, ослабленные условия, итоговые условия. */
function CascadeNotice({ c }: { c: CascadeInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`mt-2 rounded-md border px-3 py-2 text-[12.5px] ${c.message ? "border-warn/30 bg-warn-soft" : "border-line bg-canvas"}`}>
      <div className="flex flex-wrap items-start gap-2">
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere] text-zinc-800">
          {c.message ?? "Аналоги найдены по заданным условиям без ослабления."}
          {c.applied.length > 0 && <span className="text-muted"> Итоговые условия: {c.applied.join(", ")}. Результаты отсортированы по сходству с объектом.</span>}
        </span>
        <button type="button" className="text-[12px] text-brand underline-offset-2 hover:underline" onClick={() => setOpen(!open)}>{open ? "Скрыть шаги" : `Шаги поиска · ${c.steps.length}`}</button>
      </div>
      {open && (
        <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-[12px] text-zinc-700">
          {c.steps.map((st, i) => (
            <li key={i} className="[overflow-wrap:anywhere]">
              {st.relaxed.length ? <span className="text-warn">ослаблено: {st.relaxed.join(", ")} → </span> : null}
              {st.label}: {st.received !== null ? `получено ${st.received}, ` : "без нового запроса, "}подходит {st.kept}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
