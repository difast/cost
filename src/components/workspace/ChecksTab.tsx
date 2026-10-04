"use client";

import type { WsProps, TabKey } from "./Workspace";

const SECTIONS: Record<string, [string, TabKey]> = {
  assignment: ["Задание", "assignment"],
  property: ["Объект", "property"],
  appraiser: ["Оценщик", "assignment"],
  comparables: ["Аналоги", "comparables"],
  adjustments: ["Корректировки", "adjustments"],
  calculation: ["Расчёт", "calculation"],
  text: ["Тексты отчёта", "assignment"],
};

export function ChecksTab({ calc, go }: WsProps) {
  if (!calc) return <div className="text-muted">Загрузка…</div>;
  const order = { error: 0, warning: 1, info: 2 } as const;
  const issues = [...calc.issues].sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4"><div className="text-xs text-muted">Ошибки (блокируют отчёт)</div><div className={`text-2xl font-semibold ${calc.errors ? "text-err" : "text-ok"}`}>{calc.errors}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Предупреждения</div><div className={`text-2xl font-semibold ${calc.warnings ? "text-warn" : "text-ok"}`}>{calc.warnings}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Готовность к отчёту</div><div className={`text-2xl font-semibold ${calc.canGenerate ? "text-ok" : "text-err"}`}>{calc.canGenerate ? "Готово" : "Нет"}</div></div>
      </div>
      <div className="card">
        <div className="card-h"><div className="card-t">Результаты автоматического контроля</div><span className="text-xs text-muted">кадастровый номер, адрес, площадь, даты, формулы, веса, источники, остатки чужого текста</span></div>
        {issues.length === 0 ? (
          <div className="p-8 text-center text-ok">Замечаний нет. Данные согласованы.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {issues.map((i, k) => (
              <li key={k} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`badge mt-0.5 shrink-0 ${i.severity === "error" ? "bg-red-50 text-err" : "bg-amber-50 text-warn"}`}>{i.severity === "error" ? "Ошибка" : "Внимание"}</span>
                <div className="flex-1">{i.message}</div>
                <button className="btn btn-ghost shrink-0 px-2 text-xs" onClick={() => go(i.section === "appraiser" ? "assignment" : SECTIONS[i.section]?.[1] ?? "assignment")}>
                  {i.section === "appraiser" ? "Профиль" : SECTIONS[i.section]?.[0]} →
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {issues.some((i) => i.section === "appraiser") && (
        <div className="text-xs text-muted">Данные оценщика редактируются в разделе <a className="text-brand underline" href="/app/profile">«Профиль оценщика»</a>.</div>
      )}
    </div>
  );
}
