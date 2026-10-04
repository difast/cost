// Общая раскадровка для горизонтальной и вертикальной версий (кадры, 30 к/с).
// Сцены перекрываются на OVERLAP кадров — плавный перекрёстный переход.

export const OVERLAP = 16;
const LENGTHS = { intro: 96, address: 220, comps: 230, adj: 180, calc: 180, quality: 230, report: 200, outro: 140 } as const;
export type SceneKey = keyof typeof LENGTHS;

export const SCENES: Array<{ key: SceneKey; from: number; dur: number }> = [];
let t = 0;
for (const key of Object.keys(LENGTHS) as SceneKey[]) {
  SCENES.push({ key, from: t, dur: LENGTHS[key] });
  t += LENGTHS[key] - OVERLAP;
}
export const TOTAL = t + OVERLAP;

export const CAPTIONS: Record<Exclude<SceneKey, "intro" | "outro">, { step: string; title: string; text: string }> = {
  address: { step: "01", title: "Адрес и карта", text: "Подсказки ГАР, координаты, карта и инфраструктура вокруг объекта" },
  comps: { step: "02", title: "Аналоги", text: "Поиск по городу и улице, сравнение каждого аналога с объектом" },
  adj: { step: "03", title: "Корректировки", text: "По справочнику: значения объекта и аналога, коэффициент, источник" },
  calc: { step: "04", title: "Расчёт", text: "Веса, скорректированные цены и итог — из одного расчётного ядра" },
  quality: { step: "05", title: "Контроль качества", text: "Ошибки и предупреждения с переходом к нужному полю" },
  report: { step: "06", title: "Отчёт", text: "Редактор документа и выгрузка в DOCX, PDF и XLSX" },
};
