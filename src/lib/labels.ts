export const WALL_OPTIONS: Array<[string, string]> = [
  ["", "—"], ["panel", "Панельный"], ["brick", "Кирпичный"], ["monolith", "Монолитный"], ["monolith_brick", "Монолитно-кирпичный"], ["block", "Блочный"], ["wood", "Деревянный"], ["other", "Иной"],
];
export const FINISHING_OPTIONS: Array<[string, string]> = [
  ["", "—"], ["none", "Без отделки"], ["whitebox", "Предчистовая"], ["needs_repair", "Требует ремонта"], ["standard", "Стандартный ремонт"], ["improved", "Улучшенный ремонт"], ["designer", "Дизайнерский ремонт"],
];
export const CONDITION_OPTIONS: Array<[string, string]> = [["", "—"], ["good", "Хорошее"], ["satisfactory", "Удовлетворительное"], ["poor", "Неудовлетворительное"]];
export const label = (opts: Array<[string, string]>, v: string | null | undefined) => opts.find(([k]) => k === (v ?? ""))?.[1] ?? v ?? "—";
