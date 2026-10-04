"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate, fmtNumber, fmtPercent } from "@/core/format";
import type { CalcSettings } from "@/core/calc/types";
import type { WsProps } from "./Workspace";

const WEIGHT_METHODS: Array<[CalcSettings["weightMethod"], string]> = [
  ["inverse_gross", "Обратно валовой корректировке: 1/(1+Σ|корр|)"],
  ["linear_gross", "(S − s_i) / ((n − 1)·S)"],
  ["equal", "Равные веса"],
  ["manual", "Задать вручную"],
];

export function CalculationTab({ detail, calc, reload, go }: WsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Record<string, string>>(calc?.settings.manualWeights ?? {});
  if (!calc) return <div className="text-muted">Загрузка…</div>;
  const r = calc.result;
  const s = calc.settings;

  async function saveSettings(patch: Partial<CalcSettings>) {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/assessments/${detail.id}/calculation`, patch);
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/assessments/${detail.id}/calculation`, {});
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const calcErrors = calc.issues.filter((i) => i.section === "calculation" && i.severity === "error");

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="card-t mb-3">Параметры расчёта</div>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="label">Порядок применения корректировок</label>
            <select className="input" value={s.adjustmentMode} disabled={busy} onChange={(e) => saveSettings({ adjustmentMode: e.target.value as CalcSettings["adjustmentMode"] })}>
              <option value="sequential">Последовательно (мультипликативно)</option>
              <option value="staged">1-я группа последовательно, 2-я — суммой</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Метод расчёта весов</label>
            <select className="input" value={s.weightMethod} disabled={busy} onChange={(e) => saveSettings({ weightMethod: e.target.value as CalcSettings["weightMethod"] })}>
              {WEIGHT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Округление итога, ₽</label>
            <select className="input" value={s.roundingStep} disabled={busy} onChange={(e) => saveSettings({ roundingStep: e.target.value })}>
              {["0", "100", "1000", "10000", "100000"].map((v) => <option key={v} value={v}>{v === "0" ? "без округления" : `до ${fmtNumber(v, 0)}`}</option>)}
            </select>
          </div>
        </div>
        {s.weightMethod === "manual" && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {detail.comparables.filter((c) => c.included).map((c) => (
              <div key={c.id} className="w-32">
                <label className="label">{calc.labels[c.id]}</label>
                <input className="input num" value={weights[c.id] ?? ""} placeholder="0.3333" onChange={(e) => setWeights({ ...weights, [c.id]: e.target.value.replace(",", ".") })} />
              </div>
            ))}
            <button className="btn btn-secondary" disabled={busy} onClick={() => saveSettings({ manualWeights: weights })}>Применить веса</button>
          </div>
        )}
        {error && <div className="mt-2 text-err">{error}</div>}
      </div>

      {calcErrors.length > 0 && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-err">{calcErrors.map((i, k) => <div key={k}>{i.message}</div>)}</div>
      )}

      {!r ? (
        <div className="card p-10 text-center text-muted">
          Для расчёта нужны площадь объекта и хотя бы один включённый аналог.{" "}
          <button className="text-brand underline" onClick={() => go("comparables")}>Перейти к аналогам</button>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-h"><div className="card-t">Цепочка расчёта по аналогам</div><span className="text-xs text-muted">каждый шаг округлён до копеек</span></div>
            <div className="grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
              {r.comparables.map((c) => (
                <div key={c.id} className="bg-white p-4">
                  <div className="mb-2 font-semibold">{c.label}</div>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr><td className="py-0.5 text-muted">Цена за м²</td><td className="num py-0.5 text-right">{c.unitPriceFormula}</td></tr>
                      {c.steps.map((st) => (
                        <tr key={st.code} className={Number(st.value) === 0 ? "text-slate-400" : ""}>
                          <td className="py-0.5 pr-2">{st.name} <span className="num">{fmtPercent(st.value, 2, true)}</span></td>
                          <td className="num py-0.5 text-right">{fmtNumber(st.after)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-line font-semibold"><td className="pt-1">Скорректированная цена</td><td className="num pt-1 text-right">{fmtNumber(c.adjustedUnitPrice)}</td></tr>
                      <tr className="text-muted"><td>Изменение / Σ|корр|</td><td className="num text-right">{fmtPercent(c.totalChange, 2, true)} / {fmtPercent(c.grossAdjustment)}</td></tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="card xl:col-span-2">
              <div className="card-h"><div className="card-t">Весовые коэффициенты</div></div>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Аналог</th><th className="text-right">Скорр. ₽/м²</th><th className="text-right">Σ|корр|</th><th>Расчёт веса</th><th className="text-right">Вес</th><th className="text-right">Вклад, ₽/м²</th></tr></thead>
                  <tbody>
                    {r.comparables.map((c) => (
                      <tr key={c.id}>
                        <td>{c.label}</td>
                        <td className="num text-right">{fmtNumber(c.adjustedUnitPrice)}</td>
                        <td className="num text-right">{fmtPercent(c.grossAdjustment)}</td>
                        <td className="text-xs tabular-nums text-muted">{c.weightFormula}</td>
                        <td className="num text-right">{c.weight}</td>
                        <td className="num text-right">{fmtNumber(c.contribution)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold"><td>Итого</td><td></td><td></td><td></td><td className="num text-right">{r.weightsSum}</td><td className="num text-right">{fmtNumber(r.weightedUnitPrice)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><div className="card-t">Статистика выборки, ₽/м²</div></div>
              <table className="tbl">
                <tbody>
                  {[["Минимум", fmtNumber(r.stats.min)], ["Максимум", fmtNumber(r.stats.max)], ["Среднее", fmtNumber(r.stats.mean)], ["Медиана", fmtNumber(r.stats.median)], ["Диапазон", fmtNumber(r.stats.range)], ["Коэф. вариации", fmtPercent(r.stats.cv)], ["Max / Min", fmtNumber(r.stats.maxMinRatio, 4)]].map(([k, v]) => (
                    <tr key={k}><td className="text-muted">{k}</td><td className="num text-right">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-4">
            <div className="card-t mb-3">Итог</div>
            <table className="tbl">
              <tbody>
                <tr><td className="text-muted">Средневзвешенная цена 1 м²</td><td className="num text-xs text-muted">{r.weightedUnitPriceFormula}</td><td className="num text-right">{fmtNumber(r.weightedUnitPrice)} ₽</td></tr>
                <tr><td className="text-muted">Стоимость до округления</td><td className="num text-xs text-muted">{r.rawValueFormula}</td><td className="num text-right">{fmtNumber(r.rawValue)} ₽</td></tr>
                <tr className="text-base font-semibold"><td>Рыночная стоимость</td><td className="num text-xs font-normal text-muted">{r.finalValueFormula}</td><td className="num text-right">{fmtNumber(r.finalValue, 0)} ₽</td></tr>
                <tr><td className="text-muted">Стоимость 1 м²</td><td className="num text-xs text-muted">{fmtNumber(r.finalValue, 0)} / {fmtNumber(r.subjectArea, 2, true)}</td><td className="num text-right">{fmtNumber(r.finalUnitPrice)} ₽</td></tr>
              </tbody>
            </table>
            {r.warnings.length > 0 && <div className="mt-3 space-y-1 text-xs text-warn">{r.warnings.map((w) => <div key={w}>⚠ {w}</div>)}</div>}
          </div>
        </>
      )}

      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-t">Версии расчёта</div>
            <div className="text-xs text-muted">Версия хранит полный снимок данных и коэффициентов — старая оценка всегда открывается с теми значениями, что действовали тогда.</div>
          </div>
          <button className="btn btn-secondary" disabled={busy || !r} onClick={commit}>{calc.isStale ? "Зафиксировать версию" : "Версия актуальна"}</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Версия</th><th>Дата</th><th className="text-right">Стоимость, ₽</th><th className="text-right">₽/м²</th><th>Ядро</th><th>Хэш входных данных</th></tr></thead>
          <tbody>
            {(detail.calculation?.versions ?? []).map((v) => (
              <tr key={v.id}>
                <td>№ {v.versionNumber}{calc.latestVersion?.id === v.id && !calc.isStale && <span className="badge ml-2 bg-green-50 text-ok">актуальна</span>}</td>
                <td className="num">{new Date(v.createdAt).toLocaleString("ru-RU")}</td>
                <td className="num text-right">{fmtNumber(v.result.finalValue, 0)}</td>
                <td className="num text-right">{fmtNumber(v.result.finalUnitPrice)}</td>
                <td className="text-xs text-muted">{v.engineVersion}</td>
                <td className="font-mono text-xs text-muted">{v.inputHash.slice(0, 12)}</td>
              </tr>
            ))}
            {!detail.calculation?.versions.length && <tr><td colSpan={6} className="py-4 text-center text-muted">Версий пока нет. Версия фиксируется автоматически при формировании отчёта.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="text-right text-xs text-muted">Дата оценки: {fmtDate(detail.valuationDate)}</div>
    </div>
  );
}
