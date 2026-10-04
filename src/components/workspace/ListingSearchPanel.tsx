"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/kit";
import type { ListingQuery } from "@/core/listings/model";

export type QueryState = ListingQuery & { hints?: string[] };

const WALLS: Array<[string, string]> = [["panel", "Панельный"], ["brick", "Кирпичный"], ["monolith", "Монолитный"], ["monolith_brick", "Монолитно-кирпичный"], ["block", "Блочный"], ["wood", "Деревянный"]];
const FINISH: Array<[string, string]> = [["none", "Без отделки"], ["needs_repair", "Требует ремонта"], ["standard", "Косметический"], ["improved", "Евроремонт"], ["designer", "Дизайнерский"]];
const RADII: Array<[string, string]> = [["500", "500 м"], ["1000", "1 км"], ["2000", "2 км"], ["3000", "3 км"], ["5000", "5 км"], ["10000", "10 км"], ["", "Без ограничения"]];

function Chips<T extends string | number>({ options, value, onChange }: { options: Array<[T, string]>; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, l]) => {
        const on = value.includes(v);
        return (
          <button key={String(v)} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== v) : [...value, v])} className={`rounded-md border px-2 py-[3px] text-[12.5px] transition ${on ? "border-brand bg-brand-soft font-medium text-brand" : "border-line bg-white text-zinc-700 hover:border-line-strong"}`}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

function NumPair({ label, a, b, q, set, suffix }: { label: string; a: keyof ListingQuery; b: keyof ListingQuery; q: QueryState; set: (k: keyof ListingQuery, v: unknown) => void; suffix?: string }) {
  const val = (k: keyof ListingQuery) => (q[k] === null || q[k] === undefined ? "" : String(q[k]));
  const on = (k: keyof ListingQuery) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value.replace(/\s/g, "").replace(",", ".");
    set(k, s === "" ? null : Number.isFinite(Number(s)) ? Number(s) : q[k]);
  };
  return (
    <div>
      <label className="label">{label}{suffix ? `, ${suffix}` : ""}</label>
      <div className="flex items-center gap-1">
        <input className="input num py-1.5" inputMode="decimal" placeholder="от" value={val(a)} onChange={on(a)} />
        <span className="text-muted">–</span>
        <input className="input num py-1.5" inputMode="decimal" placeholder="до" value={val(b)} onChange={on(b)} />
      </div>
    </div>
  );
}

export function ListingSearchPanel({ q, setQ, busy, onSearch, onReset }: { q: QueryState; setQ: (q: QueryState) => void; busy: boolean; onSearch: (force: boolean) => void; onReset: () => void }) {
  const [more, setMore] = useState(false);
  const [sources, setSources] = useState<Array<{ code: string; name: string }>>([]);
  useEffect(() => {
    api.get<{ sources: Array<{ code: string; name: string }> }>("/api/listings/sources").then((r) => setSources(r.sources)).catch(() => undefined);
  }, []);
  const set = (k: keyof ListingQuery, v: unknown) => setQ({ ...q, [k]: v });
  const text = (k: keyof ListingQuery, label: string, ph = "") => (
    <div>
      <label className="label">{label}</label>
      <input className="input py-1.5" value={(q[k] as string) ?? ""} placeholder={ph} onChange={(e) => set(k, e.target.value || null)} />
    </div>
  );
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(false);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {text("locality", "Город (уровень 1)", "Москва")}
        {text("street", "Улица (уровень 1)", "Тверская")}
        {text("region", "Регион", "Московская область")}
        {text("q", "Текст в объявлении", "")}
        <div>
          <label className="label">Расстояние от объекта</label>
          <select className="input py-1.5" value={q.radiusM ? String(q.radiusM) : ""} disabled={!q.center} onChange={(e) => set("radiusM", e.target.value ? Number(e.target.value) : null)} title={q.center ? undefined : "Нет координат объекта"}>
            {RADII.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <p className="text-[11.5px] leading-snug text-muted">Поиск каскадный: уровень 1 — город и улица; уровень 2 — квартира, комнаты, площадь; уровень 3 — этаж, этажность, материал, отделка, расстояние. Если подходящих объектов мало, условия ослабляются автоматически (3 → улица → 2), и это показывается под формой. Пустые значения в объявлениях условиям не противоречат.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <label className="label">Комнат</label>
          <Chips options={[[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]]} value={q.rooms ?? []} onChange={(v) => set("rooms", v)} />
        </div>
        <NumPair label="Площадь" suffix="м²" a="areaMin" b="areaMax" q={q} set={set} />
        <NumPair label="Этаж" a="floorMin" b="floorMax" q={q} set={set} />
        <NumPair label="Этажность дома" a="floorsMin" b="floorsMax" q={q} set={set} />
      </div>
      <div>
        <label className="label">Материал стен (тип дома)</label>
        <Chips options={WALLS} value={q.wallMaterials ?? []} onChange={(v) => set("wallMaterials", v)} />
      </div>

      {more && (
        <div className="space-y-3 rounded-md border border-line bg-canvas p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumPair label="Цена" suffix="₽" a="priceMin" b="priceMax" q={q} set={set} />
            <NumPair label="Цена за м²" suffix="₽" a="unitPriceMin" b="unitPriceMax" q={q} set={set} />
            <div>
              <label className="label">Дата объявления</label>
              <div className="flex items-center gap-1">
                <input className="input py-1.5" type="date" value={q.dateFrom ?? ""} onChange={(e) => set("dateFrom", e.target.value || null)} />
                <span className="text-muted">–</span>
                <input className="input py-1.5" type="date" value={q.dateTo ?? ""} onChange={(e) => set("dateTo", e.target.value || null)} />
              </div>
            </div>
            <NumPair label="Год постройки" a="buildYearMin" b="buildYearMax" q={q} set={set} />
          </div>
          <div>
            <label className="label">Ремонт / отделка (как у источника)</label>
            <Chips options={FINISH} value={q.finishings ?? []} onChange={(v) => set("finishings", v)} />
          </div>
          <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div>
              <label className="label">Мебель</label>
              <Segmented size="sm" value={q.furniture ?? "any"} onChange={(v) => set("furniture", v)} options={[["any", "Не важно"], ["yes", "С мебелью"], ["no", "Без мебели"]]} />
              <p className="mt-1 max-w-[260px] text-[11.5px] leading-snug text-muted">Отдельного поля в API нет — определяется по списку удобств объявления.</p>
            </div>
            <div>
              <label className="label">Источник</label>
              {sources.length ? <Chips options={sources.map((s) => [s.code, s.name] as [string, string])} value={q.sources ?? []} onChange={(v) => set("sources", v)} /> : <p className="text-[12.5px] text-muted">Все площадки (список доступен после подключения Metrapi)</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#176b4d]" checked={!!q.secondaryOnly} onChange={(e) => set("secondaryOnly", e.target.checked)} />Только вторичный рынок</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#176b4d]" checked={!!q.dedupe} onChange={(e) => set("dedupe", e.target.checked)} />Склеивать дубли с разных площадок</label>
            <label className="flex items-center gap-2">Запрашивать
              <select className="input w-auto py-1" value={String(q.limit ?? 300)} onChange={(e) => set("limit", Number(e.target.value))}>
                {[50, 100, 300, 500, 1000].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              объявлений
            </label>
          </div>
        </div>
      )}

      {q.hints && q.hints.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-warn">{q.hints.map((h, i) => <li key={i}>{h}</li>)}</ul>}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={busy}><Icon name="search" size={15} />{busy ? "Поиск…" : "Найти аналоги"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setMore(!more)}>{more ? "Скрыть фильтры" : "Ещё фильтры"}</button>
        <button type="button" className="btn btn-ghost" onClick={onReset}>По объекту оценки</button>
        <button type="button" className="btn btn-ghost ml-auto" disabled={busy} onClick={() => onSearch(true)} title="Повторить запрос к Metrapi без кэша">Обновить из источника</button>
      </div>
    </form>
  );
}
