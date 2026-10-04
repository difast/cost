"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errorText, ApiError } from "@/lib/api";
import type { CheckIssue } from "@/core/checks";
import { fmtNumber } from "@/core/format";
import { Icon } from "@/components/ui/Icon";
import { Badge, Notice, Panel, toast } from "@/components/ui/kit";
import type { WsProps, TabKey } from "./Workspace";

const SECTION_TAB: Record<string, TabKey | "profile"> = {
  assignment: "assignment", text: "assignment", property: "property", comparables: "comparables",
  adjustments: "adjustments", calculation: "calculation", appraiser: "profile",
};

export function ReportTab({ detail, calc, checklist, reload, go }: WsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<CheckIssue[] | null>(null);

  async function generate(formats: Array<"docx" | "pdf">, versionId?: string) {
    setBusy(versionId ?? formats.join("+"));
    setError(null);
    setBlocked(null);
    try {
      await api.post(`/api/assessments/${detail.id}/reports`, { formats, versionId });
      toast("Отчёт сформирован");
      await reload();
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) setBlocked((e.details as CheckIssue[]).filter((i) => i.severity === "error"));
      setError(e instanceof ApiError ? e.message : errorText(e));
    } finally {
      setBusy(null);
    }
  }

  if (!calc) return null;
  const errors = calc.issues.filter((i) => i.severity === "error");
  const ready = calc.canGenerate;
  const cl = checklist;

  // Последние отчёты по версии: группируем DOCX/PDF одной версии
  const groups = new Map<number, typeof detail.reports>();
  for (const rep of detail.reports) {
    const k = rep.calculationVersion.versionNumber;
    groups.set(k, [...(groups.get(k) ?? []), rep]);
  }
  const latestVersion = detail.calculation?.versions[0];
  const latestGroup = latestVersion ? groups.get(latestVersion.versionNumber) : undefined;
  const upToDate = !!latestGroup && !calc.isStale;

  const fixLink = (i: CheckIssue) => {
    const t = SECTION_TAB[i.section];
    return t === "profile" ? (
      <Link href="/app/profile" className="btn btn-secondary btn-sm shrink-0">Исправить</Link>
    ) : (
      <button className="btn btn-secondary btn-sm shrink-0" onClick={() => go(t)}>Исправить</button>
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <section className={`card overflow-hidden ${ready ? "" : "border-err/30"}`}>
          <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ready ? "bg-ok-soft text-ok" : "bg-err-soft text-err"}`}>
                <Icon name={ready ? "file" : "error"} size={20} />
              </span>
              <div>
                <h2 className="text-[17px] font-semibold text-ink">
                  {upToDate ? "Отчёт готов" : ready ? "Отчёт можно сформировать" : "Формирование отчёта заблокировано"}
                </h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  {ready
                    ? "Шаблон «Квартира — сравнительный подход». При формировании фиксируется версия расчёта."
                    : `Исправьте ошибки (${errors.length}) — после этого отчёт станет доступен.`}
                </p>
                {cl && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
                    <Badge tone={cl.errors ? "err" : cl.warnings ? "warn" : "ok"}>Проверки {cl.passed} / {cl.total}</Badge>
                    {cl.warnings > 0 && <span className="text-warn">предупреждений: {cl.warnings}</span>}
                    {calc.result && <span className="num text-zinc-700">Итог: {fmtNumber(calc.result.finalValue, 0)} ₽</span>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button className="btn btn-primary btn-lg" disabled={!!busy || !ready} onClick={() => generate(["docx", "pdf"])}>
                {busy === "docx+pdf" ? "Формирование…" : upToDate ? "Сформировать заново" : "Сформировать DOCX и PDF"}
              </button>
            </div>
          </div>

          {upToDate && latestGroup && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3">
              <span className="mr-auto text-[12.5px] text-muted">Версия расчёта № {latestVersion!.versionNumber} · {new Date(latestGroup[0].createdAt).toLocaleString("ru-RU")}</span>
              {latestGroup.map((rep) => (
                <a key={rep.id} href={`/api/files/${rep.fileId}`} className="btn btn-secondary"><Icon name="download" size={15} />Скачать {rep.format.toUpperCase()}</a>
              ))}
            </div>
          )}

          {!ready && errors.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {errors.map((i, k) => (
                <li key={k} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                  <Icon name="error" size={15} className="text-err" />
                  <span className="flex-1 text-zinc-800">{i.message}</span>
                  {fixLink(i)}
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && (
          <Notice tone="err" title={error}>{blocked?.map((i, k) => <div key={k}>• {i.message}</div>)}</Notice>
        )}

        <Panel title="Сформированные отчёты" bodyClassName="">
          {detail.reports.length ? (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[560px]">
                <thead><tr><th>Дата</th><th>Версия расчёта</th><th>Формат</th><th>Замечания на момент формирования</th><th className="w-0"></th></tr></thead>
                <tbody>
                  {detail.reports.map((rep) => (
                    <tr key={rep.id}>
                      <td className="num">{new Date(rep.createdAt).toLocaleString("ru-RU")}</td>
                      <td>№ {rep.calculationVersion.versionNumber}</td>
                      <td><Badge tone="neutral">{rep.format.toUpperCase()}</Badge></td>
                      <td className="text-[12.5px] text-muted">ошибок {rep.checks.errors}, предупреждений {rep.checks.warnings}</td>
                      <td><a href={`/api/files/${rep.fileId}`} className="btn btn-ghost btn-sm"><Icon name="download" size={14} />Скачать</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-5 text-[13px] text-muted">Отчёты ещё не формировались. После формирования здесь появятся файлы DOCX и PDF.</p>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Состав отчёта">
          <ol className="space-y-1 text-[13px] text-zinc-700">
            {["Основные факты и выводы", "Задание на оценку", "Сведения о заказчике и оценщике", "Допущения и стандарты", "Описание объекта и здания", "Анализ рынка", "Расчёт сравнительным подходом", "Итоговая величина стоимости", "Источники информации", "Приложения: объявления, фото, документы"].map((x, i) => (
              <li key={x} className="flex gap-2"><span className="num w-5 text-muted">{i + 1}.</span>{x}</li>
            ))}
          </ol>
        </Panel>
        {(detail.calculation?.versions.length ?? 0) > 0 && (
          <Panel title="По зафиксированной версии" description="Те же данные и коэффициенты, что на момент расчёта" bodyClassName="">
            <ul className="divide-y divide-line">
              {detail.calculation!.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 px-4 py-2 text-[13px]">
                  <span>№ {v.versionNumber} <span className="text-muted">· {new Date(v.createdAt).toLocaleDateString("ru-RU")}</span></span>
                  <span className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => generate(["docx"], v.id)}>DOCX</button>
                    <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => generate(["pdf"], v.id)}>PDF</button>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
