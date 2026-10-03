// Снимок оценки — всё, что нужно для расчёта, проверок и отчёта.
// Сохраняется в CalculationVersion целиком, поэтому старый отчёт всегда
// воспроизводится на тех данных и коэффициентах, которые действовали тогда.

import type { CalcSettings } from "./calc/types";

export interface SnapshotAdjustment {
  id: string;
  factorCode: string;
  factorName: string;
  stage: number;
  sortOrder: number;
  subjectValue: string | null;
  comparableValue: string | null;
  suggestedValue: string | null;
  value: string;
  minValue: string | null;
  maxValue: string | null;
  overridden: boolean;
  comment: string | null;
  ruleSnapshot: Record<string, unknown> | null;
}

export interface SnapshotComparable {
  id: string;
  position: number;
  label: string;
  included: boolean;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceKind: string;
  retrievedAt: string | null;
  offerDate: string | null;
  address: string | null;
  price: string;
  area: string;
  rooms: number | null;
  floor: number | null;
  floors: number | null;
  wallMaterial: string | null;
  yearBuilt: number | null;
  finishing: string | null;
  furniture: boolean | null;
  houseCondition: string | null;
  metroDistanceM: number | null;
  rights: string | null;
  description: string | null;
  screenshotFileId: string | null;
  adjustments: SnapshotAdjustment[];
}

export interface SnapshotSource {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  retrievedAt: string;
  extracted: Record<string, unknown> | null;
  note: string | null;
}

export interface SnapshotAppraiser {
  fullName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  postalAddress: string | null;
  education: string | null;
  experienceYears: number | null;
  sroName: string | null;
  sroRegistryNumber: string | null;
  sroMembershipDate: string | null;
  sroAddress: string | null;
  qualificationCertNumber: string | null;
  qualificationCertDate: string | null;
  qualificationCertValidUntil: string | null;
  qualificationArea: string | null;
  insuranceCompany: string | null;
  insurancePolicyNumber: string | null;
  insuranceSum: string | null;
  insuranceValidFrom: string | null;
  insuranceValidUntil: string | null;
  legalEntityName: string | null;
  legalEntityInn: string | null;
  legalEntityOgrn: string | null;
  legalEntityAddress: string | null;
  legalEntityInsuranceCompany: string | null;
  legalEntityInsurancePolicy: string | null;
  legalEntityInsuranceSum: string | null;
  legalEntityInsuranceValidUntil: string | null;
  signatureFileId: string | null;
}

export interface AssessmentSnapshot {
  schemaVersion: 1;
  takenAt: string;
  assessment: {
    id: string;
    number: string;
    propertyType: string;
    approach: string;
    customerName: string | null;
    customerDetails: string | null;
    basis: string | null;
    contractNumber: string | null;
    contractDate: string | null;
    purpose: string | null;
    intendedUse: string | null;
    valueType: string | null;
    rightsAssessed: string | null;
    valuationDate: string | null;
    inspectionDate: string | null;
    reportDate: string | null;
    assumptions: string | null;
    limitingConditions: string | null;
    marketAnalysis: string | null;
  };
  property: {
    objectType: string;
    address: string | null;
    cadastralNumber: string | null;
    area: string | null;
    livingArea: string | null;
    kitchenArea: string | null;
    purpose: string | null;
    rights: string | null;
    rightHolders: string | null;
    encumbrances: string | null;
    rooms: number | null;
    floor: number | null;
    ceilingHeight: string | null;
    finishing: string | null;
    condition: string | null;
    furniture: boolean | null;
    balcony: string | null;
    bathroom: string | null;
    communications: string | null;
    metroName: string | null;
    metroDistanceM: number | null;
    district: string | null;
    description: string | null;
    provenance: Record<string, unknown>;
  };
  building: {
    cadastralNumber: string | null;
    yearBuilt: number | null;
    floors: number | null;
    wallMaterial: string | null;
    series: string | null;
    houseCondition: string | null;
    elevators: string | null;
    parking: string | null;
    overhaulYear: number | null;
    description: string | null;
    provenance: Record<string, unknown>;
  };
  appraiser: SnapshotAppraiser | null;
  directory: {
    id: string;
    code: string;
    name: string;
    edition: string;
    actualDate: string | null;
    isDemo: boolean;
    licenseType: string;
    publisher: string | null;
  } | null;
  comparables: SnapshotComparable[];
  sources: SnapshotSource[];
  /** Фотографии объекта, скриншоты, документы — файлы неизменяемы (sha256). */
  attachments: SnapshotAttachment[];
  settings: CalcSettings;
}

export interface SnapshotAttachment {
  fileId: string;
  kind: string;
  filename: string;
  mime: string;
  caption: string | null;
  sha256: string;
}
