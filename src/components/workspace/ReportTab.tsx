"use client";

import { useState } from "react";
import { api, errorText, ApiError } from "@/lib/api";
import type { CheckIssue } from "@/core/checks";
import type { WsProps } from "./Workspace";

export function ReportTab({ detail, calc, reload, go }: WsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<CheckIssue[] | null>(null);

  async function generate(formats: Array<"docx" | "pdf">, versionId?: string) {
    setBusy(true);
    setError(null);
    setBlocked(null);
    try {
      await api.post(`/api/assessments/${detail.id}/reports`, { formats, versionId });
      await reload();
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) setBlocked((e.details as CheckIssue[]).filter((i) => i.severity === "error"));
      setError(e instanceof ApiError ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-semibold">Сформировать отчёт</div>
            <div className="text-muted">Шаблон «Квартира — сравнительный подход». Перед формированием выполняются все проверки и фиксируется версия расчёта.</div>
            {calc && calc.errors > 0 && (
              <div className="mt-2 text-err">Есть ошибки: {calc.errors}. <button className="underline" onClick={() => go("checks")}>Посмотреть</button></div>
            )}
            {calc && calc.errors === 0 && calc.warnings > 0 && <div className="mt-2 text-warn">Предупреждений: {calc.warnings} — отчёт можно сформировать, но рекомендуем их проверить.</div>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="btn btn-primary px-4 py-2" disabled={busy || !calc?.canGenerate} onClick={() => generate(["docx", "pdf"])}>{busy ? "Формирование…" : "Сформировать DOCX + PDF"}</button>
            <button className="btn btn-secondary py-2" disabled={busy || !calc?.canGenerate} onClick={() => generate(["docx"])}>DOCX</button>
            <button className="btn btn-secondary py-2" disabled={busy || !calc?.canGenerate} onClick={() => generate(["pdf"])}>PDF</button>
          </div>
        </div>
        {error && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-err">{error}{blocked?.map((i, k) => <div key={k} className="text-xs">• {i.message}</div>)}</div>}
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t">Сформированные отчёты</div></div>
        <table className="tbl">
          <thead><tr><th>Дата</th><th>Формат</th><th>Версия расчёта</th><th>Замечания на момент формирования</th><th></th></tr></thead>
          <tbody>
            {detail.reports.map((r) => (
              <tr key={r.id}>
                <td className="num">{new Date(r.createdAt).toLocaleString("ru-RU")}</td>
                <td className="uppercase">{r.format}</td>
                <td>№ {r.calculationVersion.versionNumber}</td>
                <td className="text-xs text-muted">ошибок {r.checks.errors}, предупреждений {r.checks.warnings}</td>
                <td className="text-right"><a className="btn btn-secondary" href={`/api/files/${r.fileId}`}>Скачать</a></td>
              </tr>
            ))}
            {!detail.reports.length && <tr><td colSpan={5} className="py-6 text-center text-muted">Отчёты ещё не формировались.</td></tr>}
          </tbody>
        </table>
      </div>

      {(detail.calculation?.versions.length ?? 0) > 0 && (
        <div className="card">
          <div className="card-h"><div className="card-t">Повторное формирование по зафиксированной версии</div><span className="text-xs text-muted">те же данные и коэффициенты, что на момент расчёта</span></div>
          <ul className="divide-y divide-slate-100">
            {detail.calculation!.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between px-4 py-2">
                <span>Версия № {v.versionNumber} от {new Date(v.createdAt).toLocaleDateString("ru-RU")}</span>
                <span className="flex gap-2">
                  <button className="btn btn-ghost" disabled={busy} onClick={() => generate(["docx"], v.id)}>DOCX</button>
                  <button className="btn btn-ghost" disabled={busy} onClick={() => generate(["pdf"], v.id)}>PDF</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
