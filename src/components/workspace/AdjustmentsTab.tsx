"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/lib/api";
import { fmtNumber, fmtPercent } from "@/core/format";
import { d } from "@/core/calc/decimal";
import type { WsProps } from "./Workspace";
import type { AdjustmentRow } from "./types";

interface Edition { id: string; name: string; edition: string; isDemo: boolean; licenseType: string; editable: boolean }

function Editor({ adj, label, assessmentId, onClose, onSaved }: { adj: AdjustmentRow; label: string; assessmentId: string; onClose: () => void; onSaved: () => void }) {
  const [percent, setPercent] = useState(fmtNumber(d(adj.value).mul(100), 2, true).replace(/ /g, ""));
  const [comment, setComment] = useState(adj.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = (() => {
    try {
      return d(percent.replace("−", "-").replace(",", ".").replace(/\s/g, "")).div(100);
    } catch {
      return null;
    }
  })();
  const changed = parsed && (adj.suggestedValue === null ? !parsed.isZero() : !parsed.eq(adj.suggestedValue));
  const outOfRange = parsed && ((adj.minValue !== null && parsed.lt(adj.minValue)) || (adj.maxValue !== null && parsed.gt(adj.maxValue)));

  async function save(reset = false) {
    if (!reset && changed && !comment.trim()) {
      setError("Значение отличается от справочника — укажите обоснование");
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/api/assessments/${assessmentId}/adjustments/${adj.id}`, reset ? { reset: true } : { percent: percent.replace("−", "-").replace(",", "."), comment });
      onSaved();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="card border-brand p-4 shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="font-semibold">{adj.factorName} · {label}</div>
          <div className="text-xs text-muted">{adj.stage === 1 ? "Корректировка 1-й группы" : "Корректировка 2-й группы"}</div>
        </div>
        <button className="btn btn-ghost" onClick={onClose}>✕</button>
      </div>
      <div className="grid gap-3 text-sm md:grid-cols-4">
        <div><div className="label">Объект оценки</div>{adj.subjectValue ?? "—"}</div>
        <div><div className="label">Аналог</div>{adj.comparableValue ?? "—"}</div>
        <div><div className="label">По справочнику</div><span className="num">{adj.suggestedValue !== null ? fmtPercent(adj.suggestedValue, 2, true) : "нет данных"}</span></div>
        <div><div className="label">Диапазон</div><span className="num">{adj.minValue !== null || adj.maxValue !== null ? `${adj.minValue !== null ? fmtPercent(adj.minValue) : "−∞"} … ${adj.maxValue !== null ? fmtPercent(adj.maxValue) : "+∞"}` : "—"}</span></div>
      </div>
      {adj.ruleSnapshot?.explanation && (
        <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-xs text-muted">
          Расчёт: <span className="num">{adj.ruleSnapshot.explanation}</span> · {adj.ruleSnapshot.sourceName}, ред. {adj.ruleSnapshot.edition}
        </div>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr]">
        <div>
          <label className="label">Применяемое значение, %</label>
          <input className={`input num ${outOfRange ? "border-amber-400" : ""}`} value={percent} onChange={(e) => setPercent(e.target.value)} autoFocus />
          {outOfRange && <div className="mt-1 text-[11px] text-warn">Вне диапазона справочника</div>}
        </div>
        <div>
          <label className="label">Обоснование {changed && <span className="text-err">*</span>}</label>
          <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Почему значение отличается от справочника (обязательно при изменении)" />
        </div>
      </div>
      {error && <div className="mt-2 text-err">{error}</div>}
      <div className="mt-3 flex justify-end gap-2">
        {adj.overridden && <button className="btn btn-ghost" disabled={busy} onClick={() => save(true)}>Вернуть значение справочника</button>}
        <button className="btn btn-primary" disabled={busy || !parsed} onClick={() => save()}>Применить</button>
      </div>
    </div>
  );
}

export function AdjustmentsTab({ detail, reload, calc, go }: WsProps) {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selected, setSelected] = useState<{ adj: AdjustmentRow; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Edition[]>("/api/directory").then(setEditions).catch(() => {});
  }, []);

  const comps = detail.comparables.filter((c) => c.included);
  const factors: Array<{ code: string; name: string; stage: number; sortOrder: number }> = [];
  for (const c of comps) for (const a of c.adjustments) if (!factors.some((f) => f.code === a.factorCode)) factors.push({ code: a.factorCode, name: a.factorName, stage: a.stage, sortOrder: a.sortOrder });
  factors.sort((a, b) => a.stage - b.stage || a.sortOrder - b.sortOrder);
  const res = Object.fromEntries((calc?.result?.comparables ?? []).map((c) => [c.id, c]));

  async function changeEdition(id: string) {
    setBusy(true);
    try {
      await api.patch(`/api/assessments/${detail.id}`, { adjustmentSourceId: id });
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
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
        <div className="flex-1">
          <label className="label">Редакция справочника корректировок для этой оценки</label>
          <select className="input max-w-xl" value={detail.adjustmentSourceId ?? ""} disabled={busy} onChange={(e) => changeEdition(e.target.value)}>
            {editions.map((e) => <option key={e.id} value={e.id}>{e.name} — ред. {e.edition}{e.isDemo ? " (демо)" : ""}</option>)}
          </select>
          {detail.adjustmentSource?.isDemo && (
            <div className="mt-1 text-xs text-warn">Демонстрационный справочник: значения не подтверждены лицензированным источником. <Link href="/app/directory" className="underline">Создайте свою редакцию</Link> или подключите лицензированный справочник.</div>
          )}
        </div>
        <button className="btn btn-secondary" disabled={busy} onClick={resync} title="Ручные значения с обоснованием сохраняются">Пересчитать по справочнику</button>
      </div>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-err">{error}</div>}

      {comps.length === 0 ? (
        <div className="card p-10 text-center text-muted">Добавьте аналоги — корректировки будут предложены автоматически.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="min-w-56">Корректировка</th>
                {comps.map((c) => <th key={c.id} className="min-w-40 text-right">Аналог {detail.comparables.indexOf(c) + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-slate-50/60">
                <td className="text-muted">Цена предложения за м², ₽</td>
                {comps.map((c) => <td key={c.id} className="num text-right">{res[c.id] ? fmtNumber(res[c.id].unitPrice) : "—"}</td>)}
              </tr>
              {factors.map((f, fi) => (
                <tr key={f.code} className={fi > 0 && factors[fi - 1].stage !== f.stage ? "border-t-2 border-slate-200" : ""}>
                  <td>
                    <div>{f.name}</div>
                    <div className="text-[11px] text-muted">{f.stage === 1 ? "1-я группа" : "2-я группа"}</div>
                  </td>
                  {comps.map((c) => {
                    const a = c.adjustments.find((x) => x.factorCode === f.code);
                    if (!a) return <td key={c.id} className="text-right text-muted">—</td>;
                    const step = res[c.id]?.steps.find((s) => s.code === f.code);
                    const zero = d(a.value).isZero();
                    const missing = a.suggestedValue === null && !a.overridden;
                    return (
                      <td key={c.id} className="cursor-pointer text-right hover:bg-blue-50" onClick={() => setSelected({ adj: a, label: `Аналог ${detail.comparables.indexOf(c) + 1}` })}>
                        <div className={`num font-medium ${zero ? "text-muted" : d(a.value).isNeg() ? "text-err" : "text-ok"}`}>
                          {fmtPercent(a.value, 2, true)}
                          {a.overridden && <span title={a.comment ?? ""} className={`ml-1 badge ${a.comment ? "bg-blue-50 text-brand" : "bg-red-50 text-err"}`}>{a.comment ? "изм." : "нет обосн."}</span>}
                          {missing && <span className="ml-1 badge bg-amber-50 text-warn">нет данных</span>}
                        </div>
                        <div className="truncate text-[11px] text-muted">{a.comparableValue}</div>
                        {step && <div className="num text-[11px] text-slate-500">→ {fmtNumber(step.after)}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td>Скорректированная цена за м², ₽</td>
                {comps.map((c) => <td key={c.id} className="num text-right">{res[c.id] ? fmtNumber(res[c.id].adjustedUnitPrice) : "—"}</td>)}
              </tr>
              <tr>
                <td className="text-muted">Валовая корректировка</td>
                {comps.map((c) => <td key={c.id} className="num text-right text-muted">{res[c.id] ? fmtPercent(res[c.id].grossAdjustment) : "—"}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <Editor
          key={selected.adj.id}
          adj={selected.adj}
          label={selected.label}
          assessmentId={detail.id}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            setSelected(null);
            await reload();
          }}
        />
      )}
      {comps.length > 0 && <div className="flex justify-end"><button className="btn btn-primary" onClick={() => go("calculation")}>Перейти к расчёту →</button></div>}
    </div>
  );
}
