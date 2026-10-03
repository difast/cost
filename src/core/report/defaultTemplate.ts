// Шаблон «Квартира — сравнительный подход», версия 1.
// Хранится в БД (ReportTemplate) и может редактироваться/версионироваться без изменения кода.
// Этот файл — исходное значение для начального заполнения БД.

import type { TemplateDefinition } from "./model";

export const DEFAULT_TEMPLATE_CODE = "apartment_comparative";

export const DEFAULT_TEMPLATE: TemplateDefinition = {
  title: "Отчёт № {{a.number}} об оценке рыночной стоимости квартиры по адресу: {{p.address}}",
  sections: [
    {
      id: "title",
      blocks: [
        { kind: "text", text: "ОТЧЁТ № {{a.number}}", bold: true, align: "center" },
        { kind: "text", text: "об оценке {{a.valueType}} объекта недвижимости — {{p.objectType}}, расположенного по адресу: {{p.address}}, кадастровый номер {{p.cadastralNumber}}", align: "center" },
        { kind: "text", text: "Заказчик: {{a.customerName}}", align: "center" },
        { kind: "text", text: "Исполнитель: {{ap.fullName}}", align: "center" },
        { kind: "text", text: "Дата оценки: {{a.valuationDate|date}}. Дата составления отчёта: {{a.reportDate|date}}", align: "center" },
      ],
    },
    {
      id: "summary",
      title: "1. Основные факты и выводы",
      pageBreakBefore: true,
      blocks: [{ kind: "builtin", name: "summaryTable" }],
    },
    {
      id: "assignment",
      title: "2. Задание на оценку",
      blocks: [{ kind: "builtin", name: "assignmentTable" }],
    },
    {
      id: "appraiser",
      title: "3. Сведения о заказчике и оценщике",
      blocks: [
        { kind: "text", text: "Заказчик: {{a.customerName}}. {{a.customerDetails}}" },
        { kind: "builtin", name: "appraiserTable" },
        { kind: "text", text: "Оценщик подтверждает свою независимость в соответствии со статьёй 16 Федерального закона от 29.07.1998 № 135-ФЗ «Об оценочной деятельности в Российской Федерации»." },
      ],
    },
    {
      id: "assumptions",
      title: "4. Допущения и ограничительные условия",
      blocks: [
        { kind: "text", text: "{{a.assumptions}}" },
        { kind: "text", text: "{{a.limitingConditions}}" },
      ],
    },
    {
      id: "standards",
      title: "5. Применяемые стандарты оценки",
      blocks: [
        {
          kind: "text",
          text:
            "Оценка проведена в соответствии с Федеральным законом от 29.07.1998 № 135-ФЗ «Об оценочной деятельности в Российской Федерации», федеральными стандартами оценки ФСО I–VI, утверждёнными приказом Минэкономразвития России от 14.04.2022 № 200, ФСО № 7 «Оценка недвижимости», утверждённым приказом Минэкономразвития России от 25.09.2014 № 611, а также стандартами и правилами оценочной деятельности {{ap.sroName}}.",
        },
      ],
    },
    {
      id: "object",
      title: "6. Описание объекта оценки",
      pageBreakBefore: true,
      blocks: [
        { kind: "text", text: "## 6.1. Сведения об объекте оценки" },
        { kind: "builtin", name: "propertyTable" },
        { kind: "text", text: "## 6.2. Характеристики здания" },
        { kind: "builtin", name: "buildingTable" },
        { kind: "text", text: "## 6.3. Местоположение и окружение" },
        { kind: "builtin", name: "locationTable" },
      ],
    },
    {
      id: "market",
      title: "7. Анализ рынка",
      blocks: [{ kind: "builtin", name: "marketAnalysis" }],
    },
    {
      id: "hbu",
      title: "8. Анализ наиболее эффективного использования",
      blocks: [
        {
          kind: "text",
          text: "Объект оценки — жилое помещение (квартира) в многоквартирном доме. Изменение назначения помещения ограничено законодательством и не является экономически целесообразным. Наиболее эффективное использование объекта оценки — текущее использование в качестве жилого помещения.",
        },
      ],
    },
    {
      id: "approaches",
      title: "9. Выбор подходов к оценке",
      blocks: [
        {
          kind: "text",
          text:
            "Сравнительный подход применён: рынок жилой недвижимости в районе расположения объекта развит, имеется достаточное количество предложений о продаже сопоставимых квартир.\nЗатратный подход не применялся: стоимость квартиры в многоквартирном доме определяется преимущественно рыночным спросом и предложением, а выделение доли затрат на создание здания, приходящейся на отдельную квартиру, не позволяет получить достоверный результат.\nДоходный подход не применялся: рынок аренды квартир не отражает в полной мере инвестиционную привлекательность объекта, а основной мотив приобретения квартир — проживание.",
        },
      ],
    },
    {
      id: "comparative",
      title: "10. Расчёт стоимости сравнительным подходом",
      pageBreakBefore: true,
      blocks: [
        { kind: "text", text: "## 10.1. Описание объектов-аналогов" },
        { kind: "builtin", name: "comparablesTable" },
        { kind: "text", text: "## 10.2. Корректировки" },
        { kind: "builtin", name: "adjustmentsTable" },
        { kind: "builtin", name: "adjustmentRationale" },
        { kind: "text", text: "## 10.3. Цепочка расчёта по каждому аналогу" },
        { kind: "builtin", name: "calculationChain" },
        { kind: "text", text: "## 10.4. Весовые коэффициенты" },
        { kind: "builtin", name: "weightsTable" },
        { kind: "text", text: "## 10.5. Расчёт стоимости" },
        { kind: "builtin", name: "resultCalculation" },
        { kind: "builtin", name: "calcMeta" },
      ],
    },
    {
      id: "reconciliation",
      title: "11. Согласование результатов",
      blocks: [
        { kind: "text", text: "Поскольку для определения стоимости применён только сравнительный подход, его результату присвоен вес 100 %. Согласование результатов подходов не требуется." },
      ],
    },
    {
      id: "final",
      title: "12. Итоговая величина стоимости",
      blocks: [
        { kind: "text", text: "В результате проведённых расчётов {{a.valueType}} объекта оценки — {{p.objectType}}, расположенного по адресу: {{p.address}}, кадастровый номер {{p.cadastralNumber}}, общей площадью {{p.area|area}}, по состоянию на {{a.valuationDate|date}} составляет:" },
        { kind: "builtin", name: "finalValue" },
        { kind: "builtin", name: "signature" },
      ],
    },
    {
      id: "sources",
      title: "13. Перечень использованных источников информации",
      blocks: [{ kind: "builtin", name: "sourcesTable" }],
    },
    {
      id: "app-comparables",
      title: "Приложение 1. Копии объявлений объектов-аналогов",
      pageBreakBefore: true,
      blocks: [{ kind: "builtin", name: "appendixScreenshots" }],
    },
    {
      id: "app-photos",
      title: "Приложение 2. Фотографии объекта оценки",
      pageBreakBefore: true,
      blocks: [{ kind: "builtin", name: "appendixPhotos" }],
    },
    {
      id: "app-docs",
      title: "Приложение 3. Копии документов",
      pageBreakBefore: true,
      blocks: [{ kind: "builtin", name: "appendixDocuments" }],
    },
  ],
};
