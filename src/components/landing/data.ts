// Данные для блоков «Пример расчёта» и «Контроль ошибок».
// Числа не нарисованы вручную: они получаются тем же расчётным ядром и теми же
// проверками, что работают в сервисе (на демонстрационных данных).

import { calculate } from "@/core/calc/engine";
import { DEFAULT_SETTINGS, type CalcInput } from "@/core/calc/types";
import { runChecks } from "@/core/checks";
import { sampleSnapshot } from "@/core/__fixtures__/sample";

const adj = (code: string, name: string, value: string, stage = 2, order = 10) => ({ code, name, value, stage, order });

export const EXAMPLE_SUBJECT = {
  title: "Двухкомнатная квартира",
  area: "42.9",
  facts: [
    ["Общая площадь", "42,9 м²"],
    ["Этаж", "5 из 12"],
    ["Дом", "панельный, 1979 г."],
    ["Отделка", "стандартный ремонт"],
    ["Мебель", "без мебели"],
    ["До метро", "650 м"],
  ] as Array<[string, string]>,
};

export const EXAMPLE_INPUT: CalcInput = {
  subjectArea: EXAMPLE_SUBJECT.area,
  settings: { ...DEFAULT_SETTINGS, weightMethod: "inverse_gross", roundingStep: "1000" },
  comparables: [
    {
      id: "a1", label: "Аналог 1", price: "9850000", area: "44.1",
      adjustments: [adj("bargain", "Торг", "-0.05", 1, 1), adj("area", "Площадь", "0.0028"), adj("furniture", "Мебель", "-0.04", 2, 20)],
    },
    {
      id: "a2", label: "Аналог 2", price: "10400000", area: "46.5",
      adjustments: [adj("bargain", "Торг", "-0.05", 1, 1), adj("location", "Местоположение", "-0.02", 2, 5), adj("area", "Площадь", "0.0081"), adj("wall", "Материал стен", "-0.0476", 2, 15)],
    },
    {
      id: "a3", label: "Аналог 3", price: "9300000", area: "41.2",
      adjustments: [adj("bargain", "Торг", "-0.05", 1, 1), adj("area", "Площадь", "-0.004"), adj("furniture", "Мебель", "-0.04", 2, 20)],
    },
  ],
};

export const exampleResult = () => calculate(EXAMPLE_INPUT);

/** Реальные сообщения проверок на демонстрационной оценке с внесёнными ошибками. */
export function exampleIssues() {
  const s = sampleSnapshot();
  s.sources[0].extracted = { ...s.sources[0].extracted, cadastralNumber: "77:01:0001001:1243", area: "43.9" };
  s.comparables[1].adjustments[1] = { ...s.comparables[1].adjustments[1], value: "-0.08", overridden: true, comment: null };
  s.comparables[2].sourceUrl = null;
  s.appraiser!.insuranceValidUntil = "2026-09-01T00:00:00.000Z";
  const wanted = ["CADASTRAL_MISMATCH", "AREA_MISMATCH", "ADJ_NO_COMMENT", "COMPARABLE_NO_SOURCE", "DOC_EXPIRED"];
  const r = runChecks(s);
  return wanted.flatMap((code) => r.issues.filter((i) => i.code === code).slice(0, 1));
}
