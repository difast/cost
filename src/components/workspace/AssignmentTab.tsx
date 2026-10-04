"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { Field, SaveBar, Select, TextArea, TextInput } from "@/components/ui/Field";
import { useDraft } from "@/components/ui/useDraft";
import type { WsProps } from "./Workspace";

const PURPOSES = [
  "Определение рыночной стоимости для целей ипотечного кредитования",
  "Определение рыночной стоимости для совершения сделки купли-продажи",
  "Определение рыночной стоимости для целей наследования",
  "Определение рыночной стоимости для целей судопроизводства",
  "Определение рыночной стоимости для целей раздела имущества",
];

export function AssignmentTab({ detail, reload }: WsProps) {
  const init = {
    number: detail.number, status: detail.status,
    customerName: detail.customerName, customerDetails: detail.customerDetails,
    basis: detail.basis, contractNumber: detail.contractNumber, contractDate: detail.contractDate,
    purpose: detail.purpose, intendedUse: detail.intendedUse, valueType: detail.valueType, rightsAssessed: detail.rightsAssessed,
    valuationDate: detail.valuationDate, inspectionDate: detail.inspectionDate, reportDate: detail.reportDate,
    assumptions: detail.assumptions, limitingConditions: detail.limitingConditions, marketAnalysis: detail.marketAnalysis,
  };
  const { draft: d, set, dirty, changes, reset } = useDraft(init);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/assessments/${detail.id}`, changes);
      setSaved(true);
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="card-t mb-3">Задание на оценку</div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Номер отчёта"><TextInput d={d} k="number" set={set} /></Field>
          <Field label="Статус">
            <Select d={d} k="status" set={set} options={[["draft", "Черновик"], ["in_progress", "В работе"], ["review", "На проверке"], ["completed", "Завершена"], ["archived", "Архив"]]} />
          </Field>
          <Field label="Вид стоимости"><TextInput d={d} k="valueType" set={set} /></Field>
          <Field label="Дата оценки" hint="Единственный источник даты оценки для всего отчёта"><TextInput d={d} k="valuationDate" set={set} type="date" /></Field>
          <Field label="Дата осмотра"><TextInput d={d} k="inspectionDate" set={set} type="date" /></Field>
          <Field label="Дата составления отчёта"><TextInput d={d} k="reportDate" set={set} type="date" /></Field>
          <Field label="Цель оценки" className="md:col-span-2">
            <input className="input" list="purposes" value={(d.purpose as string) ?? ""} onChange={(e) => set("purpose", e.target.value)} />
            <datalist id="purposes">{PURPOSES.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="Оцениваемые права"><TextInput d={d} k="rightsAssessed" set={set} /></Field>
          <Field label="Предполагаемое использование результата" className="md:col-span-3"><TextInput d={d} k="intendedUse" set={set} /></Field>
        </div>
      </div>
      <div className="card p-4">
        <div className="card-t mb-3">Заказчик и договор</div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Заказчик (ФИО / наименование)" className="md:col-span-2"><TextInput d={d} k="customerName" set={set} /></Field>
          <Field label="Основание"><TextInput d={d} k="basis" set={set} placeholder="Договор на проведение оценки" /></Field>
          <Field label="Реквизиты заказчика" className="md:col-span-2"><TextArea d={d} k="customerDetails" set={set} rows={2} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="№ договора"><TextInput d={d} k="contractNumber" set={set} /></Field>
            <Field label="Дата договора"><TextInput d={d} k="contractDate" set={set} type="date" /></Field>
          </div>
        </div>
      </div>
      <div className="card p-4">
        <div className="card-t mb-3">Допущения, ограничения и анализ рынка</div>
        <div className="grid gap-3">
          <Field label="Допущения" hint="Проверяется на упоминание чужих кадастровых номеров, дат и площадей"><TextArea d={d} k="assumptions" set={set} rows={4} /></Field>
          <Field label="Ограничительные условия"><TextArea d={d} k="limitingConditions" set={set} rows={3} /></Field>
          <Field label="Анализ рынка (текст раздела отчёта)" hint="Статистика по аналогам добавляется в раздел автоматически. Абзацы разделяйте пустой строкой."><TextArea d={d} k="marketAnalysis" set={set} rows={6} /></Field>
        </div>
      </div>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={reset} error={error} saved={saved} />
    </div>
  );
}
