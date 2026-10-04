// Точки карты окружения (без React — используется и в тестах).

export type MapPointKind = "subject" | "comparable" | "found" | "infra";

export interface MapPoint {
  id: string;
  kind: MapPointKind;
  lat: number;
  lon: number;
  title: string;
  /** Короткая подпись на метке (номер аналога). */
  caption?: string;
  lines: string[];
  /** Для аналогов: use | review | exclude. */
  status?: string | null;
  /** Для инфраструктуры: категория. */
  category?: string;
  categoryLabel?: string;
  source?: string;
}

/** Метка «Объект оценки» по сохранённым координатам; null — координат нет (карта показывает подсказку). */
export function subjectPoint(lat: unknown, lon: unknown, address: unknown): MapPoint | null {
  if (lat === null || lat === undefined || lat === "" || lon === null || lon === undefined || lon === "") return null;
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return { id: "subject", kind: "subject", lat: la, lon: lo, title: "Объект оценки", lines: [String(address ?? ""), `${la.toFixed(6)}, ${lo.toFixed(6)}`].filter(Boolean) };
}
