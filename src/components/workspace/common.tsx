"use client";

import { Icon } from "@/components/ui/Icon";
import type { ChecklistItem } from "@/core/checks/catalog";
import type { TabKey } from "./Workspace";

const NAMES: Record<string, string> = {
  assignment: "Задание", property: "Объект", comparables: "Аналоги", adjustments: "Корректировки",
  calculation: "Расчёт", checks: "Проверки", report: "Отчёт",
};

/** Переход к следующему этапу внизу вкладки. */
export function NextStep({ to, go, note }: { to: TabKey; go: (t: TabKey) => void; note?: string }) {
  return (
    <div className="mt-5 flex items-center justify-end gap-3">
      {note && <span className="text-[12.5px] text-muted">{note}</span>}
      <button className="btn btn-secondary" onClick={() => go(to)}>
        Далее: {NAMES[to]} <Icon name="arrowRight" size={14} />
      </button>
    </div>
  );
}

/** Компактный список замечаний этапа — показывается вверху вкладки. */
export function StepIssues({ items, go }: { items: ChecklistItem[]; go: (t: TabKey) => void }) {
  const bad = items.filter((i) => i.status === "error" || i.status === "warning");
  if (!bad.length) return null;
  const errors = bad.filter((i) => i.status === "error").length;
  return (
    <div className={`mb-4 rounded-md border px-3.5 py-2.5 text-[13px] ${errors ? "border-err/25 bg-err-soft" : "border-warn/25 bg-warn-soft"}`}>
      <div className={`flex items-center gap-2 font-medium ${errors ? "text-err" : "text-[#8a5a12]"}`}>
        <Icon name={errors ? "error" : "alert"} size={15} />
        {errors ? "На этом этапе есть ошибки, блокирующие отчёт" : "На этом этапе есть замечания"}
        <button className="ml-auto text-[12.5px] font-normal underline-offset-2 hover:underline" onClick={() => go("checks")}>Все проверки</button>
      </div>
      <ul className="mt-1.5 space-y-0.5 pl-[23px] text-zinc-700">
        {bad.flatMap((i) => i.issues).slice(0, 6).map((is, k) => <li key={k} className="list-disc">{is.message}</li>)}
      </ul>
    </div>
  );
}
