// Структура рабочего документа «Квартира — сравнительный подход» по умолчанию.
// Расширяемая: оценщик добавляет разделы и абзацы, структура хранится в документе оценки.
// Тексты — методические формулировки; все сведения об объекте, аналогах и расчёте
// подставляются из оценки полями {{KEY}} и блоками данных.

import type { DocBlock, DocSection, DocumentContent, TextStyle } from "./model";

let seq = 0;
const t = (sec: string, template: string, style: TextStyle = "p"): DocBlock => ({ id: `${sec}-t${++seq}`, type: "text", style, template });
const b = (sec: string, key: string): DocBlock => ({ id: `${sec}-${key.toLowerCase()}`, type: "data", key });
const s = (id: string, title: string, blocks: DocBlock[], opts: Partial<DocSection> = {}): DocSection => ({ id, title, numbered: true, blocks, ...opts });

export function defaultDocument(): DocumentContent {
  seq = 0;
  return {
    schema: 1,
    sections: [
      s("title", "Титульная часть", [
        t("title", "ОТЧЁТ № {{REPORT_NUMBER}}", "title"),
        t("title", "об оценке рыночной стоимости объекта недвижимости — {{OBJECT_TYPE}}, расположенного по адресу: {{OBJECT_ADDRESS}}, кадастровый номер {{CADASTRAL_NUMBER}}", "center"),
        t("title", "Заказчик: {{CUSTOMER}}", "center"),
        t("title", "Вид стоимости: {{VALUE_TYPE}}", "center"),
        t("title", "Исполнитель: {{APPRAISER_NAME}}", "center"),
        t("title", "Дата оценки: {{VALUATION_DATE}}. Дата составления отчёта: {{REPORT_DATE}}", "center"),
      ], { numbered: false }),
      s("general", "Общие сведения", [
        b("general", "SUMMARY_TABLE"),
        t("general", "Настоящий отчёт № {{REPORT_NUMBER}} составлен по результатам определения стоимости объекта оценки — {{OBJECT_TYPE}} по адресу: {{OBJECT_ADDRESS}}. Итоговая величина стоимости приведена в разделе «Итоговая стоимость»."),
      ], { pageBreakBefore: true }),
      s("assignment", "Задание на оценку", [b("assignment", "ASSIGNMENT_TABLE")]),
      s("appraiser", "Сведения об оценщике", [
        b("appraiser", "APPRAISER_TABLE"),
        t("appraiser", "Оценщик подтверждает свою независимость в соответствии со статьёй 16 Федерального закона от 29.07.1998 № 135-ФЗ «Об оценочной деятельности в Российской Федерации»."),
      ]),
      s("object", "Описание объекта оценки", [
        t("object", "Объектом оценки является {{OBJECT_TYPE}} общей площадью {{OBJECT_AREA}}, расположенная по адресу: {{OBJECT_ADDRESS}}, кадастровый номер {{CADASTRAL_NUMBER}}."),
        t("object", "Сведения об объекте оценки", "subheading"),
        b("object", "OBJECT_TABLE"),
        t("object", "Характеристики здания", "subheading"),
        b("object", "BUILDING_TABLE"),
      ], { pageBreakBefore: true }),
      s("rights", "Правоустанавливающие и регистрационные сведения", [b("rights", "RIGHTS_TABLE")]),
      s("location", "Описание местоположения", [
        t("location", "Объект оценки расположен по адресу: {{OBJECT_ADDRESS}}."),
        b("location", "LOCATION_TABLE"),
      ]),
      s("environment", "Описание окружения", [b("environment", "ENVIRONMENT_TABLE")]),
      s("market", "Анализ рынка", [b("market", "MARKET_ANALYSIS")], { pageBreakBefore: true }),
      s("approach", "Выбор подхода", [
        t("approach", "Объект оценки — жилое помещение (квартира) в многоквартирном доме. Изменение назначения помещения ограничено законодательством; наиболее эффективное использование объекта оценки — текущее использование в качестве жилого помещения."),
        t("approach", "Сравнительный подход применён: рынок жилой недвижимости в районе расположения объекта развит, имеются предложения о продаже сопоставимых квартир."),
        t("approach", "Затратный подход не применялся: стоимость квартиры в многоквартирном доме определяется преимущественно рыночным спросом и предложением, а выделение доли затрат на создание здания, приходящейся на отдельную квартиру, не позволяет получить достоверный результат."),
        t("approach", "Доходный подход не применялся: рынок аренды квартир не отражает в полной мере инвестиционную привлекательность объекта, а основной мотив приобретения квартир — проживание."),
      ]),
      s("comparables", "Объекты-аналоги", [
        t("comparables", "Для расчёта отобраны объекты-аналоги в количестве {{COMPARABLES_COUNT}} шт. Сведения об аналогах, источники информации и даты получения данных приведены в таблице."),
        b("comparables", "COMPARABLES_TABLE"),
      ], { pageBreakBefore: true }),
      s("comparison", "Сравнительный анализ", [b("comparison", "COMPARISON_TABLE")]),
      s("adjustments", "Корректировки", [
        t("adjustments", "Корректировки рассчитаны по справочнику: {{DIRECTORY}}. Коэффициент K — множитель цены аналога; корректировка = K − 1. Если аналог хуже объекта оценки по фактору, корректировка положительная, если лучше — отрицательная."),
        b("adjustments", "ADJUSTMENTS_TABLE"),
        t("adjustments", "Обоснование корректировок", "subheading"),
        b("adjustments", "ADJUSTMENT_RATIONALE"),
      ]),
      s("calculation", "Расчёт стоимости", [
        t("calculation", "Корректировки применяются к цене 1 м² аналога последовательно и мультипликативно: P₁ = P × K₁, P₂ = P₁ × K₂ и далее; промежуточные значения округляются до копеек."),
        b("calculation", "CALCULATION_CHAIN"),
        t("calculation", "Итоговая цена 1 м² = Σ (скорректированная цена аналога × вес аналога). Метод расчёта весов: {{WEIGHT_METHOD}}."),
        b("calculation", "CALCULATION_TABLE"),
        b("calculation", "WEIGHTS_TABLE"),
        t("calculation", "Итоговая стоимость = итоговая цена 1 м² × площадь объекта оценки ({{OBJECT_AREA}}), с округлением."),
        b("calculation", "RESULT_TABLE"),
        b("calculation", "CALC_META"),
      ], { pageBreakBefore: true }),
      s("control", "Проверки и контроль расчёта", [b("control", "QUALITY_TABLE")]),
      s("final", "Итоговая стоимость", [
        t("final", "В результате проведённых расчётов итоговая величина стоимости объекта оценки (вид стоимости — {{VALUE_TYPE}}) — {{OBJECT_TYPE}}, расположенного по адресу: {{OBJECT_ADDRESS}}, кадастровый номер {{CADASTRAL_NUMBER}}, общей площадью {{OBJECT_AREA}}, по состоянию на {{VALUATION_DATE}} составляет:"),
        b("final", "FINAL_VALUE"),
        b("final", "SIGNATURE"),
      ]),
      s("sources", "Источники информации", [b("sources", "SOURCES_TABLE")], { pageBreakBefore: true }),
      s("normative", "Нормативная база", [
        t("normative", "Оценка проведена в соответствии с Федеральным законом от 29.07.1998 № 135-ФЗ «Об оценочной деятельности в Российской Федерации», федеральными стандартами оценки ФСО I–VI (приказ Минэкономразвития России от 14.04.2022 № 200), ФСО № 7 «Оценка недвижимости» (приказ Минэкономразвития России от 25.09.2014 № 611), а также стандартами и правилами оценочной деятельности {{APPRAISER_SRO}}."),
        b("normative", "NORMATIVE_TABLE"),
      ]),
      s("assumptions", "Допущения и ограничения", [
        t("assumptions", "{{ASSUMPTIONS}}"),
        t("assumptions", "{{LIMITING_CONDITIONS}}"),
      ]),
      s("appendix", "Приложения", [
        t("appendix", "Приложение 1. Копии объявлений объектов-аналогов", "subheading"),
        b("appendix", "APPENDIX_SCREENSHOTS"),
        t("appendix", "Приложение 2. Фотографии объекта оценки", "subheading"),
        b("appendix", "APPENDIX_PHOTOS"),
        t("appendix", "Приложение 3. Копии документов", "subheading"),
        b("appendix", "APPENDIX_DOCUMENTS"),
      ], { pageBreakBefore: true }),
    ],
  };
}
