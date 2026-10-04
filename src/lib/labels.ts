export const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-zinc-100 text-zinc-600" },
  in_progress: { label: "В работе", cls: "bg-brand-soft text-brand" },
  review: { label: "На проверке", cls: "bg-amber-50 text-warn" },
  completed: { label: "Завершена", cls: "bg-green-50 text-ok" },
  archived: { label: "Архив", cls: "bg-zinc-100 text-zinc-500" },
};

export const WALL_OPTIONS: Array<[string, string]> = [
  ["", "—"], ["panel", "Панельный"], ["brick", "Кирпичный"], ["monolith", "Монолитный"], ["monolith_brick", "Монолитно-кирпичный"], ["block", "Блочный"], ["wood", "Деревянный"], ["other", "Иной"],
];
export const FINISHING_OPTIONS: Array<[string, string]> = [
  ["", "—"], ["none", "Без отделки"], ["whitebox", "Предчистовая"], ["needs_repair", "Требует ремонта"], ["standard", "Стандартный ремонт"], ["improved", "Улучшенный ремонт"], ["designer", "Дизайнерский ремонт"],
];
export const CONDITION_OPTIONS: Array<[string, string]> = [["", "—"], ["good", "Хорошее"], ["satisfactory", "Удовлетворительное"], ["poor", "Неудовлетворительное"]];
export const label = (opts: Array<[string, string]>, v: string | null | undefined) => opts.find(([k]) => k === (v ?? ""))?.[1] ?? v ?? "—";
