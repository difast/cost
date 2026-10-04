import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError, notFound } from "../http";
import { diffObjects, logEvent } from "../audit";
import { ensureSystemData } from "../bootstrap";
import { stableStringify, sha256 } from "../stable";
import { calcDefaultsFor, readUserSettings } from "../userSettings";
import { DEFAULT_SETTINGS, type CalcResult, type CalcSettings } from "@/core/calc/types";
import { ENGINE_VERSION } from "@/core/calc/engine";
import { runChecks, type CheckReport } from "@/core/checks";
import { buildChecklist } from "@/core/checks/catalog";
import { suggestForComparable, type DirectoryEdition } from "@/core/adjustments/suggest";
import type { AssessmentSnapshot, SnapshotAdjustment } from "@/core/snapshot";
import type { InfrastructureSnapshot } from "@/core/infrastructure";
import { ISSUES_MESSAGE } from "@/core/calc/quality";
import type { ObjectFeatures } from "@/core/adjustments/attributes";
import { distanceM, toPoint } from "@/core/geo";
import { d } from "@/core/calc/decimal";

const iso = (v: Date | null | undefined) => (v ? v.toISOString() : null);
const decStr = (v: Prisma.Decimal | null | undefined) => (v === null || v === undefined ? null : v.toString());

export const CADASTRAL_INPUT_RE = /^\d{2}:\d{2}:\d{6,7}:\d{1,6}$/;

export async function getOwned(id: string, userId: string) {
  const a = await prisma.assessment.findFirst({ where: { id, ownerId: userId } });
  if (!a) throw notFound("Оценка");
  return a;
}

export async function nextNumber(userId: string) {
  const year = new Date().getUTCFullYear();
  const count = await prisma.assessment.count({ where: { ownerId: userId, createdAt: { gte: new Date(`${year}-01-01T00:00:00Z`) } } });
  return `${year}-${String(count + 1).padStart(3, "0")}`;
}

export async function createAssessment(userId: string, input: { address?: string; cadastralNumber?: string; query?: string }) {
  await ensureSystemData();
  let { address, cadastralNumber } = input;
  if (input.query) {
    if (CADASTRAL_INPUT_RE.test(input.query.trim())) cadastralNumber = input.query.trim();
    else address = input.query.trim();
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { settings: true } });
  const prefs = readUserSettings(user.settings);
  // Справочник: выбранный в настройках, иначе — последний активный (не демонстрационный в приоритете)
  const preferred = prefs.defaultAdjustmentSourceId
    ? await prisma.adjustmentSource.findFirst({ where: { id: prefs.defaultAdjustmentSourceId, isActive: true, OR: [{ ownerId: userId }, { ownerId: null }] } })
    : null;
  const directory =
    preferred ??
    (await prisma.adjustmentSource.findFirst({
      where: { isActive: true, segment: "apartment", OR: [{ ownerId: userId }, { ownerId: null }] },
      orderBy: [{ isDemo: "asc" }, { createdAt: "desc" }],
    }));
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const a = await prisma.assessment.create({
    data: {
      ownerId: userId,
      number: await nextNumber(userId),
      valuationDate: today,
      inspectionDate: today,
      reportDate: today,
      adjustmentSourceId: directory?.id,
      property: {
        create: {
          address: address || null,
          cadastralNumber: cadastralNumber || null,
          provenance: Object.fromEntries(
            [address && "address", cadastralNumber && "cadastralNumber"].filter(Boolean).map((k) => [k, { source: "manual", title: "Ввод оценщиком при создании", userId, at: new Date().toISOString() }]),
          ),
        },
      },
      building: { create: {} },
      calculation: { create: { settings: calcDefaultsFor(prefs) as unknown as Prisma.InputJsonValue } },
    },
  });
  await logEvent({ assessmentId: a.id, userId, action: "create", entity: "assessment", entityId: a.id, summary: `Создана оценка № ${a.number}` });
  return a;
}

export async function getDetail(id: string, userId: string) {
  await getOwned(id, userId);
  const a = await prisma.assessment.findUniqueOrThrow({
    where: { id },
    include: {
      property: true,
      building: true,
      adjustmentSource: true,
      // исходные данные поставщика в интерфейс не отдаются целиком — только нормализованный снимок
      comparables: { omit: { rawData: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { adjustments: { orderBy: [{ stage: "asc" }, { sortOrder: "asc" }] } } },
      sources: { orderBy: { createdAt: "desc" } },
      calculation: { include: { versions: { orderBy: { versionNumber: "desc" }, select: { id: true, versionNumber: true, createdAt: true, inputHash: true, engineVersion: true, note: true, result: true, createdById: true } } } },
      reports: { orderBy: { createdAt: "desc" }, include: { calculationVersion: { select: { versionNumber: true } } } },
      files: { select: { id: true, kind: true, filename: true, mime: true, size: true, caption: true, createdAt: true }, where: { kind: { not: "report" } }, orderBy: { createdAt: "asc" } },
    },
  });
  // кто изменял корректировки вручную
  const ids = [...new Set([...a.comparables.flatMap((c) => c.adjustments.map((x) => x.overriddenById)), ...(a.calculation?.versions.map((v) => v.createdById) ?? [])].filter((x): x is string => !!x))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, appraiser: { select: { fullName: true } } } }) : [];
  const names = new Map(users.map((u) => [u.id, u.appraiser?.fullName || u.email]));
  return {
    ...a,
    comparables: a.comparables.map((c) => ({ ...c, adjustments: c.adjustments.map((x) => ({ ...x, overriddenByName: x.overriddenById ? names.get(x.overriddenById) ?? null : null })) })),
    calculation: a.calculation ? { ...a.calculation, versions: a.calculation.versions.map((v) => ({ ...v, createdByName: v.createdById ? names.get(v.createdById) ?? null : null })) } : null,
  };
}

// ───────────── справочник

export async function loadEdition(sourceId: string): Promise<DirectoryEdition> {
  const s = await prisma.adjustmentSource.findUniqueOrThrow({
    where: { id: sourceId },
    include: { factors: { orderBy: { sortOrder: "asc" }, include: { categories: { orderBy: { sortOrder: "asc" } } } } },
  });
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    edition: s.edition,
    actualDate: iso(s.actualDate),
    isDemo: s.isDemo,
    licenseType: s.licenseType,
    factors: s.factors.map((f) => ({
      code: f.code,
      name: f.name,
      kind: f.kind as DirectoryEdition["factors"][number]["kind"],
      attribute: f.attribute,
      stage: f.stage,
      sortOrder: f.sortOrder,
      value: decStr(f.value),
      minValue: decStr(f.minValue),
      maxValue: decStr(f.maxValue),
      params: (f.params ?? {}) as Record<string, unknown>,
      reference: f.reference,
      enabled: f.enabled,
      groupName: f.groupName,
      region: f.region,
      methodology: f.methodology,
      comment: f.comment,
      actualDate: iso(f.actualDate),
      categories: f.categories.map((c) => ({
        code: c.code,
        label: c.label,
        coefficient: c.coefficient.toString(),
        minCoefficient: decStr(c.minCoefficient),
        maxCoefficient: decStr(c.maxCoefficient),
      })),
    })),
  };
}

/**
 * Пересчитать предложения корректировок для всех аналогов по редакции справочника оценки.
 * Значения, изменённые оценщиком вручную, сохраняются (обновляется только «предложено»).
 */
export async function syncAdjustments(assessmentId: string) {
  const a = await prisma.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    include: { property: true, building: true, comparables: { include: { adjustments: true } } },
  });
  await syncDistances(a);
  if (!a.adjustmentSourceId) return;
  const edition = await loadEdition(a.adjustmentSourceId);
  const subject = subjectFeatures(a.property, a.building);
  await prisma.$transaction(async (tx) => {
    for (const c of a.comparables) {
      const suggestions = suggestForComparable(edition, subject, comparableFeatures(c));
      const codes = new Set(suggestions.map((s) => s.factorCode));
      for (const s of suggestions) {
        const existing = c.adjustments.find((x) => x.factorCode === s.factorCode);
        const common = {
          factorName: s.factorName,
          stage: s.stage,
          sortOrder: s.sortOrder,
          subjectValue: s.subjectValue,
          comparableValue: s.comparableValue,
          suggestedValue: s.suggestedValue,
          minValue: s.minValue,
          maxValue: s.maxValue,
          ruleSnapshot: { ...s.ruleSnapshot, explanation: s.explanation, coefficient: s.coefficient } as Prisma.InputJsonValue,
        };
        if (!existing) {
          await tx.adjustment.create({
            data: { ...common, assessmentId, comparableId: c.id, factorCode: s.factorCode, value: s.suggestedValue ?? "0" },
          });
        } else if (existing.overridden || existing.notRequired) {
          // значение, заданное оценщиком, не перезаписывается — обновляются только данные справочника
          await tx.adjustment.update({ where: { id: existing.id }, data: common });
        } else {
          await tx.adjustment.update({ where: { id: existing.id }, data: { ...common, value: s.suggestedValue ?? "0" } });
        }
      }
      const stale = c.adjustments.filter((x) => !codes.has(x.factorCode)).map((x) => x.id);
      if (stale.length) await tx.adjustment.deleteMany({ where: { id: { in: stale } } });
    }
  });
}

type PropertyRow = Awaited<ReturnType<typeof prisma.property.findFirst>>;
type BuildingRow = Awaited<ReturnType<typeof prisma.building.findFirst>>;
type ComparableRow = Awaited<ReturnType<typeof prisma.comparable.findFirstOrThrow>>;

/** Признаки объекта оценки для справочника корректировок. */
export function subjectFeatures(p: PropertyRow, b: BuildingRow): ObjectFeatures {
  return {
    area: decStr(p?.area),
    floor: p?.floor,
    floors: b?.floors,
    wallMaterial: b?.wallMaterial,
    finishing: p?.finishing,
    furniture: p?.furniture,
    houseCondition: b?.houseCondition,
    metroDistanceM: p?.metroDistanceM,
    rights: p?.rights,
    rooms: p?.rooms,
    yearBuilt: b?.yearBuilt,
    livingArea: decStr(p?.livingArea),
    kitchenArea: decStr(p?.kitchenArea),
  };
}

/** Признаки аналога для справочника корректировок. */
export function comparableFeatures(c: ComparableRow): ObjectFeatures {
  const n = (c.normalized ?? {}) as { livingArea?: number | null; kitchenArea?: number | null };
  return {
    area: c.area.toString(),
    floor: c.floor,
    floors: c.floors,
    wallMaterial: c.wallMaterial,
    finishing: c.finishing,
    furniture: c.furniture,
    houseCondition: c.houseCondition,
    metroDistanceM: c.metroDistanceM,
    rights: c.rights,
    rooms: c.rooms,
    yearBuilt: c.yearBuilt,
    livingArea: n.livingArea != null ? String(n.livingArea) : null,
    kitchenArea: n.kitchenArea != null ? String(n.kitchenArea) : null,
    extra: (c.attributes ?? {}) as ObjectFeatures["extra"],
  };
}

/** Расстояние от объекта оценки до каждого аналога по координатам (по прямой). */
async function syncDistances(a: { property: PropertyRow; comparables: ComparableRow[] }) {
  const center = toPoint(a.property?.latitude, a.property?.longitude);
  for (const c of a.comparables) {
    const pt = toPoint(c.latitude, c.longitude);
    const dist = center && pt ? distanceM(center, pt) : null;
    if (dist !== c.distanceM) await prisma.comparable.update({ where: { id: c.id }, data: { distanceM: dist } });
    c.distanceM = dist;
  }
}

// ───────────── снимок

export async function getSettings(assessmentId: string): Promise<CalcSettings> {
  const calc = await prisma.calculation.upsert({
    where: { assessmentId },
    update: {},
    create: { assessmentId, settings: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue },
  });
  return { ...DEFAULT_SETTINGS, ...((calc.settings ?? {}) as Partial<CalcSettings>) };
}

export async function buildSnapshot(assessmentId: string): Promise<AssessmentSnapshot> {
  const a = await prisma.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    include: {
      property: true,
      building: true,
      adjustmentSource: true,
      comparables: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { adjustments: { orderBy: [{ stage: "asc" }, { sortOrder: "asc" }] } } },
      sources: { orderBy: { createdAt: "asc" } },
      files: { where: { kind: { in: ["photo", "document", "egrn"] } }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, filename: true, mime: true, caption: true, sha256: true } },
      owner: { include: { appraiser: true } },
    },
  });
  const p = a.property;
  const b = a.building;
  const ap = a.owner.appraiser;
  const settings = await getSettings(assessmentId);
  return {
    schemaVersion: 1,
    takenAt: new Date().toISOString(),
    assessment: {
      id: a.id,
      number: a.number,
      propertyType: a.propertyType,
      approach: a.approach,
      customerName: a.customerName,
      customerDetails: a.customerDetails,
      basis: a.basis,
      contractNumber: a.contractNumber,
      contractDate: iso(a.contractDate),
      purpose: a.purpose,
      intendedUse: a.intendedUse,
      valueType: a.valueType,
      rightsAssessed: a.rightsAssessed,
      valuationDate: iso(a.valuationDate),
      inspectionDate: iso(a.inspectionDate),
      reportDate: iso(a.reportDate),
      assumptions: a.assumptions,
      limitingConditions: a.limitingConditions,
      marketAnalysis: a.marketAnalysis,
    },
    property: {
      objectType: p?.objectType ?? "Квартира",
      address: p?.address ?? null,
      cadastralNumber: p?.cadastralNumber ?? null,
      area: decStr(p?.area),
      livingArea: decStr(p?.livingArea),
      kitchenArea: decStr(p?.kitchenArea),
      purpose: p?.purpose ?? null,
      rights: p?.rights ?? null,
      rightHolders: p?.rightHolders ?? null,
      encumbrances: p?.encumbrances ?? null,
      rooms: p?.rooms ?? null,
      floor: p?.floor ?? null,
      ceilingHeight: decStr(p?.ceilingHeight),
      finishing: p?.finishing ?? null,
      condition: p?.condition ?? null,
      furniture: p?.furniture ?? null,
      balcony: p?.balcony ?? null,
      bathroom: p?.bathroom ?? null,
      communications: p?.communications ?? null,
      metroName: p?.metroName ?? null,
      metroDistanceM: p?.metroDistanceM ?? null,
      district: p?.district ?? null,
      description: p?.description ?? null,
      ...(p?.latitude != null && p?.longitude != null ? { latitude: decStr(p.latitude)!, longitude: decStr(p.longitude)! } : {}),
      ...(p?.infrastructure ? { infrastructure: p.infrastructure as unknown as InfrastructureSnapshot } : {}),
      provenance: (p?.provenance ?? {}) as Record<string, unknown>,
    },
    building: {
      cadastralNumber: b?.cadastralNumber ?? null,
      yearBuilt: b?.yearBuilt ?? null,
      floors: b?.floors ?? null,
      wallMaterial: b?.wallMaterial ?? null,
      series: b?.series ?? null,
      houseCondition: b?.houseCondition ?? null,
      elevators: b?.elevators ?? null,
      parking: b?.parking ?? null,
      overhaulYear: b?.overhaulYear ?? null,
      description: b?.description ?? null,
      provenance: (b?.provenance ?? {}) as Record<string, unknown>,
    },
    appraiser: ap
      ? {
          fullName: ap.fullName,
          position: ap.position,
          phone: ap.phone,
          email: ap.email,
          postalAddress: ap.postalAddress,
          education: ap.education,
          experienceYears: ap.experienceYears,
          sroName: ap.sroName,
          sroRegistryNumber: ap.sroRegistryNumber,
          sroMembershipDate: iso(ap.sroMembershipDate),
          sroAddress: ap.sroAddress,
          qualificationCertNumber: ap.qualificationCertNumber,
          qualificationCertDate: iso(ap.qualificationCertDate),
          qualificationCertValidUntil: iso(ap.qualificationCertValidUntil),
          qualificationArea: ap.qualificationArea,
          insuranceCompany: ap.insuranceCompany,
          insurancePolicyNumber: ap.insurancePolicyNumber,
          insuranceSum: decStr(ap.insuranceSum),
          insuranceValidFrom: iso(ap.insuranceValidFrom),
          insuranceValidUntil: iso(ap.insuranceValidUntil),
          legalEntityName: ap.legalEntityName,
          legalEntityInn: ap.legalEntityInn,
          legalEntityOgrn: ap.legalEntityOgrn,
          legalEntityAddress: ap.legalEntityAddress,
          legalEntityInsuranceCompany: ap.legalEntityInsuranceCompany,
          legalEntityInsurancePolicy: ap.legalEntityInsurancePolicy,
          legalEntityInsuranceSum: decStr(ap.legalEntityInsuranceSum),
          legalEntityInsuranceValidUntil: iso(ap.legalEntityInsuranceValidUntil),
          signatureFileId: ap.signatureFileId,
        }
      : null,
    directory: a.adjustmentSource
      ? {
          id: a.adjustmentSource.id,
          code: a.adjustmentSource.code,
          name: a.adjustmentSource.name,
          edition: a.adjustmentSource.edition,
          actualDate: iso(a.adjustmentSource.actualDate),
          isDemo: a.adjustmentSource.isDemo,
          licenseType: a.adjustmentSource.licenseType,
          publisher: a.adjustmentSource.publisher,
        }
      : null,
    comparables: a.comparables.map((c, i) => ({
      id: c.id,
      position: i + 1,
      label: `Аналог ${i + 1}`,
      included: c.included,
      sourceName: c.sourceName,
      sourceUrl: c.sourceUrl,
      sourceKind: c.sourceKind,
      retrievedAt: iso(c.retrievedAt),
      offerDate: iso(c.offerDate),
      address: c.address,
      price: c.price.toString(),
      area: c.area.toString(),
      rooms: c.rooms,
      floor: c.floor,
      floors: c.floors,
      wallMaterial: c.wallMaterial,
      yearBuilt: c.yearBuilt,
      finishing: c.finishing,
      furniture: c.furniture,
      houseCondition: c.houseCondition,
      metroDistanceM: c.metroDistanceM,
      rights: c.rights,
      description: c.description,
      screenshotFileId: c.screenshotFileId,
      adjustments: c.adjustments.map((x) => ({
        id: x.id,
        factorCode: x.factorCode,
        factorName: x.factorName,
        stage: x.stage,
        sortOrder: x.sortOrder,
        subjectValue: x.subjectValue,
        comparableValue: x.comparableValue,
        suggestedValue: decStr(x.suggestedValue),
        value: x.value.toString(),
        minValue: decStr(x.minValue),
        maxValue: decStr(x.maxValue),
        overridden: x.overridden,
        comment: x.comment,
        ruleSnapshot: (x.ruleSnapshot ?? null) as Record<string, unknown> | null,
        ...(x.notRequired ? { notRequired: true as const } : {}),
        ...(x.overriddenAt ? { overriddenAt: x.overriddenAt.toISOString() } : {}),
        ...(x.overriddenById ? { overriddenById: x.overriddenById } : {}),
        ...(x.basisSnapshot ? { basisSnapshot: x.basisSnapshot as unknown as NonNullable<SnapshotAdjustment["basisSnapshot"]> } : {}),
      })),
      ...(c.status === "review" ? { status: "review" as const } : {}),
      ...(c.provider ? { provider: c.provider } : {}),
      ...(c.externalId ? { externalId: c.externalId } : {}),
      ...(c.houseType ? { houseType: c.houseType } : {}),
      ...(c.latitude != null && c.longitude != null ? { latitude: decStr(c.latitude)!, longitude: decStr(c.longitude)! } : {}),
      ...(c.distanceM != null ? { distanceM: c.distanceM } : {}),
      ...(c.photoUrl ? { photoUrl: c.photoUrl } : {}),
      ...(c.sourceUpdatedAt ? { sourceUpdatedAt: c.sourceUpdatedAt.toISOString() } : {}),
      ...(c.normalized ? { normalized: c.normalized as Record<string, unknown> } : {}),
    })),
    sources: a.sources.map((s) => ({
      id: s.id,
      kind: s.kind,
      title: s.title,
      url: s.url,
      retrievedAt: s.retrievedAt.toISOString(),
      extracted: (s.extracted ?? null) as Record<string, unknown> | null,
      note: s.note,
    })),
    attachments: a.files.map((f) => ({ fileId: f.id, kind: f.kind, filename: f.filename, mime: f.mime, caption: f.caption, sha256: f.sha256 })),
    settings,
  };
}

/** Хэш входных данных — без времени снимка. */
export function snapshotHash(s: AssessmentSnapshot) {
  const { takenAt: _ignored, ...rest } = s;
  return sha256(stableStringify({ engine: ENGINE_VERSION, ...rest }));
}

export async function evaluate(assessmentId: string): Promise<{ snapshot: AssessmentSnapshot; checks: CheckReport; hash: string; latestVersion: { id: string; versionNumber: number; inputHash: string } | null }> {
  const snapshot = await buildSnapshot(assessmentId);
  const checks = runChecks(snapshot);
  const latest = await prisma.calculationVersion.findFirst({
    where: { calculation: { assessmentId } },
    orderBy: { versionNumber: "desc" },
    select: { id: true, versionNumber: true, inputHash: true },
  });
  return { snapshot, checks, hash: snapshotHash(snapshot), latestVersion: latest };
}

/** Зафиксировать версию расчёта (если входные данные изменились). */
export async function commitVersion(assessmentId: string, userId: string, note?: string, opts: { acknowledge?: boolean } = {}) {
  const { snapshot, checks, hash, latestVersion } = await evaluate(assessmentId);
  if (!checks.result) throw new HttpError(422, "Расчёт невозможен — устраните ошибки", checks.issues);
  // проверки не блокируют: при ошибках нужно явное подтверждение оценщика, замечания записываются в версию
  if (checks.errors > 0 && !opts.acknowledge) {
    throw new HttpError(409, `${ISSUES_MESSAGE} Ошибок: ${checks.errors}. Подтвердите действие, чтобы продолжить с замечаниями.`, { needsAck: true, issues: checks.issues.filter((i) => i.severity === "error") });
  }
  if (checks.errors > 0) note = [note, `подтверждено с замечаниями: ошибок ${checks.errors}, предупреждений ${checks.warnings}`].filter(Boolean).join("; ");
  if (latestVersion && latestVersion.inputHash === hash) {
    return { version: await prisma.calculationVersion.findUniqueOrThrow({ where: { id: latestVersion.id } }), created: false, checks, snapshot };
  }
  const calc = await prisma.calculation.findUniqueOrThrow({ where: { assessmentId } });
  const version = await prisma.calculationVersion.create({
    data: {
      calculationId: calc.id,
      versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
      engineVersion: ENGINE_VERSION,
      inputHash: hash,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      result: checks.result as unknown as Prisma.InputJsonValue,
      createdById: userId,
      note,
    },
  });
  await logEvent({
    assessmentId,
    userId,
    action: "calculate",
    entity: "calculation",
    entityId: version.id,
    summary: `Зафиксирована версия расчёта № ${version.versionNumber}: ${d(checks.result.finalValue).toFixed(0)} ₽`,
  });
  return { version, created: true, checks, snapshot };
}

export async function updateWithAudit<T extends Record<string, unknown>>(opts: {
  assessmentId: string;
  userId: string;
  entity: string;
  entityId: string;
  before: T;
  after: T;
  summary: string;
}) {
  const diff = diffObjects(opts.before, opts.after);
  if (Object.keys(diff).length === 0) return;
  await logEvent({ assessmentId: opts.assessmentId, userId: opts.userId, action: "update", entity: opts.entity, entityId: opts.entityId, summary: opts.summary, diff });
}

export type { CalcResult };

/** Сводка проверок оценки для списка (пройдено / всего / ошибки / предупреждения). */
export async function checkSummary(assessmentId: string) {
  const snapshot = await buildSnapshot(assessmentId);
  const r = runChecks(snapshot);
  const cl = buildChecklist(r.issues, !!r.result);
  return { passed: cl.passed, total: cl.total, errors: cl.errors, warnings: cl.warnings, finalValue: r.result?.finalValue ?? null };
}

/** Выполнить функцию для элементов с ограничением параллельности. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}
