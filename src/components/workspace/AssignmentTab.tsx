"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { Field, SaveBar, Select, TextArea, TextInput } from "@/components/ui/Field";
import { useDraft } from "@/components/ui/useDraft";
import { Panel, toast } from "@/components/ui/kit";
import { NextStep, StepIssues } from "./common";
import type { WsProps } from "./Workspace";

const PURPOSES = [
  "Определение рыночной стоимости для целей ипотечного кредитования",
  "Определение рыночной стоимости для совершения сделки купли-продажи",
  "Определение рыночной стоимости для целей наследования",
  "Определение рыночной стоимости для целей судопроизводства",
  "Определение рыночной стоимости для целей раздела имущества",
];

export function AssignmentTab({ detail, reload, checklist, go }: WsProps) {
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
      toast("Задание сохранено");
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const items = checklist?.items.filter((i) => i.step === "assignment") ?? [];

  return (
    <div>
      <StepIssues items={items} go={go} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel title="Основные сведения">
            <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
              <Field field="customerName" label="Заказчик" required className="md:col-span-2"><TextInput d={d} k="customerName" set={set} placeholder="ФИО или наименование" /></Field>
              <Field field="valueType" label="Вид стоимости" required><TextInput d={d} k="valueType" set={set} /></Field>
              <Field field="purpose" label="Цель оценки" required className="md:col-span-2">
                <input className="input" list="purposes" value={(d.purpose as string) ?? ""} onChange={(e) => set("purpose", e.target.value)} />
                <datalist id="purposes">{PURPOSES.map((p) => <option key={p} value={p} />)}</datalist>
              </Field>
              <Field field="rightsAssessed" label="Оцениваемые права" required><TextInput d={d} k="rightsAssessed" set={set} /></Field>
              <Field field="valuationDate" label="Дата оценки" required hint="Единая дата для всех разделов отчёта"><TextInput d={d} k="valuationDate" set={set} type="date" /></Field>
              <Field field="inspectionDate" label="Дата осмотра"><TextInput d={d} k="inspectionDate" set={set} type="date" /></Field>
              <Field field="reportDate" label="Дата составления отчёта" required><TextInput d={d} k="reportDate" set={set} type="date" /></Field>
              <Field field="intendedUse" label="Предполагаемое использование результата" className="md:col-span-2 xl:col-span-3"><TextInput d={d} k="intendedUse" set={set} /></Field>
              <Field field="customerDetails" label="Реквизиты заказчика" className="md:col-span-2 xl:col-span-3"><TextArea d={d} k="customerDetails" set={set} rows={2} placeholder="Паспортные данные или реквизиты организации" /></Field>
            </div>
          </Panel>

          <Panel title="Допущения и ограничения" description="Тексты проверяются на кадастровые номера, даты и площади другого объекта">
            <div className="grid gap-3">
              <Field field="assumptions" label="Допущения"><TextArea d={d} k="assumptions" set={set} rows={4} /></Field>
              <Field field="limitingConditions" label="Ограничительные условия"><TextArea d={d} k="limitingConditions" set={set} rows={3} /></Field>
            </div>
          </Panel>

          <Panel title="Анализ рынка" description="Текст раздела отчёта. Статистика по аналогам добавляется автоматически. Абзацы разделяйте пустой строкой.">
            <TextArea d={d} k="marketAnalysis" set={set} rows={6} />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Договор и отчёт">
            <div className="grid gap-3">
              <Field field="number" label="Номер отчёта"><TextInput d={d} k="number" set={set} /></Field>
              <Field label="Статус оценки">
                <Select d={d} k="status" set={set} options={[["draft", "Черновик"], ["in_progress", "В работе"], ["review", "На проверке"], ["completed", "Завершена"], ["archived", "Архив"]]} />
              </Field>
              <Field field="basis" label="Основание" required><TextInput d={d} k="basis" set={set} placeholder="Договор на проведение оценки" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field field="contractNumber" label="№ договора" required><TextInput d={d} k="contractNumber" set={set} /></Field>
                <Field field="contractDate" label="Дата договора" required><TextInput d={d} k="contractDate" set={set} type="date" /></Field>
              </div>
            </div>
          </Panel>
          <Panel title="Документы">
            <p className="text-[13px] text-muted">Выписка ЕГРН, правоустанавливающие документы и фотографии загружаются на этапе «Объект» и попадают в приложения к отчёту.</p>
            <button className="btn btn-secondary btn-sm mt-3" onClick={() => go("property")}>Перейти к документам</button>
          </Panel>
        </div>
      </div>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={reset} error={error} saved={saved} />
      {!dirty && <NextStep to="property" go={go} />}
    </div>
  );
}
