import type { CalcResult, CalcSettings } from "@/core/calc/types";
import type { CheckIssue } from "@/core/checks";

export interface AdjustmentRow {
  id: string;
  comparableId: string;
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
  ruleSnapshot: RuleSnapshot | null;
  notRequired: boolean;
  overriddenById: string | null;
  overriddenByName: string | null;
  overriddenAt: string | null;
  basisSnapshot: { subjectValue: string | null; comparableValue: string | null; suggestedValue: string | null } | null;
}

export interface RuleSnapshot {
  explanation?: string;
  sourceName?: string;
  sourceCode?: string;
  edition?: string;
  actualDate?: string | null;
  isDemo?: boolean;
  coefficient?: string | null;
  expression?: string;
  factor?: { code?: string; kind?: string; attribute?: string | null; reference?: string | null; groupName?: string | null; region?: string | null; methodology?: string | null; actualDate?: string | null };
}

export interface ComparableRow {
  id: string;
  position: number;
  included: boolean;
  sourceKind: string;
  sourceName: string | null;
  sourceUrl: string | null;
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
  adjustments: AdjustmentRow[];
  status: "use" | "review" | "exclude";
  provider: string | null;
  externalId: string | null;
  houseType: string | null;
  region: string | null;
  city: string | null;
  district: string | null;
  latitude: string | null;
  longitude: string | null;
  distanceM: number | null;
  photoUrl: string | null;
  sourceUpdatedAt: string | null;
  normalized: Record<string, unknown> | null;
  provenance: Provenance;
}

export type Provenance = Record<string, { source?: string; title?: string; at?: string }>;

export interface Detail {
  id: string;
  number: string;
  status: string;
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
  adjustmentSourceId: string | null;
  adjustmentSource: { id: string; name: string; edition: string; isDemo: boolean } | null;
  property: Record<string, unknown> & { provenance: Provenance };
  building: Record<string, unknown> & { provenance: Provenance };
  comparables: ComparableRow[];
  sources: Array<{ id: string; kind: string; title: string; retrievedAt: string; fileId: string | null; extracted: Record<string, unknown> | null; note: string | null }>;
  calculation: { versions: Array<{ id: string; versionNumber: number; createdAt: string; inputHash: string; engineVersion: string; note: string | null; result: CalcResult }> } | null;
  reports: Array<{ id: string; format: string; fileId: string; createdAt: string; calculationVersion: { versionNumber: number }; checks: { errors: number; warnings: number } }>;
  files: Array<{ id: string; kind: string; filename: string; mime: string; size: number; caption: string | null; createdAt: string }>;
}

export interface CalcState {
  result: CalcResult | null;
  issues: CheckIssue[];
  errors: number;
  warnings: number;
  canGenerate: boolean;
  settings: CalcSettings;
  inputHash: string;
  latestVersion: { id: string; versionNumber: number; inputHash: string } | null;
  isStale: boolean;
  labels: Record<string, string>;
}
