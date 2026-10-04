// Предложение корректировок по редакции справочника.
// Результат — предложение; оценщик может изменить любое значение (с обоснованием).

import { d, round } from "../calc/decimal";
import { categoryOf, describeCategory, type ObjectFeatures } from "./attributes";

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
  kind: "discount" | "category" | "power" | "manual";
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
  ruleSnapshot: Record<string, unknown>;
}

const DP = 4; // корректировки — до 0,01 %

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
      factor: { code: f.code, name: f.name, kind: f.kind, attribute: f.attribute, reference: f.reference ?? null },
    };
    const attr = f.attribute ?? "";
    const sv = describeCategory(attr, subject);
    const cv = describeCategory(attr, comparable);

    if (f.kind === "discount") {
      out.push({
        factorCode: f.code,
        factorName: f.name,
        stage: f.stage,
        sortOrder: f.sortOrder,
        subjectValue: "Сделка",
        comparableValue: "Предложение",
        suggestedValue: f.value ? round(f.value, DP).toString() : "0",
        minValue: f.minValue ?? null,
        maxValue: f.maxValue ?? null,
        explanation: `Скидка на торг по справочнику: ${f.value}`,
        ruleSnapshot: { ...snapshotBase, value: f.value, min: f.minValue, max: f.maxValue },
      });
      continue;
    }

    if (f.kind === "manual") {
      out.push({
        factorCode: f.code,
        factorName: f.name,
        stage: f.stage,
        sortOrder: f.sortOrder,
        subjectValue: sv,
        comparableValue: cv,
        suggestedValue: "0",
        minValue: f.minValue ?? null,
        maxValue: f.maxValue ?? null,
        explanation: "Определяется оценщиком (по умолчанию 0 — объекты сопоставимы)",
        ruleSnapshot: { ...snapshotBase, min: f.minValue, max: f.maxValue },
      });
      continue;
    }

    if (f.kind === "power") {
      const exponent = String(f.params.exponent ?? "0");
      if (!subject.area || !comparable.area || d(subject.area).lte(0) || d(comparable.area).lte(0)) {
        out.push({
          factorCode: f.code, factorName: f.name, stage: f.stage, sortOrder: f.sortOrder,
          subjectValue: sv, comparableValue: cv, suggestedValue: null,
          minValue: f.minValue ?? null, maxValue: f.maxValue ?? null,
          explanation: "Нет данных о площади", ruleSnapshot: { ...snapshotBase, exponent },
        });
        continue;
      }
      // k = (S_объекта / S_аналога)^b − 1
      const ratio = d(subject.area).div(comparable.area);
      const value = round(ratio.pow(exponent).minus(1), DP);
      out.push({
        factorCode: f.code, factorName: f.name, stage: f.stage, sortOrder: f.sortOrder,
        subjectValue: sv, comparableValue: cv, suggestedValue: value.toString(),
        minValue: f.minValue ?? null, maxValue: f.maxValue ?? null,
        explanation: `(${subject.area} / ${comparable.area})^${exponent} − 1 = ${value.toString()}`,
        ruleSnapshot: { ...snapshotBase, exponent },
      });
      continue;
    }

    // category: корректировка = k(объект) / k(аналог) − 1
    const sc = categoryOf(attr, subject, f.params);
    const cc = categoryOf(attr, comparable, f.params);
    const sk = f.categories.find((c) => c.code === sc);
    const ck = f.categories.find((c) => c.code === cc);
    let value: string | null = null;
    let explanation: string;
    let min: string | null = null;
    let max: string | null = null;
    if (!sc || !cc) {
      explanation = `Нет данных: ${!sc ? "объект" : "аналог"}`;
    } else if (!sk || !ck) {
      explanation = `Категория отсутствует в справочнике: ${!sk ? sc : cc}`;
    } else {
      const v = round(d(sk.coefficient).div(ck.coefficient).minus(1), DP);
      value = v.toString();
      explanation = `${sk.label} (${sk.coefficient}) / ${ck.label} (${ck.coefficient}) − 1 = ${value}`;
      // диапазон из min/max коэффициентов категорий, если заданы
      if (sk.minCoefficient && sk.maxCoefficient && ck.minCoefficient && ck.maxCoefficient) {
        min = round(d(sk.minCoefficient).div(ck.maxCoefficient).minus(1), DP).toString();
        max = round(d(sk.maxCoefficient).div(ck.minCoefficient).minus(1), DP).toString();
      }
    }
    out.push({
      factorCode: f.code,
      factorName: f.name,
      stage: f.stage,
      sortOrder: f.sortOrder,
      subjectValue: sk && sk.label !== sv ? `${sv} (${sk.label})` : sv,
      comparableValue: ck && ck.label !== cv ? `${cv} (${ck.label})` : cv,
      suggestedValue: value,
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
