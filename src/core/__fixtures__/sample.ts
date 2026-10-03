import { DEFAULT_SETTINGS } from "../calc/types";
import type { AssessmentSnapshot, SnapshotAdjustment, SnapshotComparable } from "../snapshot";

const adj = (id: string, code: string, name: string, value: string, stage = 2, extra: Partial<SnapshotAdjustment> = {}): SnapshotAdjustment => ({
  id, factorCode: code, factorName: name, stage, sortOrder: stage === 1 ? 1 : 10,
  subjectValue: null, comparableValue: null, suggestedValue: value, value,
  minValue: null, maxValue: null, overridden: false, comment: null,
  ruleSnapshot: { sourceCode: "demo", edition: "2026.1", factor: { kind: "category" } }, ...extra,
});

const comp = (i: number, price: string, area: string, adjs: SnapshotAdjustment[]): SnapshotComparable => ({
  id: `c${i}`, position: i, label: `Аналог ${i}`, included: true, sourceName: "ЦИАН",
  sourceUrl: `https://example.org/offer/${i}`, sourceKind: "manual",
  retrievedAt: "2026-09-20T00:00:00.000Z", offerDate: "2026-09-15T00:00:00.000Z",
  address: `г. Москва, ул. Примерная, д. ${i}`, price, area, rooms: 2, floor: 5, floors: 9,
  wallMaterial: "panel", yearBuilt: 1985, finishing: "standard", furniture: true, houseCondition: "good",
  metroDistanceM: 600, rights: "Собственность", description: null, screenshotFileId: `f${i}`, adjustments: adjs,
});

export function sampleSnapshot(): AssessmentSnapshot {
  return {
    schemaVersion: 1,
    takenAt: "2026-10-01T00:00:00.000Z",
    assessment: {
      id: "as1", number: "2026/10-01", propertyType: "apartment", approach: "comparative",
      customerName: "Иванов Иван Иванович", customerDetails: "паспорт 0000 000000",
      basis: "Договор на оценку", contractNumber: "15/26", contractDate: "2026-09-25T00:00:00.000Z",
      purpose: "Определение рыночной стоимости для целей ипотечного кредитования", intendedUse: "Предоставление в банк",
      valueType: "Рыночная стоимость", rightsAssessed: "Право собственности",
      valuationDate: "2026-09-28T00:00:00.000Z", inspectionDate: "2026-09-28T00:00:00.000Z", reportDate: "2026-10-01T00:00:00.000Z",
      assumptions: "Оценка проводится на 28.09.2026. Объект с кадастровым номером 77:01:0001001:1234 не обременён.",
      limitingConditions: null,
      marketAnalysis: "Рынок вторичного жилья стабилен.",
    },
    property: {
      objectType: "Квартира", address: "г. Москва, ул. Тестовая, д. 1, кв. 10", cadastralNumber: "77:01:0001001:1234",
      area: "42.9", livingArea: "28.1", kitchenArea: "7.5", purpose: "Жилое", rights: "Собственность", rightHolders: null,
      encumbrances: "Не зарегистрировано", rooms: 2, floor: 1, ceilingHeight: "2.64", finishing: "standard", condition: "Хорошее",
      furniture: false, balcony: null, bathroom: "Раздельный", communications: "Центральные", metroName: "Тестовая", metroDistanceM: 450,
      district: "Центральный", description: "Двухкомнатная квартира общей площадью 42,9 кв. м", provenance: {},
    },
    building: {
      cadastralNumber: "77:01:0001001:1000", yearBuilt: 1984, floors: 9, wallMaterial: "panel", series: "II-49",
      houseCondition: "good", elevators: "1", parking: null, overhaulYear: null, description: null, provenance: {},
    },
    appraiser: {
      fullName: "Петров Пётр Петрович", position: "Оценщик", phone: null, email: null, postalAddress: null, education: null,
      experienceYears: 10, sroName: "СРО «Пример»", sroRegistryNumber: "001234", sroMembershipDate: "2015-01-01T00:00:00.000Z", sroAddress: null,
      qualificationCertNumber: "000001-1", qualificationCertDate: "2024-01-01T00:00:00.000Z",
      qualificationCertValidUntil: "2027-01-01T00:00:00.000Z", qualificationArea: "Оценка недвижимости",
      insuranceCompany: "СК «Пример»", insurancePolicyNumber: "П-1", insuranceSum: "300000",
      insuranceValidFrom: "2026-01-01T00:00:00.000Z", insuranceValidUntil: "2026-12-31T00:00:00.000Z",
      legalEntityName: null, legalEntityInn: null, legalEntityOgrn: null, legalEntityAddress: null,
      legalEntityInsuranceCompany: null, legalEntityInsurancePolicy: null, legalEntityInsuranceSum: null,
      legalEntityInsuranceValidUntil: null, signatureFileId: null,
    },
    directory: { id: "s1", code: "demo", name: "Демо", edition: "2026.1", actualDate: null, isDemo: false, licenseType: "own", publisher: null },
    comparables: [
      comp(1, "10000000", "45", [adj("a1", "bargain", "Торг", "-0.05", 1), adj("a2", "floor", "Этаж", "-0.06")]),
      comp(2, "9500000", "40", [adj("a3", "bargain", "Торг", "-0.05", 1), adj("a4", "floor", "Этаж", "-0.06")]),
      comp(3, "9900000", "43.5", [adj("a5", "bargain", "Торг", "-0.05", 1), adj("a6", "floor", "Этаж", "-0.06")]),
    ],
    sources: [
      {
        id: "src1", kind: "egrn_xml", title: "Выписка ЕГРН", url: null, retrievedAt: "2026-09-26T00:00:00.000Z",
        extracted: { cadastralNumber: "77:01:0001001:1234", area: "42.9", address: "г. Москва, ул. Тестовая, д. 1, кв. 10", floor: 1 },
        note: null,
      },
    ],
    attachments: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}
