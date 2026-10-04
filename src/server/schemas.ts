import { z } from "zod";

const str = z.string().trim().max(5000).nullish().transform((v) => (v === "" ? null : v ?? null));
const longStr = z.string().max(100_000).nullish().transform((v) => (v === "" ? null : v ?? null));
const date = z
  .string()
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const m = /^\d{4}-\d{2}-\d{2}/.exec(v);
    const dt = m ? new Date(`${m[0]}T00:00:00.000Z`) : new Date(NaN);
    if (Number.isNaN(dt.getTime())) {
      ctx.addIssue({ code: "custom", message: "Некорректная дата" });
      return z.NEVER;
    }
    return dt;
  });
const dec = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const s = String(v).replace(/\s| /g, "").replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(s)) {
      ctx.addIssue({ code: "custom", message: "Ожидается число" });
      return z.NEVER;
    }
    return s;
  });
const int = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(String(v).replace(/\s/g, ""));
    if (!Number.isInteger(n)) {
      ctx.addIssue({ code: "custom", message: "Ожидается целое число" });
      return z.NEVER;
    }
    return n;
  });
const bool = z.boolean().nullish().transform((v) => v ?? null);

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  password: z.string().min(8, "Пароль — не менее 8 символов").max(200),
  name: z.string().trim().max(200).optional(),
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase(), password: z.string() });

export const appraiserSchema = z.object({
  fullName: z.string().trim().max(300).default(""),
  position: str, phone: str, email: str, postalAddress: str, education: str, experienceYears: int,
  sroName: str, sroRegistryNumber: str, sroMembershipDate: date, sroAddress: str,
  qualificationCertNumber: str, qualificationCertDate: date, qualificationCertValidUntil: date, qualificationArea: str,
  insuranceCompany: str, insurancePolicyNumber: str, insuranceSum: dec, insuranceValidFrom: date, insuranceValidUntil: date,
  legalEntityName: str, legalEntityInn: str, legalEntityOgrn: str, legalEntityAddress: str,
  legalEntityInsuranceCompany: str, legalEntityInsurancePolicy: str, legalEntityInsuranceSum: dec, legalEntityInsuranceValidUntil: date,
  bankDetails: str, signatureFileId: str,
}).partial();

export const createAssessmentSchema = z.object({
  query: z.string().trim().max(500).optional(),
  address: z.string().trim().max(500).optional(),
  cadastralNumber: z.string().trim().max(40).optional(),
});

export const assignmentSchema = z.object({
  number: z.string().trim().min(1).max(100),
  status: z.enum(["draft", "in_progress", "review", "completed", "archived"]),
  customerName: str, customerDetails: str, basis: str, contractNumber: str, contractDate: date,
  purpose: str, intendedUse: str, valueType: str, rightsAssessed: str,
  valuationDate: date, inspectionDate: date, reportDate: date,
  assumptions: longStr, limitingConditions: longStr, marketAnalysis: longStr,
  adjustmentSourceId: z.string().nullish(),
}).partial();

export const propertySchema = z.object({
  objectType: z.string().trim().max(100),
  address: str, fiasId: str, cadastralNumber: str,
  area: dec, livingArea: dec, kitchenArea: dec,
  purpose: str, rights: str, rightHolders: str, encumbrances: str,
  rooms: int, floor: int, ceilingHeight: dec,
  finishing: str, condition: str, furniture: bool, balcony: str, bathroom: str, communications: str,
  metroName: str, metroDistanceM: int, district: str, description: longStr,
}).partial();

export const buildingSchema = z.object({
  cadastralNumber: str, yearBuilt: int, floors: int, wallMaterial: str, series: str,
  houseCondition: str, elevators: str, parking: str, overhaulYear: int, description: longStr,
}).partial();

export const comparableSchema = z.object({
  included: z.boolean(),
  position: int,
  sourceName: str,
  sourceUrl: z.string().trim().max(2000).url("Некорректная ссылка").nullish().or(z.literal("")).transform((v) => v || null),
  retrievedAt: date, offerDate: date,
  address: str,
  price: dec, area: dec,
  rooms: int, floor: int, floors: int, wallMaterial: str, yearBuilt: int,
  finishing: str, furniture: bool, houseCondition: str, metroDistanceM: int, rights: str,
  description: longStr, screenshotFileId: str,
}).partial();

export const adjustmentPatchSchema = z.object({
  /** Значение в процентах (−5 = −5 %). */
  percent: dec.optional(),
  comment: str.optional(),
  reset: z.boolean().optional(),
});

export const settingsSchema = z.object({
  adjustmentMode: z.enum(["sequential", "staged"]),
  weightMethod: z.enum(["equal", "inverse_gross", "linear_gross", "manual"]),
  manualWeights: z.record(z.string(), z.string()).optional(),
  roundingStep: z.string().regex(/^\d+(\.\d+)?$/),
  weightDecimals: z.number().int().min(2).max(6),
  cvThreshold: z.string().regex(/^\d+(\.\d+)?$/),
  grossAdjustmentThreshold: z.string().regex(/^\d+(\.\d+)?$/),
}).partial();
