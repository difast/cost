// Экспорт зафиксированного расчёта в XLSX. Не пересчитывает: все числа — из снимка и результата
// расчётного ядра (CalculationVersion), те же, что в интерфейсе, DOCX и PDF.

import ExcelJS from "exceljs";
import { d } from "../calc/decimal";
import { WEIGHT_METHODS } from "../calc/weights";
import { FINISHING, HOUSE_CONDITION, WALL_MATERIALS } from "../adjustments/attributes";
import type { CalcResult } from "../calc/types";
import type { AssessmentSnapshot } from "../snapshot";

const num = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));
const date = (v: string | null | undefined) => (v ? new Date(v) : null);
const lbl = (dict: Record<string, string>, v: string | null) => (v ? dict[v] ?? v : null);
const RUB = '#,##0.00 "₽"';
const RUB0 = '#,##0 "₽"';
const PCT = "0.00%";

function header(ws: ExcelJS.Worksheet, cols: Array<{ header: string; key: string; width: number; fmt?: string }>) {
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.fmt ? { numFmt: c.fmt } : {} }));
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEFF2" } };
  row.alignment = { vertical: "middle", wrapText: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function renderXlsx(s: AssessmentSnapshot, r: CalcResult, meta: { versionNumber: number; createdAt: string; createdBy: string | null }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Оценка.Про";
  wb.created = new Date(meta.createdAt);
  const inCalc = r.comparables.map((rc) => s.comparables.find((c) => c.id === rc.id)!).filter(Boolean);

  // ── Объект
  const o = wb.addWorksheet("Объект");
  header(o, [{ header: "Показатель", key: "k", width: 38 }, { header: "Значение", key: "v", width: 60 }]);
  const p = s.property, b = s.building, a = s.assessment;
  const rows: Array<[string, unknown, string?]> = [
    ["Номер отчёта", a.number], ["Версия расчёта", meta.versionNumber], ["Дата расчёта", date(meta.createdAt), "dd.mm.yyyy hh:mm"], ["Расчёт подтвердил", meta.createdBy],
    ["Дата оценки", date(a.valuationDate), "dd.mm.yyyy"], ["Вид стоимости", a.valueType], ["Заказчик", a.customerName],
    ["Вид объекта", p.objectType], ["Адрес", p.address], ["Кадастровый номер", p.cadastralNumber], ["Общая площадь, м²", num(p.area), "0.00"],
    ["Жилая площадь, м²", num(p.livingArea), "0.00"], ["Площадь кухни, м²", num(p.kitchenArea), "0.00"], ["Комнат", p.rooms], ["Этаж", p.floor], ["Этажность", b.floors],
    ["Материал стен", lbl(WALL_MATERIALS, b.wallMaterial)], ["Год постройки", b.yearBuilt], ["Отделка", lbl(FINISHING, p.finishing)], ["Состояние дома", lbl(HOUSE_CONDITION, b.houseCondition)],
    ["Мебель", p.furniture === null ? null : p.furniture ? "Да" : "Нет"], ["До метро, м", p.metroDistanceM], ["Вид права", p.rights],
    ["Координаты", p.latitude && p.longitude ? `${p.latitude}, ${p.longitude}` : null],
  ];
  for (const [k, v, fmt] of rows) {
    const row = o.addRow({ k, v: v ?? "—" });
    if (fmt && v !== null && v !== undefined) row.getCell(2).numFmt = fmt;
  }

  // ── Аналоги
  const c = wb.addWorksheet("Аналоги");
  header(c, [
    { header: "Аналог", key: "label", width: 11 }, { header: "Источник", key: "src", width: 14 }, { header: "Ссылка", key: "url", width: 40 },
    { header: "Дата получения", key: "ret", width: 13, fmt: "dd.mm.yyyy" }, { header: "Дата предложения", key: "off", width: 13, fmt: "dd.mm.yyyy" },
    { header: "Адрес", key: "addr", width: 40 }, { header: "Цена, ₽", key: "price", width: 15, fmt: RUB0 }, { header: "Площадь, м²", key: "area", width: 11, fmt: "0.00" },
    { header: "Цена 1 м², ₽", key: "unit", width: 14, fmt: RUB }, { header: "Комнат", key: "rooms", width: 8 }, { header: "Этаж", key: "floor", width: 7 },
    { header: "Этажность", key: "floors", width: 10 }, { header: "Материал стен", key: "wall", width: 16 }, { header: "Отделка", key: "fin", width: 18 },
    { header: "Мебель", key: "furn", width: 9 }, { header: "Год постройки", key: "year", width: 10 }, { header: "До метро, м", key: "metro", width: 10 }, { header: "До объекта, м", key: "dist", width: 11 },
  ]);
  for (const cp of inCalc) {
    const rc = r.comparables.find((x) => x.id === cp.id)!;
    const row = c.addRow({
      label: cp.label, src: cp.sourceName ?? "—", url: cp.sourceUrl ?? "—", ret: date(cp.retrievedAt), off: date(cp.offerDate), addr: cp.address ?? "—",
      price: num(rc.price), area: num(rc.area), unit: num(rc.unitPrice), rooms: cp.rooms, floor: cp.floor, floors: cp.floors, wall: lbl(WALL_MATERIALS, cp.wallMaterial) ?? "нет данных",
      fin: lbl(FINISHING, cp.finishing) ?? "нет данных", furn: cp.furniture === null ? "нет данных" : cp.furniture ? "Да" : "Нет", year: cp.yearBuilt, metro: cp.metroDistanceM, dist: cp.distanceM ?? null,
    });
    if (cp.sourceUrl) row.getCell("url").value = { text: cp.sourceUrl, hyperlink: cp.sourceUrl };
  }

  // ── Корректировки
  const k = wb.addWorksheet("Корректировки");
  header(k, [
    { header: "Аналог", key: "label", width: 11 }, { header: "Фактор", key: "factor", width: 28 }, { header: "Группа", key: "stage", width: 9 },
    { header: "Объект оценки", key: "subj", width: 24 }, { header: "Аналог (значение)", key: "comp", width: 24 },
    { header: "Автоматически", key: "auto", width: 13, fmt: PCT }, { header: "Применено", key: "val", width: 12, fmt: PCT }, { header: "Коэффициент K", key: "k", width: 13, fmt: "0.0000" },
    { header: "Изменено оценщиком", key: "man", width: 14 }, { header: "Обоснование", key: "why", width: 40 }, { header: "Основание (справочник)", key: "basis", width: 40 },
  ]);
  for (const cp of inCalc) {
    for (const adj of cp.adjustments) {
      const rs = adj.ruleSnapshot as { sourceName?: string; edition?: string; isDemo?: boolean; explanation?: string; factor?: { reference?: string | null } } | null;
      k.addRow({
        label: cp.label, factor: adj.factorName, stage: adj.stage, subj: adj.subjectValue ?? "—", comp: adj.comparableValue ?? "—",
        auto: num(adj.suggestedValue), val: num(adj.value), k: num(d(1).plus(adj.value).toString()),
        man: adj.notRequired ? "не требуется" : adj.overridden ? `да${adj.overriddenAt ? `, ${new Date(adj.overriddenAt).toLocaleDateString("ru-RU")}` : ""}` : "нет",
        why: adj.comment ?? "", basis: rs?.sourceName ? `${rs.sourceName}, ред. ${rs.edition}${rs.factor?.reference ? `, ${rs.factor.reference}` : ""}${rs.isDemo ? " (ДЕМО)" : ""}${rs.explanation ? ` — ${rs.explanation}` : ""}` : "экспертное суждение",
      });
    }
  }

  // ── Расчёт: последовательность применения корректировок
  const w = wb.addWorksheet("Расчёт");
  header(w, [
    { header: "Аналог", key: "label", width: 11 }, { header: "Шаг", key: "step", width: 6 }, { header: "Операция", key: "op", width: 34 },
    { header: "Коэффициент K", key: "k", width: 13, fmt: "0.0000" }, { header: "Корректировка", key: "v", width: 13, fmt: PCT },
    { header: "Цена до, ₽/м²", key: "before", width: 15, fmt: RUB }, { header: "Цена после, ₽/м²", key: "after", width: 16, fmt: RUB }, { header: "Формула", key: "f", width: 50 },
  ]);
  for (const rc of r.comparables) {
    w.addRow({ label: rc.label, step: "P₀", op: "Цена 1 м² = цена / площадь", after: num(rc.unitPrice), f: rc.unitPriceFormula });
    rc.steps.forEach((st, i) => w.addRow({ label: rc.label, step: `P${i + 1}`, op: st.name, k: num(d(1).plus(st.value).toString()), v: num(st.value), before: num(st.before), after: num(st.after), f: st.formula }));
    const fin = w.addRow({ label: rc.label, op: "Скорректированная цена", v: num(rc.totalChange), after: num(rc.adjustedUnitPrice), f: `вес ${rc.weight} → вклад ${rc.contribution} ₽/м²` });
    fin.font = { bold: true };
    w.addRow({});
  }
  const wm = WEIGHT_METHODS[r.settings.weightMethod];
  const total = (op: string, after: number | null, f: string, fmt = RUB) => {
    const row = w.addRow({ op, after, f });
    row.font = { bold: true };
    row.getCell("after").numFmt = fmt;
  };
  w.addRow({ op: "Веса аналогов", f: `${wm.label}: ${wm.formula}` });
  for (const rc of r.comparables) w.addRow({ label: rc.label, op: "Вес × скорр. цена", k: num(rc.weight), after: num(rc.contribution), f: rc.weightFormula });
  total("Средневзвешенная цена 1 м²", num(r.weightedUnitPrice), r.weightedUnitPriceFormula);
  total("Площадь объекта, м²", num(r.subjectArea), "", "0.00");
  total("Стоимость до округления", num(r.rawValue), r.rawValueFormula);
  total("Итоговая стоимость", num(r.finalValue), r.finalValueFormula, RUB0);
  total("Итоговая цена 1 м²", num(r.finalUnitPrice), "итог / площадь");

  // ── Источники
  const src = wb.addWorksheet("Источники");
  header(src, [{ header: "Источник", key: "t", width: 50 }, { header: "Ссылка / издатель", key: "u", width: 50 }, { header: "Дата получения", key: "d", width: 14, fmt: "dd.mm.yyyy" }, { header: "Примечание", key: "n", width: 30 }]);
  for (const x of s.sources) src.addRow({ t: x.title, u: x.url ?? "—", d: date(x.retrievedAt), n: x.note ?? "" });
  for (const cp of inCalc) src.addRow({ t: `${cp.label}: ${cp.sourceName ?? "—"}${cp.provider === "metrapi" ? " (через Metrapi)" : ""}`, u: cp.sourceUrl ?? "—", d: date(cp.retrievedAt), n: cp.address ?? "" });
  if (s.directory) src.addRow({ t: `Справочник корректировок: ${s.directory.name}`, u: s.directory.publisher ?? "—", d: date(s.directory.actualDate), n: `редакция ${s.directory.edition}${s.directory.isDemo ? ", демонстрационные значения" : ""}` });
  if (p.infrastructure) src.addRow({ t: `Инфраструктура: ${p.infrastructure.providerTitle}`, u: "—", d: date(p.infrastructure.retrievedAt), n: "расстояния по прямой" });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
