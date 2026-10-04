"use client";

// Карточка аналога: основные данные → сравнение с объектом оценки → корректировки
// (коэффициент, основание, ручное изменение с обоснованием) → цепочка расчёта цены.
// Цепочка считается тем же ядром (applyAdjustments), что и итоговый расчёт.

import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "@/lib/api";
import { applyAdjustments } from "@/core/calc/engine";
import { d, round } from "@/core/calc/decimal";
import type { AdjustmentMode } from "@/core/calc/types";
import { compareWithSubject, rowForAdjustment, NO_DATA, type CompareRow } from "@/core/comparables/compare";
import { FINISHING, WALL_MATERIALS } from "@/core/adjustments/attributes";
import { fmtDate, fmtNumber, fmtPercent } from "@/core/format";
import { Icon } from "@/components/ui/Icon";
import { Badge, Segmented, toast, type Tone } from "@/components/ui/kit";
import type { AdjustmentRow, ComparableRow, Detail } from "./types";

export const STATUS_LABEL: Record<string, string> = { use: "Используется", review: "На проверке", exclude: "Не используется" };
export const STATUS_TONE: Record<string, Tone> = { use: "ok", review: "warn", exclude: "neutral" };

const showVal = (v: unknown) => (v === null || v === undefined || v === "" ? "Нет данных" : typeof v === "number" ? fmtNumber(v, Number.isInteger(v) ? 0 : 2, true) : /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? fmtDate(String(v)) : String(v));
const nd = (v: unknown) => (v === null || v === undefined || v === "" ? <span className="text-muted">{NO_DATA}</span> : String(v));
const pctInput = (v: string) => fmtNumber(d(v).mul(100), 2, true).replace(/ /g, "");
const parsePct = (s: string) => {
  try {
    const x = d(s.replace("−", "-").replace(",", ".").replace(/\s|%/g, ""));
    return x.isFinite() ? x.div(100) : null;
  } catch {
    return null;
  }
};

/** Цепочка корректировок аналога (тем же ядром, что и итоговый расчёт). */
export function comparableChain(c: ComparableRow, mode: AdjustmentMode) {
  const unit = round(d(c.price).div(c.area), 2);
  const steps = applyAdjustments(unit, c.adjustments.map((a) => ({ code: a.factorCode, name: a.factorName, value: a.value, stage: a.stage, order: a.sortOrder })), mode);
  const adjusted = steps.length ? d(steps[steps.length - 1].after) : unit;
  return { unit, steps, adjusted, total: unit.isZero() ? d(0) : adjusted.div(unit).minus(1), count: c.adjustments.filter((a) => !d(a.value).isZero()).length };
}

export function subjectForCompare(detail: Detail) {
  const p = detail.property, b = detail.building;
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  return {
    address: (p.address as string) ?? null,
    district: (p.district as string) ?? null,
    area: p.area != null ? String(p.area) : null,
    rooms: num(p.rooms),
    floor: num(p.floor),
    floors: num(b.floors),
    wallMaterial: (b.wallMaterial as string) ?? null,
    yearBuilt: num(b.yearBuilt),
    finishing: (p.finishing as string) ?? null,
    houseCondition: (b.houseCondition as string) ?? null,
    furniture: (p.furniture as boolean | null) ?? null,
    metroName: (p.metroName as string) ?? null,
    metroDistanceM: num(p.metroDistanceM),
    rights: (p.rights as string) ?? null,
    valuationDate: detail.valuationDate,
  };
}

export function compareRowsFor(detail: Detail, c: ComparableRow): CompareRow[] {
  const n = (c.normalized ?? {}) as { metroName?: string | null; metroMinutes?: number | null; metroMode?: string | null };
  return compareWithSubject(subjectForCompare(detail), {
    address: c.address, district: c.district, area: c.area, rooms: c.rooms, floor: c.floor, floors: c.floors, wallMaterial: c.wallMaterial,
    houseType: c.houseType, yearBuilt: c.yearBuilt, finishing: c.finishing, houseCondition: c.houseCondition, furniture: c.furniture,
    metroDistanceM: c.metroDistanceM, rights: c.rights, offerDate: c.offerDate ?? c.retrievedAt, distanceM: c.distanceM,
    metroName: n.metroName ?? null, metroMinutes: n.metroMinutes ?? null, metroMode: n.metroMode ?? null,
  });
}

function AdjLine({ a, assessmentId, onSaved, step }: { a: AdjustmentRow; assessmentId: string; onSaved: () => Promise<void>; step?: { before: string; after: string } }) {
  const [value, setValue] = useState(pctInput(a.value));
  const [comment, setComment] = useState(a.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notReq, setNotReq] = useState(false);
  useEffect(() => {
    setValue(pctInput(a.value));
    setComment(a.comment ?? "");
  }, [a.value, a.comment]);

  const rs = a.ruleSnapshot;
  const parsed = parsePct(value);
  const differs = parsed && (a.suggestedValue === null ? !parsed.isZero() : !parsed.eq(a.suggestedValue));
  const dirty = (parsed && !parsed.eq(a.value)) || comment !== (a.comment ?? "");
  const needsComment = (!!differs || notReq) && !comment.trim();
  const outOfRange = parsed && ((a.minValue !== null && parsed.lt(a.minValue)) || (a.maxValue !== null && parsed.gt(a.maxValue)));
  const k = d(1).plus(d(a.value));
  const sign = a.suggestedValue !== null && !d(a.suggestedValue).isZero() ? (d(a.suggestedValue).gt(0) ? "аналог хуже объекта → корректировка положительная" : "аналог лучше объекта → корректировка отрицательная") : null;

  async function patch(payload: Record<string, unknown>, msg: string) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/assessments/${assessmentId}/adjustments/${a.id}`, payload);
      toast(msg);
      setNotReq(false);
      await onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const save = () => {
    if (notReq) return needsComment ? setError("Укажите обоснование") : patch({ notRequired: true, comment }, "Фактор отмечен «Не требуется»");
    if (!parsed) return setError("Введите число");
    if (needsComment) return setError("Укажите обоснование изменения");
    return patch({ percent: value.replace("−", "-").replace(",", ".").replace(/\s|%/g, ""), comment }, "Корректировка сохранена");
  };

  const editing = !!(differs || notReq || dirty);
  const bg = a.overridden || a.notRequired ? "bg-[#fafbfa]" : "";
  return (
    <>
      <tr className={`${bg} ${editing || error ? "[&>td]:border-b-0" : ""}`}>
        <td className="align-top">
          <div className="font-medium text-ink">{a.factorName}</div>
          <div className="text-[11.5px] text-muted">{rs?.factor?.groupName ?? (a.stage === 1 ? "1-я группа" : "2-я группа")}</div>
        </td>
        <td className="align-top text-[12.5px]">
          <div><span className="text-muted">Объект: </span>{a.subjectValue ?? "Нет данных"}</div>
          <div><span className="text-muted">Аналог: </span>{a.comparableValue ?? "Нет данных"}</div>
        </td>
        <td className="num align-top text-right text-[12.5px]">
          {a.notRequired ? "—" : fmtNumber(k, 4)}
          {(a.overridden || a.notRequired) && rs?.coefficient && <div className="text-[11px] text-muted">справ. {fmtNumber(rs.coefficient, 4)}</div>}
        </td>
        <td className="align-top">
          {a.notRequired ? (
            <Badge tone="neutral">Не требуется</Badge>
          ) : (
            <div className="relative w-[88px]">
              <input
                className={`input num py-1 pr-6 text-right font-medium ${a.overridden || differs ? "border-[#9fb5aa] bg-[#f6faf8]" : ""} ${outOfRange ? "border-warn" : ""}`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && dirty && save()}
                aria-label={`${a.factorName}, %`}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span>
            </div>
          )}
          {a.suggestedValue === null && !a.overridden && !a.notRequired && <div className="mt-0.5 text-[11px] text-warn">нет данных</div>}
          {outOfRange && <div className="mt-0.5 text-[11px] text-warn">вне диапазона</div>}
          {step && !d(a.value).isZero() && <div className="num mt-0.5 text-[11px] text-muted">→ {fmtNumber(step.after, 0)} ₽/м²</div>}
          {!editing && (a.overridden || a.notRequired) && <button className="mt-0.5 block text-[11.5px] text-brand hover:underline" disabled={busy} onClick={() => patch({ reset: true }, "Возвращено значение справочника")}>вернуть автоматическое</button>}
          {!editing && !a.overridden && !a.notRequired && a.suggestedValue === null && <button className="mt-0.5 block text-[11.5px] text-brand hover:underline" onClick={() => setNotReq(true)}>не требуется</button>}
        </td>
        <td className="align-top text-[12px] leading-snug">
          <div className="text-zinc-700">
            {rs?.sourceName ? `${rs.sourceName}, ред. ${rs.edition}` : "—"}
            {rs?.isDemo && <span className="ml-1 rounded bg-warn-soft px-1 text-[10.5px] font-semibold text-warn">ДЕМО</span>}
          </div>
          {rs?.factor?.reference && <div className="text-muted">{rs.factor.reference}</div>}
          {rs?.explanation && <div className="num text-muted" title={rs.explanation}>{rs.explanation.length > 90 ? `${rs.explanation.slice(0, 90)}…` : rs.explanation}</div>}
          {sign && <div className="text-muted">{sign}</div>}
          {(a.minValue !== null || a.maxValue !== null) && <div className="num text-muted">диапазон {a.minValue !== null ? fmtPercent(a.minValue, 1) : "−∞"} … {a.maxValue !== null ? fmtPercent(a.maxValue, 1) : "+∞"}</div>}
          {(a.overridden || a.notRequired) && (
            <div className="mt-1 rounded bg-subtle px-1.5 py-1 text-zinc-700">
              {a.notRequired ? "Признан неприменимым" : `Изменено вручную: ${a.suggestedValue !== null ? fmtPercent(a.suggestedValue, 2, true) : "нет значения"} → ${fmtPercent(a.value, 2, true)}`}
              {a.overriddenAt && <span className="text-muted"> · {a.overriddenByName ?? "оценщик"}, {fmtDate(a.overriddenAt)}</span>}
              {a.comment && <div className="text-muted">Обоснование: {a.comment}</div>}
            </div>
          )}
        </td>
      </tr>
      {(editing || error) && (
        <tr className={bg}>
          <td colSpan={5} className="pt-0">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-2">
              <span className="text-[12px] text-muted">{notReq ? "Почему фактор не требуется:" : "Обоснование изменения:"}</span>
              <input className={`input min-w-[240px] flex-1 py-1 text-[12.5px] ${needsComment ? "border-err/60 bg-err-soft/40" : ""}`} placeholder="Обязательно" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} aria-label={`Обоснование: ${a.factorName}`} />
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Сохранить</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setValue(pctInput(a.value)); setComment(a.comment ?? ""); setNotReq(false); setError(null); }}>Отмена</button>
              {error && <span className="text-[12px] text-err">{error}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function ComparableCard({ c, label, detail, mode, weight, reload, onEdit, onRemove }: {
  c: ComparableRow;
  label: string;
  detail: Detail;
  mode: AdjustmentMode;
  weight?: string | null;
  reload: () => Promise<void>;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [status, setStatus] = useState(c.status);
  const [actuality, setActuality] = useState<{ found: boolean; changes: Array<{ field: string; saved: unknown; current: unknown }>; delistedAt: string | null } | "loading" | null>(null);
  useEffect(() => setStatus(c.status), [c.status]);
  const rows = useMemo(() => compareRowsFor(detail, c), [detail, c]);
  const chain = useMemo(() => comparableChain(c, mode), [c, mode]);
  const n = (c.normalized ?? {}) as { photos?: string[]; renovationRaw?: string | null; metroName?: string | null; metroMinutes?: number | null; metroMode?: string | null; sources?: Array<{ source: string; price: number | null; url: string | null }> };
  const photos = (n.photos ?? (c.photoUrl ? [c.photoUrl] : [])).slice(0, 4);
  const adjByRow = new Map<string, AdjustmentRow[]>();
  for (const a of c.adjustments) {
    const r = rowForAdjustment(rows, a);
    if (r) adjByRow.set(r.key, [...(adjByRow.get(r.key) ?? []), a]);
  }
  const stepByCode = new Map(chain.steps.map((s) => [s.code, s]));

  async function changeStatus(v: "use" | "review" | "exclude") {
    setStatus(v);
    try {
      await api.patch(`/api/assessments/${detail.id}/comparables/${c.id}`, { status: v });
      toast(v === "use" ? "Аналог используется в расчёте" : v === "review" ? "Аналог на проверке" : "Аналог не используется", "info");
      await reload();
    } catch (e) {
      setStatus(c.status);
      toast(errorText(e), "err");
    }
  }
  async function checkActuality() {
    setActuality("loading");
    try {
      setActuality(await api.get(`/api/assessments/${detail.id}/comparables/${c.id}/actuality`));
    } catch (e) {
      setActuality(null);
      toast(errorText(e), "err");
    }
  }

  const unit = d(c.price).div(c.area);
  const kv = (l: string, v: React.ReactNode) => (
    <div className="min-w-0"><div className="text-[11.5px] text-muted">{l}</div><div className="truncate text-[13px] text-ink">{v}</div></div>
  );

  return (
    <div className="space-y-4 border-t border-line bg-white px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented size="sm" value={status} onChange={changeStatus} options={[["use", "Использовать"], ["review", "На проверке"], ["exclude", "Не использовать"]]} />
        <div className="ml-auto flex flex-wrap gap-1.5">
          {c.sourceUrl && <a className="btn btn-secondary btn-sm" href={c.sourceUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" size={13} />Объявление</a>}
          {c.provider === "metrapi" && <button className="btn btn-ghost btn-sm" onClick={checkActuality} disabled={actuality === "loading"}><Icon name="history" size={13} />{actuality === "loading" ? "Проверка…" : "Сверить с источником"}</button>}
          <button className="btn btn-ghost btn-sm" onClick={onEdit}><Icon name="edit" size={13} />Изменить</button>
          <button className="btn btn-ghost btn-sm text-err" onClick={onRemove}><Icon name="trash" size={13} />Удалить</button>
        </div>
      </div>

      {actuality && actuality !== "loading" && (
        <div className="rounded-md border border-line bg-canvas px-3 py-2 text-[12.5px]">
          {!actuality.found ? "Объявление не найдено у источника или снято с публикации. Данные в оценке не изменены." : actuality.changes.length === 0 && !actuality.delistedAt ? "Данные объявления у источника совпадают с сохранённым снимком." : (
            <>
              <div className="font-medium text-ink">Объявление у источника изменилось — данные в оценке не меняются автоматически:</div>
              <ul className="mt-1 list-disc pl-5">
                {actuality.delistedAt && <li>Снято с публикации {fmtDate(actuality.delistedAt)}</li>}
                {actuality.changes.map((x, i) => <li key={i}>{x.field}: {showVal(x.saved)} → {showVal(x.current)}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="flex gap-4">
        {photos.length > 0 && (
          <div className="hidden w-[148px] shrink-0 grid-cols-2 gap-1 sm:grid">
            {photos.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noopener noreferrer" className={i === 0 ? "col-span-2" : ""}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`Фото объявления ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" className={`w-full rounded border border-line object-cover ${i === 0 ? "aspect-[4/3]" : "aspect-square"}`} />
              </a>
            ))}
          </div>
        )}
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
          <div className="col-span-2 min-w-0 sm:col-span-3 lg:col-span-4">{kv("Адрес", nd(c.address))}</div>
          {kv("Расстояние до объекта", c.distanceM !== null ? `${fmtNumber(c.distanceM, 0)} м` : nd(null))}
          {kv("Цена предложения", `${fmtNumber(c.price, 0)} ₽`)}
          {kv("Цена за м²", `${fmtNumber(unit, 0)} ₽`)}
          {kv("Площадь", `${fmtNumber(c.area, 2, true)} м²`)}
          {kv("Комнат", nd(c.rooms))}
          {kv("Этаж / этажность", `${c.floor ?? "нет данных"} / ${c.floors ?? "нет данных"}`)}
          {kv("Тип дома (источник)", nd(c.houseType))}
          {kv("Материал стен", c.wallMaterial ? WALL_MATERIALS[c.wallMaterial] ?? c.wallMaterial : nd(null))}
          {kv("Отделка", c.finishing ? `${FINISHING[c.finishing] ?? c.finishing}${n.renovationRaw ? ` («${n.renovationRaw}»)` : ""}` : nd(n.renovationRaw ?? null))}
          {kv("Мебель", c.furniture === true ? "Есть" : c.furniture === false ? "Нет" : nd(null))}
          {kv("Год постройки", nd(c.yearBuilt))}
          {kv("До метро", c.metroDistanceM !== null ? `${fmtNumber(c.metroDistanceM, 0)} м${n.metroName ? ` · ${n.metroName}` : ""}` : n.metroMinutes != null ? `${n.metroMinutes} мин (по объявлению)` : nd(null))}
          {kv("Дата публикации", c.offerDate ? fmtDate(c.offerDate) : nd(null))}
          {kv("Дата обновления", c.sourceUpdatedAt ? fmtDate(c.sourceUpdatedAt) : nd(null))}
          {kv("Источник", `${c.sourceName ?? "Нет данных"}${c.provider === "metrapi" ? " · Metrapi" : ""}`)}
          {kv("Получено", fmtDate(c.retrievedAt))}
          {kv("Координаты", c.latitude && c.longitude ? `${Number(c.latitude).toFixed(5)}, ${Number(c.longitude).toFixed(5)}` : nd(null))}
          {n.sources && n.sources.length > 1 && <div className="col-span-2 min-w-0 sm:col-span-3 lg:col-span-4">{kv("Также размещено", n.sources.map((s) => `${s.source}${s.price ? ` — ${fmtNumber(s.price, 0)} ₽` : ""}`).join(" · "))}</div>}
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-[13px] font-semibold text-ink">Сравнение с объектом оценки</h3>
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="tbl min-w-[640px] text-[12.5px]">
            <thead><tr><th>Характеристика</th><th>Объект оценки</th><th>Аналог</th><th>Разница</th><th className="text-right">Корректировка</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const adjs = adjByRow.get(r.key) ?? [];
                return (
                  <tr key={r.key}>
                    <td className="text-zinc-700">{r.label}</td>
                    <td className={r.subject === NO_DATA ? "text-muted" : ""}>{r.subject}</td>
                    <td className={r.comparable === NO_DATA ? "text-muted" : r.differs ? "bg-warn-soft/50" : ""}>{r.comparable}</td>
                    <td className="text-muted">{r.diff}</td>
                    <td className="num text-right">
                      {adjs.length ? adjs.map((a) => <div key={a.id} className={d(a.value).isZero() ? "text-muted" : "font-medium text-ink"}>{a.notRequired ? "не требуется" : fmtPercent(a.value, 2, true)}</div>) : <span className="text-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-[13px] font-semibold text-ink">Корректировки относительно объекта оценки</h3>
        {c.adjustments.length === 0 ? (
          <p className="text-[12.5px] text-muted">Корректировки появятся после выбора справочника в разделе «Задание».</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="tbl min-w-[680px] text-[13px]">
              <thead><tr><th>Фактор</th><th>Объект / аналог</th><th className="text-right">Коэффициент</th><th>Корректировка</th><th>Основание</th></tr></thead>
              <tbody>
                {c.adjustments.map((a) => <AdjLine key={a.id} a={a} assessmentId={detail.id} onSaved={reload} step={stepByCode.get(a.factorCode)} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-3 rounded-md border border-line bg-canvas p-3 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
        <div><div className="text-[11.5px] text-muted">Исходная цена</div><div className="num text-[15px] font-semibold text-ink">{fmtNumber(chain.unit, 0)} ₽/м²</div></div>
        <div><div className="text-[11.5px] text-muted">Итоговая корректировка</div><div className={`num text-[15px] font-semibold ${chain.total.isZero() ? "text-ink" : chain.total.isNeg() ? "text-err" : "text-ok"}`}>{fmtPercent(chain.total, 2, true)}</div><div className="text-[11px] text-muted">применено: {chain.count}</div></div>
        <div><div className="text-[11.5px] text-muted">Скорректированная цена</div><div className="num text-[15px] font-semibold text-brand">{fmtNumber(chain.adjusted, 0)} ₽/м²</div></div>
        <div><div className="text-[11.5px] text-muted">Вес в расчёте</div><div className="num text-[15px] font-semibold text-ink">{c.status === "use" ? (weight ? fmtNumber(weight, 4) : "—") : "не участвует"}</div></div>
        {chain.steps.length > 0 && (
          <details className="sm:col-span-4">
            <summary className="cursor-pointer text-[12px] text-muted hover:text-ink">Цепочка расчёта ({mode === "sequential" ? "последовательно, мультипликативно" : "1-я группа последовательно, 2-я суммой"})</summary>
            <ol className="num mt-1.5 space-y-0.5 text-[12px] text-zinc-700">
              <li>P₀ = {fmtNumber(c.price, 0)} / {fmtNumber(c.area, 2, true)} = {fmtNumber(chain.unit)}</li>
              {chain.steps.map((s, i) => <li key={s.code}>P{String(i + 1).replace(/\d/g, (x) => "₀₁₂₃₄₅₆₇₈₉"[+x])} ({s.name}): {s.formula}</li>)}
            </ol>
          </details>
        )}
      </div>
    </div>
  );
}
