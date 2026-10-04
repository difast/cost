import { z } from "zod";
import { DEFAULT_SETTINGS, type CalcSettings } from "@/core/calc/types";

/** Системные настройки пользователя. Применяются к новым оценкам. */
export const userSettingsSchema = z.object({
  defaultAdjustmentSourceId: z.string().nullable().optional(),
  calc: z
    .object({
      adjustmentMode: z.enum(["sequential", "staged"]),
      weightMethod: z.enum(["equal", "inverse_gross", "linear_gross"]),
      roundingStep: z.enum(["0", "100", "1000", "10000", "100000"]),
      weightDecimals: z.number().int().min(2).max(6),
      cvThreshold: z.string().regex(/^0(\.\d+)?$|^1$/, "Доля от 0 до 1"),
      grossAdjustmentThreshold: z.string().regex(/^0(\.\d+)?$|^1$/, "Доля от 0 до 1"),
    })
    .partial()
    .optional(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

export function readUserSettings(raw: unknown): UserSettings {
  const r = userSettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

/** Параметры расчёта для новой оценки: системные умолчания + настройки пользователя. */
export function calcDefaultsFor(s: UserSettings): CalcSettings {
  return { ...DEFAULT_SETTINGS, ...(s.calc ?? {}) };
}
