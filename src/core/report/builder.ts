// Сборка документа отчёта из шаблона и снимка оценки.
// Все цифры берутся из одного снимка и одного результата расчёта —
// расхождения между разделами отчёта исключены конструктивно.

import { d } from "../calc/decimal";
import type { CalcResult } from "../calc/types";
import type { CheckReport } from "../checks";
import { FINISHING, HOUSE_CONDITION, WALL_MATERIALS } from "../adjustments/attributes";
import { amountInWords, fmtDate, fmtNumber, fmtPercent, fmtRub } from "../format";
import type { AssessmentSnapshot } from "../snapshot";
import { fmtDistance, type InfrastructureSnapshot } from "../infrastructure";
import type { ReportBlock, ReportDoc, TemplateDefinition } from "./model";
import { WEIGHT_METHODS } from "../calc/weights";
import { calcQuality, DISPERSION_MESSAGE } from "../calc/quality";

export interface ReportFile {
  data: string; // base64
  mime: string;
  filename: string;
  caption: string | null;
}

export interface BuildContext {
  snapshot: AssessmentSnapshot;
  result: CalcResult;
  checks: CheckReport;
  versionNumber: number;
  /** Файлы по id (фото, скриншоты, подпись). */
  files: Record<string, ReportFile>;
  generatedAt: string;
  /** Нормативные документы (справочные данные сервиса на момент формирования). */
  normative?: Array<{ code: string | null; title: string; issuer: string | null; adoptedAt: string | null; url: string | null }>;
}

const dash = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const yesNo = (v: boolean | null | undefined) => (v === true ? "Да" : v === false ? "Нет" : "—");
const wall = (v: string | null) => (v ? WALL_MATERIALS[v] ?? v : "—");
const fin = (v: string | null) => (v ? FINISHING[v] ?? v : "—");
const cond = (v: string | null) => (v ? HOUSE_CONDITION[v] ?? v : "—");
const area = (v: string | null) => (v ? `${fmtNumber(v, 2, true)} м²` : "—");

// ───────────── подстановки {{path|filter}}

function resolvePath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

const FILTERS: Record<string, (v: unknown) => string> = {
  date: (v) => fmtDate(v as string),
  rub: (v) => fmtRub(v as string, 0),
  rub2: (v) => fmtRub(v as string, 2),
  num: (v) => fmtNumber(v as string, 2, true),
  int: (v) => fmtNumber(v as string, 0),
  percent: (v) => fmtPercent(v as string),
  words: (v) => amountInWords(v as string),
  area: (v) => area(v as string),
  wall: (v) => wall(v as string),
};

export function interpolate(text: string, ctx: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w.]+)(?:\|(\w+))?\s*\}\}/g, (_, path: string, filter?: string) => {
    const v = resolvePath(ctx, path);
    if (v === null || v === undefined || v === "") return "—";
    return filter && FILTERS[filter] ? FILTERS[filter](v) : String(v);
  });
}

// ───────────── встроенные блоки

type Builtin = (c: BuildContext, opts: Record<string, unknown>) => ReportBlock[];

const comparablesInCalc = (c: BuildContext) => {
  const ids = c.result.comparables.map((x) => x.id);
  return ids.map((id) => c.snapshot.comparables.find((x) => x.id === id)!).filter(Boolean);
};

const BUILTINS: Record<string, Builtin> = {
  summaryTable: (c) => {
    const s = c.snapshot;
    return [
      {
        type: "kv",
        rows: [
          ["Объект оценки", `${s.property.objectType}, ${dash(s.property.address)}`],
          ["Кадастровый номер", dash(s.property.cadastralNumber)],
          ["Общая площадь", area(s.property.area)],
          ["Оцениваемые права", dash(s.assessment.rightsAssessed)],
          ["Вид стоимости", dash(s.assessment.valueType)],
          ["Дата оценки", fmtDate(s.assessment.valuationDate)],
          ["Дата составления отчёта", fmtDate(s.assessment.reportDate)],
          ["Порядковый номер отчёта", s.assessment.number],
          ["Применённый подход", "Сравнительный подход (метод сравнения продаж)"],
          ["Итоговая величина стоимости", `${fmtRub(c.result.finalValue)} (${amountInWords(c.result.finalValue)})`],
          ["Стоимость 1 м²", fmtRub(c.result.finalUnitPrice, 2)],
        ],
      },
    ];
  },

  assignmentTable: (c) => {
    const a = c.snapshot.assessment;
    return [
      {
        type: "kv",
        rows: [
          ["Объект оценки", `${c.snapshot.property.objectType}, ${dash(c.snapshot.property.address)}, кадастровый номер ${dash(c.snapshot.property.cadastralNumber)}`],
          ["Имущественные права", dash(a.rightsAssessed)],
          ["Цель оценки", dash(a.purpose)],
          ["Предполагаемое использование результатов", dash(a.intendedUse)],
          ["Вид стоимости", dash(a.valueType)],
          ["Дата оценки", fmtDate(a.valuationDate)],
          ["Дата осмотра", fmtDate(a.inspectionDate)],
          ["Основание для проведения оценки", `${dash(a.basis)} № ${dash(a.contractNumber)} от ${fmtDate(a.contractDate)}`],
          ["Заказчик", dash(a.customerName)],
          ["Реквизиты заказчика", dash(a.customerDetails)],
        ],
      },
    ];
  },

  appraiserTable: (c) => {
    const ap = c.snapshot.appraiser;
    if (!ap) return [{ type: "paragraph", text: "Сведения об оценщике не заполнены." }];
    const rows: Array<[string, string]> = [
      ["ФИО оценщика", ap.fullName],
      ["Должность", dash(ap.position)],
      ["Контакты", [ap.phone, ap.email, ap.postalAddress].filter(Boolean).join(", ") || "—"],
      ["Членство в СРО", `${dash(ap.sroName)}, рег. № ${dash(ap.sroRegistryNumber)} от ${fmtDate(ap.sroMembershipDate)}`],
      ["Квалификационный аттестат", `№ ${dash(ap.qualificationCertNumber)} от ${fmtDate(ap.qualificationCertDate)}, действует до ${fmtDate(ap.qualificationCertValidUntil)}, направление: ${dash(ap.qualificationArea)}`],
      ["Страхование ответственности", `${dash(ap.insuranceCompany)}, полис № ${dash(ap.insurancePolicyNumber)}, страховая сумма ${ap.insuranceSum ? fmtRub(ap.insuranceSum) : "—"}, период ${fmtDate(ap.insuranceValidFrom)} — ${fmtDate(ap.insuranceValidUntil)}`],
      ["Образование", dash(ap.education)],
      ["Стаж работы в оценочной деятельности", ap.experienceYears ? `${ap.experienceYears} лет` : "—"],
    ];
    if (ap.legalEntityName) {
      rows.push(["Юридическое лицо, с которым оценщик заключил трудовой договор", `${ap.legalEntityName}, ИНН ${dash(ap.legalEntityInn)}, ОГРН ${dash(ap.legalEntityOgrn)}, ${dash(ap.legalEntityAddress)}`]);
      if (ap.legalEntityInsurancePolicy) {
        rows.push(["Страхование юридического лица", `${dash(ap.legalEntityInsuranceCompany)}, полис № ${ap.legalEntityInsurancePolicy}, сумма ${ap.legalEntityInsuranceSum ? fmtRub(ap.legalEntityInsuranceSum) : "—"}, до ${fmtDate(ap.legalEntityInsuranceValidUntil)}`]);
      }
    }
    return [{ type: "kv", rows }];
  },

  propertyTable: (c) => {
    const p = c.snapshot.property;
    return [
      {
        type: "kv",
        rows: [
          ["Вид объекта", p.objectType],
          ["Адрес", dash(p.address)],
          ["Кадастровый номер", dash(p.cadastralNumber)],
          ["Назначение", dash(p.purpose)],
          ["Общая площадь", area(p.area)],
          ["Жилая площадь", area(p.livingArea)],
          ["Площадь кухни", area(p.kitchenArea)],
          ["Количество комнат", dash(p.rooms)],
          ["Этаж / этажность", `${dash(p.floor)} / ${dash(c.snapshot.building.floors)}`],
          ["Высота потолков", p.ceilingHeight ? `${fmtNumber(p.ceilingHeight, 2, true)} м` : "—"],
          ["Отделка", fin(p.finishing)],
          ["Состояние", dash(p.condition)],
          ["Мебель", yesNo(p.furniture)],
          ["Балкон / лоджия", dash(p.balcony)],
          ["Санузел", dash(p.bathroom)],
          ["Инженерные коммуникации", dash(p.communications)],
          ["Вид права", dash(p.rights)],
          ["Правообладатель", dash(p.rightHolders)],
          ["Обременения", dash(p.encumbrances)],
        ],
      },
      ...(p.description ? [{ type: "paragraph" as const, text: p.description, align: "justify" as const }] : []),
    ];
  },

  buildingTable: (c) => {
    const b = c.snapshot.building;
    return [
      {
        type: "kv",
        rows: [
          ["Кадастровый номер здания", dash(b.cadastralNumber)],
          ["Год постройки", dash(b.yearBuilt)],
          ["Этажность", dash(b.floors)],
          ["Материал наружных стен", wall(b.wallMaterial)],
          ["Серия", dash(b.series)],
          ["Техническое состояние", cond(b.houseCondition)],
          ["Лифты", dash(b.elevators)],
          ["Парковка", dash(b.parking)],
          ["Год капитального ремонта", dash(b.overhaulYear)],
        ],
      },
      ...(b.description ? [{ type: "paragraph" as const, text: b.description, align: "justify" as const }] : []),
    ];
  },

  locationTable: (c, opts) => {
    const p = c.snapshot.property;
    const withInfra = opts.infrastructure !== false;
    return [
      {
        type: "kv",
        rows: [
          ["Район", dash(p.district)],
          ["Ближайшая станция метро", dash(p.metroName)],
          ["Расстояние до метро", p.metroDistanceM !== null ? `${fmtNumber(p.metroDistanceM, 0)} м` : "—"],
          ...(p.latitude && p.longitude ? [["Координаты (широта, долгота)", `${p.latitude}, ${p.longitude}`] as [string, string]] : []),
        ],
      },
      ...(withInfra ? infrastructureBlocks(p.infrastructure) : []),
    ];
  },

  /** Окружение: инфраструктура из картографического сервиса (если получена). */
  environmentTable: (c) => {
    const blocks = infrastructureBlocks(c.snapshot.property.infrastructure);
    return blocks.length ? blocks : [{ type: "paragraph", italic: true, text: "Сведения об инфраструктуре окружения не получены." }];
  },

  /** Правовые и регистрационные сведения: права, обременения, источники ЕГРН. */
  rightsTable: (c) => {
    const p = c.snapshot.property;
    const egrn = c.snapshot.sources.filter((x) => x.kind.startsWith("egrn"));
    return [
      { type: "kv", rows: [
        ["Кадастровый номер", dash(p.cadastralNumber)],
        ["Вид права", dash(p.rights)],
        ["Правообладатель", dash(p.rightHolders)],
        ["Обременения (ограничения)", dash(p.encumbrances)],
        ["Кадастровый номер здания", dash(c.snapshot.building.cadastralNumber)],
      ] },
      ...(egrn.length
        ? [{ type: "table" as const, small: true, header: ["Документ", "Дата получения"], rows: egrn.map((x) => [x.title, fmtDate(x.retrievedAt)]), widths: [4, 1.5] }]
        : [{ type: "paragraph" as const, italic: true, text: "Выписка ЕГРН к оценке не приложена." }]),
    ];
  },

  /** Корректировки по каждому аналогу: фактор, объект, аналог, коэффициент, корректировка, основание. */
  adjustmentsDetail: (c) => {
    const blocks: ReportBlock[] = [];
    for (const cp of comparablesInCalc(c)) {
      blocks.push({ type: "paragraph", bold: true, text: `${cp.label}: ${dash(cp.address)}` });
      const rows = cp.adjustments.map((a) => {
        const rs = a.ruleSnapshot as { sourceName?: string; edition?: string; isDemo?: boolean; factor?: { reference?: string | null } } | null;
        const basis = a.notRequired
          ? `Не требуется: ${a.comment ?? "—"}`
          : a.overridden
            ? `Оценщик: ${a.comment ?? "—"} (автоматически ${a.suggestedValue !== null ? fmtPercent(a.suggestedValue, 2, true) : "не определено"})`
            : rs?.sourceName
              ? `${rs.sourceName}, ред. ${rs.edition}${rs.factor?.reference ? `, ${rs.factor.reference}` : ""}${rs.isDemo ? " (демонстрационные значения)" : ""}`
              : "Экспертное суждение оценщика";
        return [a.factorName, dash(a.subjectValue), dash(a.comparableValue), fmtNumber(d(1).plus(a.value), 4), fmtPercent(a.value, 2, true), basis];
      });
      blocks.push({ type: "table", small: true, header: ["Фактор", "Объект оценки", "Аналог", "Коэффициент", "Корректировка", "Основание"], rows, widths: [2.2, 2, 2, 1.3, 1.4, 3.6] });
    }
    return blocks;
  },

  /** Расчёт по аналогам: цена за м² → итоговая корректировка → скорректированная цена → вес → вклад. */
  calculationTable: (c) => {
    const r = c.result;
    return [{
      type: "table", small: true, boldLastRow: true,
      header: ["Аналог", "Цена за м², ₽", "Корректировка", "Скорректированная цена, ₽/м²", "Вес", "Вклад, ₽/м²"],
      rows: [
        ...r.comparables.map((x) => [x.label, fmtNumber(x.unitPrice), fmtPercent(x.totalChange, 2, true), fmtNumber(x.adjustedUnitPrice), fmtNumber(x.weight, r.settings.weightDecimals), fmtNumber(x.contribution)]),
        ["Итого", "", "", "", fmtNumber(r.weightsSum, r.settings.weightDecimals), fmtNumber(r.weightedUnitPrice)],
      ],
      widths: [1.6, 1.6, 1.4, 2.2, 1, 1.6],
    }];
  },

  /** Контроль расчёта и результаты автоматических проверок. */
  qualityTable: (c) => {
    const q = calcQuality(c.result);
    const rows: Array<[string, string]> = [
      ["Количество аналогов", String(q.count)],
      ["Диапазон исходных цен, ₽/м²", `${fmtNumber(q.rawMin)} – ${fmtNumber(q.rawMax)}`],
      ["Диапазон скорректированных цен, ₽/м²", `${fmtNumber(q.adjustedMin)} – ${fmtNumber(q.adjustedMax)}`],
      ["Средняя скорректированная цена, ₽/м²", fmtNumber(q.adjustedMean)],
      ["Средневзвешенная цена, ₽/м²", fmtNumber(q.weighted)],
      ["Наибольшая корректировка", q.maxAdjustment ? `${fmtPercent(q.maxAdjustment.value, 2, true)} (${q.maxAdjustment.label}, ${q.maxAdjustment.factor})` : "—"],
      ["Наименьшая корректировка", q.minAdjustment ? `${fmtPercent(q.minAdjustment.value, 2, true)} (${q.minAdjustment.label}, ${q.minAdjustment.factor})` : "—"],
      ["Наибольшая валовая корректировка аналога", fmtPercent(q.maxGross)],
      ["Коэффициент вариации до корректировок", fmtPercent(q.cvBefore)],
      ["Коэффициент вариации после корректировок", fmtPercent(q.cvAfter)],
      ["Автоматические проверки", `ошибок ${c.checks.errors}, предупреждений ${c.checks.warnings}`],
    ];
    const out: ReportBlock[] = [{ type: "kv", rows }];
    if (q.dispersionGrew) out.push({ type: "paragraph", italic: true, text: DISPERSION_MESSAGE });
    return out;
  },

  /** Нормативные документы, на которые опирается оценка (с реквизитами и источником). */
  normativeTable: (c) => {
    const n = c.normative ?? [];
    if (!n.length) return [{ type: "paragraph", italic: true, text: "Перечень нормативных документов не загружен." }];
    return [{ type: "table", small: true, header: ["Документ", "Реквизиты", "Источник"], rows: n.map((x) => [x.title, [x.issuer, x.adoptedAt ? `от ${fmtDate(x.adoptedAt)}` : null].filter(Boolean).join(", ") || "—", x.url ?? "—"]), widths: [5, 3, 3] }];
  },

  marketAnalysis: (c) => {
    const text = c.snapshot.assessment.marketAnalysis;
    const blocks: ReportBlock[] = [];
    if (text) {
      for (const para of text.split(/\n{2,}|\r\n\r\n/)) blocks.push({ type: "paragraph", text: para.trim(), align: "justify" });
    } else {
      blocks.push({ type: "paragraph", text: "Анализ рынка не заполнен оценщиком.", italic: true });
    }
    const st = c.result.stats;
    blocks.push({ type: "paragraph", text: "Статистика скорректированных цен предложения аналогов, ₽/м²:", bold: true });
    blocks.push({
      type: "table",
      header: ["Показатель", "Значение"],
      rows: [
        ["Количество аналогов", String(st.count)],
        ["Минимум", fmtNumber(st.min)],
        ["Максимум", fmtNumber(st.max)],
        ["Среднее", fmtNumber(st.mean)],
        ["Медиана", fmtNumber(st.median)],
        ["Диапазон", fmtNumber(st.range)],
        ["Стандартное отклонение", fmtNumber(st.stdev)],
        ["Коэффициент вариации", fmtPercent(st.cv)],
      ],
      widths: [3, 2],
    });
    return blocks;
  },

  comparablesTable: (c) => {
    const comps = comparablesInCalc(c);
    const s = c.snapshot;
    const res = c.result;
    const row = (label: string, subj: string, f: (x: (typeof comps)[number], i: number) => string) => [label, subj, ...comps.map(f)];
    return [
      {
        type: "table",
        small: true,
        header: ["Характеристика", "Объект оценки", ...comps.map((x) => x.label)],
        rows: [
          row("Источник информации", "—", (x) => [x.sourceName, x.sourceUrl].filter(Boolean).join(", ") || "—"),
          ...(comps.some((x) => x.provider) ? [row("Получение данных", "—", (x) => (x.provider === "metrapi" ? `Metrapi (агрегатор объявлений), снимок данных на ${fmtDate(x.retrievedAt)}` : "Ввод оценщиком"))] : []),
          row("Дата предложения", fmtDate(s.assessment.valuationDate), (x) => fmtDate(x.offerDate ?? x.retrievedAt)),
          row("Дата получения данных", "—", (x) => fmtDate(x.retrievedAt)),
          row("Адрес", dash(s.property.address), (x) => dash(x.address)),
          ...(comps.some((x) => x.distanceM !== undefined) ? [row("Расстояние до объекта оценки, м", "—", (x) => (x.distanceM !== undefined ? fmtNumber(x.distanceM, 0) : "—"))] : []),
          row("Цена предложения, ₽", "—", (x) => fmtNumber(x.price, 0)),
          row("Общая площадь, м²", fmtNumber(s.property.area ?? "0", 2, true), (x) => fmtNumber(x.area, 2, true)),
          row("Цена за 1 м², ₽", "—", (_x, i) => fmtNumber(res.comparables[i].unitPrice)),
          row("Количество комнат", dash(s.property.rooms), (x) => dash(x.rooms)),
          row("Этаж / этажность", `${dash(s.property.floor)} / ${dash(s.building.floors)}`, (x) => `${dash(x.floor)} / ${dash(x.floors)}`),
          row("Материал стен", wall(s.building.wallMaterial), (x) => wall(x.wallMaterial)),
          ...(comps.some((x) => x.houseType) ? [row("Тип дома (по данным источника)", "—", (x) => dash(x.houseType))] : []),
          row("Год постройки", dash(s.building.yearBuilt), (x) => dash(x.yearBuilt)),
          row("Отделка", fin(s.property.finishing), (x) => fin(x.finishing)),
          row("Мебель", yesNo(s.property.furniture), (x) => yesNo(x.furniture)),
          row("Состояние дома", cond(s.building.houseCondition), (x) => cond(x.houseCondition)),
          row("До метро, м", dash(s.property.metroDistanceM), (x) => dash(x.metroDistanceM)),
          row("Права", dash(s.property.rights), (x) => dash(x.rights)),
        ],
      },
    ];
  },

  adjustmentsTable: (c) => {
    const comps = comparablesInCalc(c);
    const res = c.result;
    const codes: Array<{ code: string; name: string }> = [];
    for (const rc of res.comparables) for (const st of rc.steps) if (!codes.some((x) => x.code === st.code)) codes.push({ code: st.code, name: st.name });
    const rows: string[][] = [["Цена предложения за 1 м², ₽", ...res.comparables.map((x) => fmtNumber(x.unitPrice))]];
    for (const { code, name } of codes) {
      rows.push([
        `${name}: объект / аналог`,
        ...comps.map((cp) => {
          const a = cp.adjustments.find((x) => x.factorCode === code);
          return a ? `${dash(a.subjectValue)} / ${dash(a.comparableValue)}` : "—";
        }),
      ]);
      rows.push([`${name}, коэффициент K`, ...res.comparables.map((rc) => {
        const st = rc.steps.find((x) => x.code === code);
        return st ? fmtNumber(d(1).plus(st.value), 4) : "—";
      })]);
      rows.push([`${name}, корректировка`, ...res.comparables.map((rc) => {
        const st = rc.steps.find((x) => x.code === code);
        return st ? fmtPercent(st.value, 2, true) : "—";
      })]);
      const allZero = res.comparables.every((rc) => d(rc.steps.find((x) => x.code === code)?.value ?? "0").isZero());
      if (allZero) continue;
      rows.push([`Цена после корректировки, ₽/м²`, ...res.comparables.map((rc) => {
        const st = rc.steps.find((x) => x.code === code);
        return st ? fmtNumber(st.after) : "—";
      })]);
    }
    rows.push(["Скорректированная цена за 1 м², ₽", ...res.comparables.map((x) => fmtNumber(x.adjustedUnitPrice))]);
    rows.push(["Валовая корректировка Σ|корр|", ...res.comparables.map((x) => fmtPercent(x.grossAdjustment))]);
    rows.push(["Количество корректировок", ...res.comparables.map((x) => String(x.adjustmentCount))]);
    rows.push(["Весовой коэффициент", ...res.comparables.map((x) => fmtNumber(x.weight, c.result.settings.weightDecimals))]);
    rows.push(["Вклад в стоимость 1 м², ₽", ...res.comparables.map((x) => fmtNumber(x.contribution))]);
    return [
      {
        type: "paragraph",
        text:
          res.settings.adjustmentMode === "sequential"
            ? "Корректировки применяются последовательно: каждая следующая корректировка применяется к цене, полученной на предыдущем шаге. Промежуточные значения округляются до копеек."
            : "Корректировки первой группы (торг, права, условия рынка) применяются последовательно; корректировки второй группы рассчитываются от цены после первой группы и суммируются. Промежуточные значения округляются до копеек.",
        align: "justify",
      },
      { type: "table", small: true, header: ["Показатель", ...comps.map((x) => x.label)], rows, boldLastRow: false },
    ];
  },

  adjustmentRationale: (c) => {
    const comps = comparablesInCalc(c);
    const factors = new Map<string, { name: string; refs: Set<string>; comments: string[] }>();
    for (const cp of comps) {
      for (const a of cp.adjustments) {
        const f = factors.get(a.factorCode) ?? { name: a.factorName, refs: new Set<string>(), comments: [] };
        const rs = a.ruleSnapshot as { sourceName?: string; edition?: string; factor?: { reference?: string | null } } | null;
        if (rs?.sourceName) f.refs.add(`${rs.sourceName}, ред. ${rs.edition}${rs.factor?.reference ? `, ${rs.factor.reference}` : ""}`);
        const when = a.overriddenAt ? ` (${fmtDate(a.overriddenAt)})` : "";
        if (a.notRequired) f.comments.push(`${cp.label}: не требуется${when} — ${a.comment ?? "обоснование не указано"}`);
        else if (a.overridden && a.comment) f.comments.push(`${cp.label}: ${fmtPercent(a.value, 2, true)} (рассчитано автоматически ${a.suggestedValue !== null ? fmtPercent(a.suggestedValue, 2, true) : "—"})${when} — ${a.comment}`);
        factors.set(a.factorCode, f);
      }
    }
    const rows = [...factors.values()].map((f) => [f.name, [...f.refs].join("; ") || "Экспертное суждение оценщика", f.comments.join("; ") || "—"]);
    return [{ type: "table", small: true, header: ["Корректировка", "Источник обоснования", "Изменения, внесённые оценщиком"], rows, widths: [2, 3, 4] }];
  },

  calculationChain: (c) => {
    const blocks: ReportBlock[] = [];
    for (const rc of c.result.comparables) {
      blocks.push({ type: "paragraph", text: rc.label, bold: true });
      const nonZero = rc.steps.filter((st) => !d(st.value).isZero());
      const zeroNames = rc.steps.filter((st) => d(st.value).isZero()).map((st) => st.name.toLowerCase());
      const lines = [
        `Цена за 1 м²: ${rc.unitPriceFormula} ₽`,
        ...nonZero.map((st) => `${st.name}: ${st.formula} ₽`),
        ...(zeroNames.length ? [`Корректировки, равные 0 %: ${zeroNames.join(", ")}.`] : []),
        `Скорректированная цена: ${fmtNumber(rc.adjustedUnitPrice)} ₽/м²`,
      ];
      for (const l of lines) blocks.push({ type: "paragraph", text: l, size: "small" });
    }
    return blocks;
  },

  weightsTable: (c) => {
    const r = c.result;
    const m = WEIGHT_METHODS[r.settings.weightMethod];
    return [
      { type: "paragraph", text: `Метод расчёта весов: ${m.label.toLowerCase()}, ${m.formula}. ${m.explanation} Веса округлены до ${r.settings.weightDecimals} знаков методом наибольшего остатка; сумма весов равна ${fmtNumber(r.weightsSum, r.settings.weightDecimals)}.`, align: "justify" },
      {
        type: "table",
        small: true,
        header: ["Аналог", "Скорр. цена, ₽/м²", "Σ|корр|", "Расчёт веса", "Вес", "Вклад, ₽/м²"],
        rows: [
          ...r.comparables.map((x) => [x.label, fmtNumber(x.adjustedUnitPrice), fmtPercent(x.grossAdjustment), x.weightFormula, fmtNumber(x.weight, r.settings.weightDecimals), fmtNumber(x.contribution)]),
          ["Итого", "", "", "", fmtNumber(r.weightsSum, r.settings.weightDecimals), fmtNumber(r.weightedUnitPrice)],
        ],
        widths: [2, 2, 1.3, 4, 1.2, 2],
        boldLastRow: true,
      },
    ];
  },

  resultCalculation: (c) => {
    const r = c.result;
    return [
      {
        type: "table",
        header: ["Показатель", "Расчёт", "Значение"],
        rows: [
          ["Средневзвешенная цена 1 м², ₽", r.weightedUnitPriceFormula, fmtNumber(r.weightedUnitPrice)],
          ["Площадь объекта, м²", "", fmtNumber(r.subjectArea, 2, true)],
          ["Стоимость до округления, ₽", r.rawValueFormula, fmtNumber(r.rawValue)],
          ["Итоговая стоимость, ₽", r.finalValueFormula, fmtNumber(r.finalValue, 0)],
          ["Стоимость 1 м², ₽", `${fmtNumber(r.finalValue, 0)} / ${fmtNumber(r.subjectArea, 2, true)}`, fmtNumber(r.finalUnitPrice)],
        ],
        widths: [3, 5, 2],
        boldLastRow: false,
      },
    ];
  },

  finalValue: (c) => [
    {
      type: "paragraph",
      align: "center",
      bold: true,
      size: "large",
      text: `${fmtRub(c.result.finalValue)}`,
    },
    { type: "paragraph", align: "center", text: `(${amountInWords(c.result.finalValue)})` },
  ],

  sourcesTable: (c) => {
    const s = c.snapshot;
    const rows: string[][] = [];
    for (const src of s.sources) rows.push([src.title, dash(src.url), fmtDate(src.retrievedAt), dash(src.note)]);
    for (const cp of comparablesInCalc(c)) rows.push([`${cp.label}: ${dash(cp.sourceName)}`, dash(cp.sourceUrl), fmtDate(cp.retrievedAt), dash(cp.address)]);
    if (s.directory) rows.push([`Справочник корректировок: ${s.directory.name}`, s.directory.publisher ?? "—", fmtDate(s.directory.actualDate), `редакция ${s.directory.edition}${s.directory.isDemo ? ", демонстрационные значения" : ""}`]);
    const infra = s.property.infrastructure;
    if (infra) rows.push([`Инфраструктура окружения: ${infra.providerTitle}`, "—", fmtDate(infra.retrievedAt), "расстояния по прямой"]);
    return [{ type: "table", small: true, header: ["Источник", "Ссылка / издатель", "Дата", "Примечание"], rows, widths: [3, 4, 1.5, 2.5] }];
  },

  calcMeta: (c) => [
    {
      type: "paragraph",
      size: "small",
      italic: true,
      text: c.versionNumber
        ? `Расчёт выполнен ядром ${c.result.engineVersion}, версия расчёта № ${c.versionNumber}. Все промежуточные значения приведены в отчёте и могут быть проверены вручную.`
        : `Предварительный расчёт (ядро ${c.result.engineVersion}): версия расчёта ещё не подтверждена.`,
    },
  ],

  signature: (c) => {
    const ap = c.snapshot.appraiser;
    const blocks: ReportBlock[] = [
      { type: "paragraph", text: `Оценщик ____________________ ${ap?.fullName ?? ""}` },
      { type: "paragraph", text: `Дата составления отчёта: ${fmtDate(c.snapshot.assessment.reportDate)}` },
    ];
    const sig = ap?.signatureFileId ? c.files[ap.signatureFileId] : undefined;
    if (sig) blocks.splice(0, 0, { type: "image", data: sig.data, mime: sig.mime, maxWidthPx: 160 });
    return blocks;
  },

  appendixScreenshots: (c) => {
    const blocks: ReportBlock[] = [];
    for (const cp of comparablesInCalc(c)) {
      const f = cp.screenshotFileId ? c.files[cp.screenshotFileId] : undefined;
      blocks.push({ type: "paragraph", bold: true, text: `${cp.label}: ${dash(cp.sourceUrl)} (данные получены ${fmtDate(cp.retrievedAt)})` });
      if (f && isImage(f.mime)) blocks.push({ type: "image", data: f.data, mime: f.mime, caption: f.caption ?? undefined });
      else blocks.push({ type: "paragraph", italic: true, text: "Скриншот не приложен." });
    }
    return blocks;
  },

  appendixPhotos: (c) => {
    const photos = c.snapshot.attachments.filter((x) => x.kind === "photo");
    if (!photos.length) return [{ type: "paragraph", italic: true, text: "Фотографии не приложены." }];
    return photos.flatMap((p): ReportBlock[] => {
      const f = c.files[p.fileId];
      return f && isImage(f.mime) ? [{ type: "image", data: f.data, mime: f.mime, caption: p.caption ?? p.filename }] : [];
    });
  },

  appendixDocuments: (c) => {
    const docs = c.snapshot.attachments.filter((x) => x.kind === "document" || x.kind === "egrn");
    const blocks: ReportBlock[] = [];
    if (!docs.length) return [{ type: "paragraph", italic: true, text: "Копии документов не приложены." }];
    for (const p of docs) {
      const f = c.files[p.fileId];
      if (f && isImage(f.mime)) blocks.push({ type: "image", data: f.data, mime: f.mime, caption: p.caption ?? p.filename });
      else blocks.push({ type: "paragraph", text: `${p.caption ?? p.filename} (файл ${p.filename}, контрольная сумма SHA-256 ${p.sha256.slice(0, 16)}…)` });
    }
    return blocks;
  },
};

function isImage(mime: string) {
  return mime === "image/png" || mime === "image/jpeg";
}

export const BUILTIN_NAMES = Object.keys(BUILTINS);

/** Встроенный блок по имени — используется шаблоном и рабочим документом отчёта. */
export function renderBuiltin(name: string, c: BuildContext, opts: Record<string, unknown> = {}): ReportBlock[] {
  const fn = BUILTINS[name];
  if (!fn) throw new Error(`Неизвестный блок отчёта: ${name}`);
  return fn(c, opts);
}
export const reportFooter = (s: AssessmentSnapshot) => `Отчёт № ${s.assessment.number} · дата оценки ${fmtDate(s.assessment.valuationDate)} · ${dash(s.property.cadastralNumber)}`;

export function buildReport(def: TemplateDefinition, c: BuildContext): ReportDoc {
  const s = c.snapshot;
  const ctx = {
    a: s.assessment,
    p: s.property,
    b: s.building,
    ap: s.appraiser,
    r: c.result,
    dir: s.directory,
    version: c.versionNumber,
  };
  const blocks: ReportBlock[] = [];
  for (const sec of def.sections) {
    if (sec.pageBreakBefore && blocks.length) blocks.push({ type: "pageBreak" });
    if (sec.title) blocks.push({ type: "heading", level: 1, text: interpolate(sec.title, ctx) });
    for (const b of sec.blocks) {
      if (b.kind === "text") {
        const text = interpolate(b.text, ctx);
        for (const para of text.split(/\n/)) {
          if (!para.trim()) continue;
          const m = para.match(/^(#{2,3})\s+(.*)$/);
          if (m) blocks.push({ type: "heading", level: m[1].length as 2 | 3, text: m[2] });
          else blocks.push({ type: "paragraph", text: para, bold: b.bold, align: b.align ?? "justify" });
        }
      } else {
        const fn = BUILTINS[b.name];
        if (!fn) throw new Error(`Неизвестный блок шаблона: ${b.name}`);
        blocks.push(...fn(c, b.options ?? {}));
      }
    }
  }
  return {
    title: interpolate(def.title, ctx),
    footer: `Отчёт № ${s.assessment.number} · дата оценки ${fmtDate(s.assessment.valuationDate)} · ${dash(s.property.cadastralNumber)}`,
    blocks,
  };
}

/** Сумма по итогу для контроля в тестах и UI. */
export const valueOf = (c: BuildContext) => d(c.result.finalValue);

/** Таблица ближайшей инфраструктуры для раздела «Местоположение и окружение». */
function infrastructureBlocks(infra: InfrastructureSnapshot | undefined): ReportBlock[] {
  if (!infra) return [];
  const rows: string[][] = [];
  for (const c of infra.categories) {
    if (c.status === "ok") for (const i of c.items) rows.push([c.label, i.name, i.address ?? "—", fmtDistance(i.distanceM)]);
    else rows.push([c.label, c.status === "empty" ? `В радиусе ${fmtDistance(c.radiusM)} не найдено` : "Данные не получены", "—", "—"]);
  }
  return [
    { type: "paragraph", text: "Ближайшая инфраструктура:", bold: true },
    { type: "table", header: ["Категория", "Наименование", "Адрес", "Расстояние"], rows, widths: [22, 30, 36, 12], small: true },
    { type: "paragraph", text: `Источник: ${infra.providerTitle}, данные получены ${fmtDate(infra.retrievedAt)}. Расстояния указаны по прямой от объекта оценки.`, italic: true },
  ];
}
