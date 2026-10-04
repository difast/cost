// Предложение корректировок по редакции справочника.
// Результат — предложение; оценщик может изменить любое значение (с обоснованием).

import { d, round } from "../calc/decimal";
import { categoryOf, describeCategory, formulaVars, type ObjectFeatures } from "./attributes";
import { evalFormula, explainFormula, FormulaError, parseFormula } from "./formula";

export interface DirectoryCategory {
  code: string;
  label: string;
  coefficient: string;
  minCoefficient?: string | null;
  maxCoefficient?: string | null;
}

export interface DirectoryFactor {
  code: string;
  name: string;
  kind: "discount" | "category" | "power" | "formula" | "manual";
  attribute?: string | null;
  stage: number;
  sortOrder: number;
  value?: string | null;
  minValue?: string | null;
  maxValue?: string | null;
  params: Record<string, unknown>;
  reference?: string | null;
  enabled: boolean;
  categories: DirectoryCategory[];
  groupName?: string | null;
  region?: string | null;
  methodology?: string | null;
  comment?: string | null;
  actualDate?: string | null;
}

export interface DirectoryEdition {
  id: string;
  code: string;
  name: string;
  edition: string;
  actualDate?: string | null;
  isDemo: boolean;
  licenseType: string;
  factors: DirectoryFactor[];
}

export interface SuggestedAdjustment {
  factorCode: string;
  factorName: string;
  stage: number;
  sortOrder: number;
  subjectValue: string;
  comparableValue: string;
  /** Доля, строкой; null — не удалось рассчитать (нет данных) → 0 и требуется внимание. */
  suggestedValue: string | null;
  minValue: string | null;
  maxValue: string | null;
  explanation: string;
  /** Коэффициент K (множитель цены аналога): корректировка = K − 1. null — не определён. */
  coefficient: string | null;
  ruleSnapshot: Record<string, unknown>;
}

const DP = 4; // корректировки — до 0,01 %
const KP = 6; // коэффициенты

/** Значение корректировки из коэффициента: K − 1. */
const fromK = (k: ReturnType<typeof d>) => round(k.minus(1), DP);

export function suggestForComparable(
  edition: DirectoryEdition,
  subject: ObjectFeatures,
  comparable: ObjectFeatures,
): SuggestedAdjustment[] {
  const out: SuggestedAdjustment[] = [];
  for (const f of edition.factors.filter((x) => x.enabled)) {
    const snapshotBase = {
      sourceId: edition.id,
      sourceCode: edition.code,
      sourceName: edition.name,
      edition: edition.edition,
      actualDate: edition.actualDate ?? null,
      isDemo: edition.isDemo,
      factor: {
        code: f.code, name: f.name, kind: f.kind, attribute: f.attribute, reference: f.reference ?? null,
        groupName: f.groupName ?? null, region: f.region ?? null, methodology: f.methodology ?? null, actualDate: f.actualDate ?? null,
      },
    };
    const attr = f.attribute ?? "";
    const sv = describeCategory(attr, subject);
    const cv = describeCategory(attr, comparable);
    const base = { factorCode: f.code, factorName: f.name, stage: f.stage, sortOrder: f.sortOrder };
    const range = { minValue: f.minValue ?? null, maxValue: f.maxValue ?? null };

    if (f.kind === "discount") {
      const v = f.value ? round(f.value, DP) : d(0);
      out.push({
        ...base, ...range,
        subjectValue: "Сделка",
        comparableValue: "Предложение",
        suggestedValue: v.toString(),
        coefficient: round(d(1).plus(v), KP).toString(),
        explanation: `Скидка на торг по справочнику: K = 1 ${v.isNeg() ? "−" : "+"} ${v.abs().toString()} = ${round(d(1).plus(v), KP).toString()}`,
        ruleSnapshot: { ...snapshotBase, value: f.value, min: f.minValue, max: f.maxValue },
      });
      continue;
    }

    if (f.kind === "manual") {
      out.push({
        ...base, ...range,
        subjectValue: sv,
        comparableValue: cv,
        suggestedValue: "0",
        coefficient: "1",
        explanation: "Определяется оценщиком (по умолчанию 0 — объекты сопоставимы)",
        ruleSnapshot: { ...snapshotBase, min: f.minValue, max: f.maxValue },
      });
      continue;
    }

    if (f.kind === "power" || f.kind === "formula") {
      // power — частный случай формулы: K = (So / Sa)^b
      const expression = f.kind === "power" ? `(So / Sa)^(${String(f.params.exponent ?? "0")})` : String(f.params.expression ?? "");
      const vars = formulaVars(subject, comparable);
      let k: ReturnType<typeof d> | null = null;
      let explanation: string;
      try {
        k = evalFormula(parseFormula(expression), vars);
        if (k && k.lte(0)) {
          explanation = `Коэффициент по формуле ${expression} не положителен — проверьте справочник`;
          k = null;
        } else {
          explanation = k
            ? `K = ${explainFormula(expression, vars)} = ${round(k, KP).toString()}; корректировка = K − 1`
            : `Нет данных для формулы ${expression}`;
        }
      } catch (e) {
        explanation = e instanceof FormulaError ? `Ошибка формулы: ${e.message}` : "Ошибка формулы";
        k = null;
      }
      out.push({
        ...base, ...range,
        subjectValue: sv,
        comparableValue: cv,
        suggestedValue: k ? fromK(k).toString() : null,
        coefficient: k ? round(k, KP).toString() : null,
        explanation,
        ruleSnapshot: { ...snapshotBase, expression },
      });
      continue;
    }

    // category: K = k(объект) / k(аналог); корректировка = K − 1.
    // Аналог хуже объекта (k аналога меньше) → K > 1 → корректировка положительная, и наоборот.
    const sc = categoryOf(attr, subject, f.params);
    const cc = categoryOf(attr, comparable, f.params);
    const sk = f.categories.find((c) => c.code === sc);
    const ck = f.categories.find((c) => c.code === cc);
    let value: string | null = null;
    let coefficient: string | null = null;
    let explanation: string;
    let min: string | null = null;
    let max: string | null = null;
    if (!sc || !cc) {
      explanation = `Нет данных: ${!sc ? "объект" : "аналог"}`;
    } else if (!sk || !ck) {
      explanation = `Категория отсутствует в справочнике: ${!sk ? sc : cc}`;
    } else {
      const k = d(sk.coefficient).div(ck.coefficient);
      coefficient = round(k, KP).toString();
      value = fromK(k).toString();
      explanation = `K = ${sk.label} (${sk.coefficient}) / ${ck.label} (${ck.coefficient}) = ${coefficient}; корректировка = K − 1 = ${value}`;
      // диапазон из min/max коэффициентов категорий, если заданы
      if (sk.minCoefficient && sk.maxCoefficient && ck.minCoefficient && ck.maxCoefficient) {
        min = round(d(sk.minCoefficient).div(ck.maxCoefficient).minus(1), DP).toString();
        max = round(d(sk.maxCoefficient).div(ck.minCoefficient).minus(1), DP).toString();
      }
    }
    out.push({
      ...base,
      subjectValue: sk && sk.label !== sv ? `${sv} (${sk.label})` : sv,
      comparableValue: ck && ck.label !== cv ? `${cv} (${ck.label})` : cv,
      suggestedValue: value,
      coefficient,
      minValue: min ?? f.minValue ?? null,
      maxValue: max ?? f.maxValue ?? null,
      explanation,
      ruleSnapshot: {
        ...snapshotBase,
        subjectCategory: sk ? { code: sk.code, label: sk.label, k: sk.coefficient } : sc,
        comparableCategory: ck ? { code: ck.code, label: ck.label, k: ck.coefficient } : cc,
      },
    });
  }
  return out.sort((a, b) => a.stage - b.stage || a.sortOrder - b.sortOrder);
}
