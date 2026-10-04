"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtNumber, fmtPercent } from "@/core/format";
import { d } from "@/core/calc/decimal";
import { Icon } from "@/components/ui/Icon";
import { Badge, EmptyState, Notice, Segmented, toast, type Tone } from "@/components/ui/kit";
import { NextStep, StepIssues } from "./common";
import type { WsProps } from "./Workspace";
import type { AdjustmentRow, ComparableRow } from "./types";

interface Edition { id: string; name: string; edition: string; isDemo: boolean; licenseType: string; editable: boolean }

type RuleSnap = { explanation?: string; sourceName?: string; edition?: string; factor?: { kind?: string; reference?: string | null } } | null;

/** Состояние корректировки для оценщика. */
function adjState(a: AdjustmentRow): { label: string; tone: Tone; hint: string } {
  const kind = (a.ruleSnapshot as RuleSnap)?.factor?.kind;
  if (a.notRequired) return { label: "Не требуется", tone: "neutral", hint: a.comment ? `Обоснование: ${a.comment}` : "Укажите обоснование" };
  if (a.overridden && !a.comment?.trim()) return { label: "Требует обоснования", tone: "err", hint: "Значение изменено вручную — укажите обоснование" };
  if (a.overridden) return { label: "Ручная", tone: "info", hint: "Значение задано оценщиком с обоснованием" };
  if (a.suggestedValue === null) return { label: "Нет данных", tone: "warn", hint: "Не хватает характеристик объекта или аналога — принят 0 %" };
  if (kind === "power" || kind === "formula") return { label: "Автоматическая", tone: "brand", hint: "Рассчитана по формуле справочника" };
  if (kind === "manual") return { label: "Экспертная", tone: "neutral", hint: "Определяется оценщиком; по умолчанию 0 %" };
  return { label: "Из справочника", tone: "brand", hint: "Значение из выбранной редакции справочника" };
}

const pct = (v: string) => fmtNumber(d(v).mul(100), 2, true).replace(/ /g, "");
const parsePct = (s: string) => {
  try {
    return d(s.replace("−", "-").replace(",", ".").replace(/\s|%/g, "")).div(100);
  } catch {
    return null;
  }
};

function AdjRow({ a, assessmentId, onSaved, unitAfter }: { a: AdjustmentRow; assessmentId: string; onSaved: () => Promise<void>; unitAfter?: string }) {
  const [value, setValue] = useState(pct(a.value));
  const [comment, setComment] = useState(a.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setValue(pct(a.value));
    setComment(a.comment ?? "");
  }, [a.value, a.comment]);

  const parsed = parsePct(value);
  const differsFromSuggested = parsed && (a.suggestedValue === null ? !parsed.isZero() : !parsed.eq(a.suggestedValue));
  const dirty = (parsed && !parsed.eq(a.value)) || comment !== (a.comment ?? "");
  const needsComment = !!differsFromSuggested && !comment.trim();
  const outOfRange = parsed && ((a.minValue !== null && parsed.lt(a.minValue)) || (a.maxValue !== null && parsed.gt(a.maxValue)));
  const st = adjState(a);
  const rs = a.ruleSnapshot as RuleSnap;

  async function save() {
    if (!parsed) return setError("Введите число");
    if (needsComment) return setError("Укажите обоснование");
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/assessments/${assessmentId}/adjustments/${a.id}`, { percent: value.replace("−", "-").replace(",", ".").replace(/\s|%/g, ""), comment });
      toast("Корректировка сохранена");
      await onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    setBusy(true);
    try {
      await api.patch(`/api/assessments/${assessmentId}/adjustments/${a.id}`, { reset: true });
      toast("Возвращено значение справочника", "info");
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className={a.overridden ? "bg-[#fafbfa]" : ""}>
      <td className="align-top">
        <div className="font-medium text-ink">{a.factorName}</div>
        <div className="text-[11.5px] text-muted">{a.stage === 1 ? "1-я группа" : "2-я группа"}</div>
      </td>
      <td className="align-top text-[12.5px]">
        <div><span className="text-muted">Объект: </span>{a.subjectValue ?? "—"}</div>
        <div><span className="text-muted">Аналог: </span>{a.comparableValue ?? "—"}</div>
      </td>
      <td className="align-top">
        <div className="relative w-[104px]">
          <input
            className={`input num pr-6 text-right font-medium ${a.overridden || differsFromSuggested ? "border-[#9fb5aa] bg-[#f6faf8]" : ""} ${outOfRange ? "border-warn" : ""}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && dirty && save()}
            aria-label={`${a.factorName}, %`}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span>
        </div>
        <div className="num mt-1 text-[11.5px] text-muted">
          справ.: {a.suggestedValue !== null ? fmtPercent(a.suggestedValue, 2, true) : "—"}
          {unitAfter && <span className="block">→ {fmtNumber(unitAfter)} ₽/м²</span>}
        </div>
        {outOfRange && <div className="mt-0.5 text-[11.5px] text-warn">вне диапазона</div>}
      </td>
      <td className="align-top text-[12.5px]">
        <div className="text-zinc-700" title={rs?.sourceName ?? ""}>{rs?.sourceName ? `Справочник, ред. ${rs.edition}` : "—"}</div>
        {(a.minValue !== null || a.maxValue !== null) && <div className="num text-[11.5px] text-muted">диапазон {a.minValue !== null ? fmtPercent(a.minValue) : "−∞"} … {a.maxValue !== null ? fmtPercent(a.maxValue) : "+∞"}</div>}
        {rs?.explanation && <div className="num mt-0.5 text-[11.5px] text-muted" title={rs.explanation}>{rs.explanation.length > 60 ? rs.explanation.slice(0, 60) + "…" : rs.explanation}</div>}
      </td>
      <td className="align-top"><span title={st.hint}><Badge tone={st.tone}>{st.label}</Badge></span></td>
      <td className="align-top">
        <input
          className={`input text-[13px] ${needsComment || (st.tone === "err" && !dirty) ? "border-err/60 bg-err-soft/40" : ""}`}
          placeholder={differsFromSuggested || a.overridden ? "Обоснование обязательно" : "—"}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && dirty && save()}
          aria-label={`Обоснование: ${a.factorName}`}
        />
        {error && <div className="mt-1 text-[11.5px] text-err">{error}</div>}
        {(dirty || a.overridden) && (
          <div className="mt-1.5 flex gap-1.5">
            {dirty && <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Сохранить</button>}
            {dirty && <button className="btn btn-ghost btn-sm" onClick={() => { setValue(pct(a.value)); setComment(a.comment ?? ""); setError(null); }}>Отмена</button>}
            {!dirty && a.overridden && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={reset}>Вернуть значение справочника</button>}
          </div>
        )}
      </td>
    </tr>
  );
}

function Matrix({ comps, detail, res }: { comps: ComparableRow[]; detail: WsProps["detail"]; res: Record<string, { unitPrice: string; adjustedUnitPrice: string; grossAdjustment: string; steps: Array<{ code: string; after: string }> }> }) {
  const factors: Array<{ code: string; name: string; stage: number; sortOrder: number }> = [];
  for (const c of comps) for (const a of c.adjustments) if (!factors.some((f) => f.code === a.factorCode)) factors.push({ code: a.factorCode, name: a.factorName, stage: a.stage, sortOrder: a.sortOrder });
  factors.sort((a, b) => a.stage - b.stage || a.sortOrder - b.sortOrder);
  return (
    <div className="overflow-x-auto">
      <table className="tbl min-w-[720px]">
        <thead>
          <tr>
            <th>Показатель</th>
            {comps.map((c) => <th key={c.id} className="text-right">Аналог {detail.comparables.indexOf(c) + 1}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-canvas/70">
            <td className="text-muted">Цена предложения, ₽/м²</td>
            {comps.map((c) => <td key={c.id} className="num text-right">{res[c.id] ? fmtNumber(res[c.id].unitPrice) : "—"}</td>)}
          </tr>
          {factors.map((f) => (
            <tr key={f.code}>
              <td>{f.name}</td>
              {comps.map((c) => {
                const a = c.adjustments.find((x) => x.factorCode === f.code);
                if (!a) return <td key={c.id} className="text-right text-muted">—</td>;
                const zero = d(a.value).isZero();
                const st = adjState(a);
                return (
                  <td key={c.id} className="text-right">
                    <span className={`num font-medium ${zero ? "text-zinc-400" : d(a.value).isNeg() ? "text-err" : "text-ok"}`}>{fmtPercent(a.value, 2, true)}</span>
                    {(st.tone === "err" || st.tone === "warn" || a.overridden) && <span className="ml-1.5"><Badge tone={st.tone}>{st.label}</Badge></span>}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t-2 border-line-strong font-semibold">
            <td>Скорректированная цена, ₽/м²</td>
            {comps.map((c) => <td key={c.id} className="num text-right">{res[c.id] ? fmtNumber(res[c.id].adjustedUnitPrice) : "—"}</td>)}
          </tr>
          <tr>
            <td className="text-muted">Валовая корректировка</td>
            {comps.map((c) => <td key={c.id} className="num text-right text-muted">{res[c.id] ? fmtPercent(res[c.id].grossAdjustment) : "—"}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function AdjustmentsTab({ detail, reload, calc, checklist, go }: WsProps) {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [view, setView] = useState<"analog" | "matrix">("analog");
  const comps = detail.comparables.filter((c) => c.included);
  const [current, setCurrent] = useState<string | null>(comps[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Edition[]>("/api/directory").then(setEditions).catch(() => {});
  }, []);
  useEffect(() => {
    if (!comps.some((c) => c.id === current)) setCurrent(comps[0]?.id ?? null);
  }, [comps, current]);

  const res = Object.fromEntries((calc?.result?.comparables ?? []).map((c) => [c.id, c]));
  const items = checklist?.items.filter((i) => i.step === "adjustments") ?? [];

  async function changeEdition(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/assessments/${detail.id}`, { adjustmentSourceId: id });
      toast("Редакция справочника изменена, корректировки пересчитаны");
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function resync() {
    setBusy(true);
    await api.post(`/api/assessments/${detail.id}/adjustments`);
    await reload();
    toast("Предложения по справочнику обновлены");
    setBusy(false);
  }

  const comp = comps.find((c) => c.id === current);
  const r = comp ? res[comp.id] : undefined;
  const attentionCount = (c: ComparableRow) => c.adjustments.filter((a) => (a.overridden && !a.comment?.trim()) || (a.suggestedValue === null && !a.overridden)).length;

  return (
    <div>
      <StepIssues items={items} go={go} />
      <section className="card mb-4">
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="edition">Справочник корректировок</label>
            <select id="edition" className="input max-w-xl" value={detail.adjustmentSourceId ?? ""} disabled={busy} onChange={(e) => changeEdition(e.target.value)}>
              {editions.map((e) => <option key={e.id} value={e.id}>{e.name} — ред. {e.edition}{e.isDemo ? " (демо)" : ""}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 md:pt-5">
            <button className="btn btn-secondary" disabled={busy} onClick={resync} title="Значения, изменённые вручную с обоснованием, сохраняются">Пересчитать по справочнику</button>
          </div>
        </div>
        {detail.adjustmentSource?.isDemo && (
          <div className="border-t border-line px-4 py-2.5">
            <Notice tone="warn">
              Демонстрационный справочник: значения не подтверждены лицензированным источником. <Link href="/app/directory" className="font-medium underline">Создайте свою редакцию</Link> или используйте лицензированный справочник.
            </Notice>
          </div>
        )}
        {error && <div className="border-t border-line p-3"><Notice tone="err">{error}</Notice></div>}
      </section>

      {comps.length === 0 ? (
        <div className="card">
          <EmptyState icon="sliders" title="Нет аналогов для корректировок" action={<button className="btn btn-primary" onClick={() => go("comparables")}>Перейти к аналогам</button>}>
            Корректировки рассчитываются автоматически, как только в расчёт включены аналоги.
          </EmptyState>
        </div>
      ) : (
        <section className="card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            {view === "analog" ? (
              <div className="flex flex-wrap gap-1">
                {comps.map((c) => {
                  const n = attentionCount(c);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCurrent(c.id)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] transition ${current === c.id ? "border-graphite bg-graphite text-white" : "border-line bg-white text-zinc-700 hover:border-line-strong"}`}
                    >
                      Аналог {detail.comparables.indexOf(c) + 1}
                      {res[c.id] && <span className={`num text-[11.5px] ${current === c.id ? "text-white/70" : "text-muted"}`}>{fmtPercent(res[c.id].totalChange, 1, true)}</span>}
                      {n > 0 && <span className="h-1.5 w-1.5 rounded-full bg-warn" title="Есть корректировки, требующие внимания" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <h2 className="text-[14px] font-semibold">Сводная матрица корректировок</h2>
            )}
            <Segmented size="sm" value={view} onChange={setView} options={[["analog", "По аналогу"], ["matrix", "Сводная матрица"]]} />
          </header>

          {view === "matrix" ? (
            <Matrix comps={comps} detail={detail} res={res} />
          ) : comp ? (
            <>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line bg-canvas/60 px-4 py-2.5 text-[12.5px]">
                <span className="truncate text-zinc-700">{comp.address}</span>
                <span className="num"><span className="text-muted">Цена предложения: </span>{r ? `${fmtNumber(r.unitPrice)} ₽/м²` : "—"}</span>
                <span className="num"><span className="text-muted">После корректировок: </span><b className="font-semibold">{r ? `${fmtNumber(r.adjustedUnitPrice)} ₽/м²` : "—"}</b></span>
                <span className="num"><span className="text-muted">Σ|корр|: </span>{r ? fmtPercent(r.grossAdjustment) : "—"}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="tbl min-w-[980px]">
                  <thead>
                    <tr>
                      <th className="w-[16%]">Показатель</th>
                      <th className="w-[17%]">Значение</th>
                      <th className="w-[12%]">Корректировка</th>
                      <th className="w-[19%]">Источник</th>
                      <th className="w-[11%]">Состояние</th>
                      <th>Обоснование</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.adjustments.map((a) => (
                      <AdjRow key={a.id} a={a} assessmentId={detail.id} onSaved={reload} unitAfter={r?.steps.find((s) => s.code === a.factorCode)?.after} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          <div className="flex items-center gap-2 border-t border-line bg-canvas/60 px-4 py-2.5 text-[12px] text-muted">
            <Icon name="info" size={14} />
            Корректировка = k(объект) / k(аналог) − 1 по справочнику. Изменение значения сохраняется вместе с обоснованием и попадает в отчёт и историю.
          </div>
        </section>
      )}
      {comps.length > 0 && <NextStep to="calculation" go={go} />}
    </div>
  );
}
