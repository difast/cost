"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtNumber, fmtPercent, amountInWords } from "@/core/format";
import { d } from "@/core/calc/decimal";
import type { CalcSettings } from "@/core/calc/types";
import { WEIGHT_METHODS, WEIGHT_ROUNDING_NOTE } from "@/core/calc/weights";
import { ISSUES_MESSAGE, DISPERSION_MESSAGE, calcQuality } from "@/core/calc/quality";
import { AckModal, needsAck, type AckRequest } from "./AckModal";
import { Icon } from "@/components/ui/Icon";
import { Badge, EmptyState, Notice, Panel, toast } from "@/components/ui/kit";
import { NextStep, StepIssues } from "./common";
import type { WsProps } from "./Workspace";

const METHOD_ORDER: CalcSettings["weightMethod"][] = ["inverse_gross", "linear_gross", "equal", "manual"];

export function CalculationTab({ detail, calc, reload, checklist, go }: WsProps) {
  const [ack, setAck] = useState<AckRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Record<string, string>>(calc?.settings.manualWeights ?? {});
  if (!calc) return null;
  const r = calc.result;
  const s = calc.settings;
  const items = checklist?.items.filter((i) => i.step === "calculation") ?? [];

  async function saveSettings(patch: Partial<CalcSettings>) {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/assessments/${detail.id}/calculation`, patch);
      toast("Параметры расчёта применены");
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function commit(acknowledge = false) {
    setBusy(true);
    setError(null);
    try {
      const v = await api.post<{ versionNumber: number; created: boolean }>(`/api/assessments/${detail.id}/calculation`, { acknowledge });
      toast(v.created ? `Расчёт подтверждён: версия № ${v.versionNumber}` : "Расчёт уже подтверждён", "info");
      await reload();
    } catch (e) {
      const issues = needsAck(e);
      if (issues) setAck({ title: "Подтвердить расчёт с замечаниями?", message: `${ISSUES_MESSAGE} Расчёт будет подтверждён, замечания сохранятся в версии и останутся в контроле качества.`, issues, run: () => commit(true) });
      else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const calcErrors = calc.issues.filter((i) => i.section === "calculation" && i.severity === "error");
  const versions = detail.calculation?.versions ?? [];
  const allErrors = calc.issues.filter((i) => i.severity === "error");
  const latest = versions[0] ?? null;
  const q = r ? calcQuality(r) : null;
  const confirmBar = r && (
    <section className={`card mb-4 flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center ${calc.isStale ? (allErrors.length ? "border-err/30" : "border-warn/40") : "border-ok/30"}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${calc.isStale ? (allErrors.length ? "bg-err-soft text-err" : "bg-warn-soft text-warn") : "bg-ok-soft text-ok"}`}>
        <Icon name={calc.isStale ? (allErrors.length ? "error" : "alert") : "check"} size={16} />
      </span>
      <div className="min-w-0 flex-1 text-[13px]">
        {!calc.isStale && latest ? (
          <>
            <div className="font-medium text-ink">Расчёт подтверждён: версия № {latest.versionNumber}</div>
            <div className="text-muted">{latest.createdByName ?? "оценщик"} · {new Date(latest.createdAt).toLocaleString("ru-RU")} · снимок данных неизменен, отчёт формируется из него</div>
          </>
        ) : (
          <>
            <div className="font-medium text-ink">{latest ? `Данные изменились после подтверждения версии № ${latest.versionNumber} — расчёт требует обновления` : "Расчёт ещё не подтверждён"}</div>
            <div className={allErrors.length ? "text-err" : "text-muted"}>
              {allErrors.length ? `${ISSUES_MESSAGE} Ошибок: ${allErrors.length} — расчёт можно подтвердить с замечаниями.` : "При подтверждении сохраняется неизменяемый снимок: объект, аналоги, корректировки, коэффициенты, веса, формулы и итог."}
            </div>
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {allErrors.length > 0 && <button className="btn btn-secondary" onClick={() => go("checks")}>Замечания</button>}
        {calc.isStale ? (
          <button className="btn btn-primary" disabled={busy} onClick={() => commit()}><Icon name="check" size={15} />Подтвердить расчёт</button>
        ) : (
          <a className="btn btn-secondary" href={`/api/assessments/${detail.id}/calculation/xlsx`}><Icon name="download" size={15} />Расчёт XLSX</a>
        )}
      </div>
    </section>
  );

  const settingsPanel = (
    <Panel title="Параметры расчёта">
      <div className="space-y-3">
        <div>
          <label className="label">Порядок корректировок</label>
          <select className="input" value={s.adjustmentMode} disabled={busy} onChange={(e) => saveSettings({ adjustmentMode: e.target.value as CalcSettings["adjustmentMode"] })}>
            <option value="sequential">Последовательно (мультипликативно)</option>
            <option value="staged">1-я группа последовательно, 2-я — суммой</option>
          </select>
        </div>
        <div>
          <label className="label">Метод расчёта весов</label>
          <select className="input" value={s.weightMethod} disabled={busy} onChange={(e) => saveSettings({ weightMethod: e.target.value as CalcSettings["weightMethod"] })}>
            {METHOD_ORDER.map((v) => <option key={v} value={v}>{WEIGHT_METHODS[v].label}</option>)}
          </select>
          <div className="mt-1.5 rounded-md bg-canvas px-2.5 py-2 text-[12px] leading-snug text-zinc-700">
            <div className="num font-medium text-ink">{WEIGHT_METHODS[s.weightMethod].formula}</div>
            <div className="mt-0.5 text-muted">{WEIGHT_METHODS[s.weightMethod].explanation} {WEIGHT_ROUNDING_NOTE}</div>
          </div>
        </div>
        {s.weightMethod === "manual" && (
          <div className="rounded-md border border-line bg-canvas p-3">
            <div className="mb-2 text-[12px] text-muted">Сумма весов должна быть равна 1</div>
            <div className="grid grid-cols-2 gap-2">
              {detail.comparables.filter((c) => c.included).map((c) => (
                <div key={c.id}>
                  <label className="label">{calc.labels[c.id]}</label>
                  <input className="input num" value={weights[c.id] ?? ""} placeholder="0,3333" onChange={(e) => setWeights({ ...weights, [c.id]: e.target.value.replace(",", ".") })} />
                </div>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm mt-2" disabled={busy} onClick={() => saveSettings({ manualWeights: weights })}>Применить веса</button>
          </div>
        )}
        <div>
          <label className="label">Округление итога</label>
          <select className="input" value={s.roundingStep} disabled={busy} onChange={(e) => saveSettings({ roundingStep: e.target.value })}>
            {["0", "100", "1000", "10000", "100000"].map((v) => <option key={v} value={v}>{v === "0" ? "Без округления" : `До ${fmtNumber(v, 0)} ₽`}</option>)}
          </select>
        </div>
      </div>
    </Panel>
  );

  return (
    <div>
      <StepIssues items={items} go={go} />
      {error && <Notice tone="err" className="mb-4">{error}</Notice>}
      {calcErrors.length > 0 && <Notice tone="err" className="mb-4" title="Расчёт содержит ошибки">{calcErrors.map((i, k) => <div key={k}>{i.message}</div>)}</Notice>}

      {confirmBar}
      {!r ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="card">
            <EmptyState icon="calculator" title="Расчёт пока не выполнен" action={<button className="btn btn-primary" onClick={() => go("comparables")}>Перейти к аналогам</button>}>
              Для расчёта нужны площадь объекта и хотя бы один аналог, включённый в расчёт.
            </EmptyState>
          </div>
          {settingsPanel}
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="card overflow-hidden">
              <div className="grid gap-px bg-line md:grid-cols-[1.25fr_1fr]">
                <div className="bg-white px-5 py-5">
                  <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-muted">Итоговая стоимость</div>
                  <div className="num mt-1.5 text-[34px] font-semibold leading-none tracking-[-0.02em] text-ink sm:text-[40px]">{fmtNumber(r.finalValue, 0)} ₽</div>
                  <div className="num mt-2 text-[15px] text-zinc-700">{fmtNumber(r.finalUnitPrice, 0)} ₽ / м²</div>
                  <div className="mt-2 text-[12px] text-muted first-letter:uppercase">{amountInWords(r.finalValue)}</div>
                </div>
                <dl className="space-y-2.5 bg-white px-5 py-5 text-[13px]">
                  <div>
                    <dt className="text-muted">Средневзвешенная цена 1 м²</dt>
                    <dd className="num font-medium">{fmtNumber(r.weightedUnitPrice)} ₽</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Стоимость до округления</dt>
                    <dd className="tnum break-words">{r.rawValueFormula} ₽</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Округление</dt>
                    <dd className="tnum break-words">{r.finalValueFormula}</dd>
                  </div>
                </dl>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line bg-canvas/60 px-5 py-2.5 text-[12.5px]">
                <span><span className="text-muted">Аналогов: </span><span className="num">{r.stats.count}</span></span>
                <span><span className="text-muted">Мин–макс: </span><span className="num">{fmtNumber(r.stats.min, 0)} – {fmtNumber(r.stats.max, 0)} ₽/м²</span></span>
                <span><span className="text-muted">Медиана: </span><span className="num">{fmtNumber(r.stats.median, 0)} ₽/м²</span></span>
                <span><span className="text-muted">Коэф. вариации: </span><span className={`num ${d(r.stats.cv).gt(s.cvThreshold) ? "text-warn" : ""}`}>{fmtPercent(r.stats.cv)}</span></span>
              </div>
            </section>
            {settingsPanel}
          </div>

          <Panel className="mt-4" title="Расчёт по аналогам" description="Исходная цена → корректировки → скорректированная цена → вес → вклад в стоимость 1 м²" bodyClassName="">
            <div className="overflow-x-auto">
              <table className="tbl min-w-[860px]">
                <thead>
                  <tr>
                    <th>Аналог</th>
                    <th className="text-right">Цена предложения, ₽</th>
                    <th className="text-right">Площадь, м²</th>
                    <th className="text-right">Цена 1 м², ₽</th>
                    <th className="text-right">Изменение</th>
                    <th className="text-right">Скорр. цена 1 м², ₽</th>
                    <th className="text-right">Вес</th>
                    <th className="text-right">Вклад, ₽/м²</th>
                  </tr>
                </thead>
                <tbody>
                  {r.comparables.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.label}</td>
                      <td className="num text-right">{fmtNumber(c.price, 0)}</td>
                      <td className="num text-right">{fmtNumber(c.area, 2, true)}</td>
                      <td className="num text-right">{fmtNumber(c.unitPrice)}</td>
                      <td className={`num text-right ${d(c.totalChange).isNeg() ? "text-err" : "text-ok"}`}>{fmtPercent(c.totalChange, 2, true)}</td>
                      <td className="num text-right font-semibold">{fmtNumber(c.adjustedUnitPrice)}</td>
                      <td className="num text-right">{c.weight.replace(".", ",")}</td>
                      <td className="num text-right">{fmtNumber(c.contribution)}</td>
                    </tr>
                  ))}
                  <tr className="bg-canvas font-semibold">
                    <td colSpan={6}>Средневзвешенная цена 1 м²</td>
                    <td className="num text-right">{r.weightsSum.replace(".", ",")}</td>
                    <td className="num text-right">{fmtNumber(r.weightedUnitPrice)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel className="mt-4" title="Цепочка корректировок" description="Каждый шаг округлён до копеек — любую цифру можно проверить вручную" bodyClassName="">
            <div className="grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
              {r.comparables.map((c) => {
                const zero = c.steps.filter((st) => d(st.value).isZero());
                return (
                  <div key={c.id} className="bg-white p-4">
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="font-semibold">{c.label}</span>
                      <span className="text-[11.5px] text-muted">Σ|корр| {fmtPercent(c.grossAdjustment)}</span>
                    </div>
                    <table className="w-full text-[12.5px]">
                      <tbody>
                        <tr className="border-b border-line/70"><td className="py-1 text-muted">Цена 1 м²</td><td className="tnum py-1 pl-2 text-right text-muted">{c.unitPriceFormula}</td></tr>
                        {c.steps.filter((st) => !d(st.value).isZero()).map((st) => (
                          <tr key={st.code} className="border-b border-line/70">
                            <td className="py-1"><span className="num text-zinc-700">× {fmtNumber(d(1).plus(st.value), 4)}</span> — {st.name.toLowerCase()} <span className={`num ${d(st.value).isNeg() ? "text-err" : "text-ok"}`}>({fmtPercent(st.value, 2, true)})</span></td>
                            <td className="num py-1 text-right">{fmtNumber(st.after)}</td>
                          </tr>
                        ))}
                        <tr><td className="pt-1.5 font-semibold">Скорректированная цена</td><td className="num pt-1.5 text-right font-semibold">{fmtNumber(c.adjustedUnitPrice)}</td></tr>
                      </tbody>
                    </table>
                    {zero.length > 0 && <div className="mt-2 text-[11.5px] text-muted">Без изменений (0 %): {zero.map((z) => z.name.toLowerCase()).join(", ")}</div>}
                    <div className="mt-2 break-words text-[11.5px] text-muted">Вес: <span className="tnum">{c.weightFormula}</span></div>
                  </div>
                );
              })}
            </div>
          </Panel>
          {r.warnings.length > 0 && (
            <Notice tone="warn" className="mt-4" title="Замечания к выборке">{r.warnings.map((w) => <div key={w}>{w}</div>)}</Notice>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Формула итоговой стоимости">
              <dl className="space-y-3 text-[13px]">
                <div>
                  <dt className="text-muted">Итоговая цена 1 м² = Σ (скорректированная цена аналога × вес)</dt>
                  <dd className="tnum mt-0.5 break-words text-ink">{r.weightedUnitPriceFormula} ₽/м²</dd>
                </div>
                <div>
                  <dt className="text-muted">Веса: {WEIGHT_METHODS[r.settings.weightMethod].label.toLowerCase()}</dt>
                  <dd className="tnum break-words mt-0.5 text-ink">{WEIGHT_METHODS[r.settings.weightMethod].formula}; сумма весов {r.weightsSum.replace(".", ",")}</dd>
                </div>
                <div>
                  <dt className="text-muted">Итоговая стоимость = итоговая цена 1 м² × площадь объекта ({fmtNumber(r.subjectArea, 2, true)} м², карточка объекта)</dt>
                  <dd className="tnum mt-0.5 break-words text-ink">{r.rawValueFormula} ₽ → {r.finalValueFormula} ₽</dd>
                </div>
                <div className="text-[12px] text-muted">Источники: цены и площади аналогов — карточки аналогов (снимок объявления); коэффициенты — {detail.adjustmentSource ? `${detail.adjustmentSource.name}, ред. ${detail.adjustmentSource.edition}${detail.adjustmentSource.isDemo ? " (демонстрационные значения)" : ""}` : "справочник не выбран"} и ручные значения оценщика с обоснованием.</div>
              </dl>
            </Panel>
            {q && (
              <Panel title="Контроль расчёта">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                  <div><dt className="text-muted">Аналогов</dt><dd className="tnum break-words text-ink">{q.count}</dd></div>
                  <div><dt className="text-muted">Средневзвешенная цена</dt><dd className="tnum break-words text-ink">{fmtNumber(q.weighted, 0)} ₽/м²</dd></div>
                  <div><dt className="text-muted">Исходные цены</dt><dd className="tnum break-words text-ink">{fmtNumber(q.rawMin, 0)} – {fmtNumber(q.rawMax, 0)}</dd></div>
                  <div><dt className="text-muted">Скорректированные цены</dt><dd className="tnum break-words text-ink">{fmtNumber(q.adjustedMin, 0)} – {fmtNumber(q.adjustedMax, 0)}</dd></div>
                  <div><dt className="text-muted">Средняя скорректированная</dt><dd className="tnum break-words text-ink">{fmtNumber(q.adjustedMean, 0)} ₽/м²</dd></div>
                  <div><dt className="text-muted">Наибольшая валовая корректировка</dt><dd className="tnum break-words text-ink">{fmtPercent(q.maxGross)}</dd></div>
                  <div className="col-span-2"><dt className="text-muted">Наибольшая / наименьшая корректировка</dt><dd className="tnum break-words text-ink">{q.maxAdjustment ? `${fmtPercent(q.maxAdjustment.value, 2, true)} (${q.maxAdjustment.label}, ${q.maxAdjustment.factor.toLowerCase()})` : "—"} / {q.minAdjustment ? `${fmtPercent(q.minAdjustment.value, 2, true)} (${q.minAdjustment.label}, ${q.minAdjustment.factor.toLowerCase()})` : "—"}</dd></div>
                  <div className="col-span-2"><dt className="text-muted">Суммарные корректировки по аналогам (итог / валовая)</dt><dd className="tnum break-words text-ink">{q.perComparable.map((x) => `${x.label}: ${fmtPercent(x.totalChange, 1, true)} / ${fmtPercent(x.grossAdjustment, 1)}`).join("; ")}</dd></div>
                  <div><dt className="text-muted">Разброс до корректировок</dt><dd className="tnum break-words text-ink">коэф. вариации {fmtPercent(q.cvBefore)}</dd></div>
                  <div><dt className="text-muted">Разброс после корректировок</dt><dd className={`tnum break-words ${q.dispersionGrew ? "text-warn" : "text-ink"}`}>коэф. вариации {fmtPercent(q.cvAfter)}</dd></div>
                </dl>
                {q.dispersionGrew && <Notice tone="warn" className="mt-3">{DISPERSION_MESSAGE}</Notice>}
                {allErrors.length > 0 && <Notice tone="warn" className="mt-3">{ISSUES_MESSAGE} Ошибок: {allErrors.length}. <button className="underline-offset-2 hover:underline" onClick={() => go("checks")}>Открыть контроль качества</button></Notice>}
              </Panel>
            )}
          </div>
        </>
      )}

      <Panel
        className="mt-4"
        title="Версии расчёта"
        description="Версия хранит полный снимок данных и коэффициентов — старую оценку можно воспроизвести в точности"
        actions={
          <button className="btn btn-secondary btn-sm" disabled={busy || !r || !calc.isStale} onClick={() => commit()}>
            {calc.isStale ? <><Icon name="check" size={14} />Подтвердить расчёт</> : "Версия актуальна"}
          </button>
        }
        bodyClassName=""
      >
        {versions.length ? (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[640px]">
              <thead><tr><th>Версия</th><th>Дата</th><th>Подтвердил</th><th className="text-right">Стоимость, ₽</th><th className="text-right">₽/м²</th><th>Ядро расчёта</th><th>Хэш входных данных</th><th className="w-0"></th></tr></thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium">№ {v.versionNumber} {calc.latestVersion?.id === v.id && !calc.isStale && <Badge tone="ok">актуальна</Badge>}</td>
                    <td className="num">{new Date(v.createdAt).toLocaleString("ru-RU")}</td>
                    <td className="text-[12.5px]">{v.createdByName ?? "—"}</td>
                    <td className="num text-right">{fmtNumber(v.result.finalValue, 0)}</td>
                    <td className="num text-right">{fmtNumber(v.result.finalUnitPrice, 0)}</td>
                    <td className="text-[12px] text-muted">{v.engineVersion}</td>
                    <td className="font-mono text-[12px] text-muted">{v.inputHash.slice(0, 12)}</td>
                    <td><a className="btn btn-ghost btn-sm" href={`/api/assessments/${detail.id}/calculation/xlsx?versionId=${v.id}`}><Icon name="download" size={13} />XLSX</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-4 text-[13px] text-muted">Версий пока нет. Версия фиксируется вручную или автоматически при формировании отчёта.</p>
        )}
      </Panel>
      <AckModal req={ack} onClose={() => setAck(null)} />
      {r && <NextStep to="checks" go={go} />}
    </div>
  );
}
