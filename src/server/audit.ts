import { prisma } from "./db";

type Plain = Record<string, unknown>;

const norm = (v: unknown) =>
  v instanceof Date ? v.toISOString() : v && typeof v === "object" && "toFixed" in (v as object) ? String(v) : v;

/** Разница между состояниями: { поле: [было, стало] }. */
export function diffObjects(before: Plain | null, after: Plain | null, ignore: string[] = ["updatedAt", "createdAt"]) {
  const out: Record<string, [unknown, unknown]> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (ignore.includes(k)) continue;
    const a = norm(before?.[k]);
    const b = norm(after?.[k]);
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out[k] = [a ?? null, b ?? null];
  }
  return out;
}

export async function logEvent(e: {
  assessmentId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  diff?: unknown;
}) {
  await prisma.assessmentEvent.create({
    data: {
      assessmentId: e.assessmentId,
      userId: e.userId ?? null,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? null,
      summary: e.summary,
      diff: e.diff === undefined ? undefined : (JSON.parse(JSON.stringify(e.diff)) as object),
    },
  });
}
