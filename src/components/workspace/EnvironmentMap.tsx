"use client";

// Карта окружения объекта оценки: объект, аналоги (выбранные и найденные) и инфраструктура.
// Основной режим — Яндекс Карты (JS API 2.1, кластеризация меток). Если ключ не задан
// или скрипт не загрузился — схема расположения по тем же координатам (без подложки).
// Используются только уже полученные координаты — повторного геокодирования нет.

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { fmtNumber } from "@/core/format";
import { fmtDistance } from "@/core/infrastructure";

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

const INFRA_GLYPH: Record<string, string> = { metro: "М", transport: "О", school: "Ш", kindergarten: "С", polyclinic: "П", hospital: "Б", pharmacy: "А", shop: "Т" };
const COLORS = { subject: "#171a19", use: "#176b4d", review: "#b7791f", exclude: "#9aa39e", found: "#7b8580", infra: "#4f5a55" };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// ───── загрузка JS API (один раз на страницу)
type YMaps = {
  ready: (cb: () => void) => void;
  Map: new (el: HTMLElement, state: Record<string, unknown>, opts?: Record<string, unknown>) => YMap;
  Placemark: new (coords: number[], props: Record<string, unknown>, opts: Record<string, unknown>) => YObject;
  Clusterer: new (opts: Record<string, unknown>) => YCollection;
};
type YObject = { events: { add: (e: string, cb: () => void) => void }; balloon: { open: () => void }; options: { set: (k: string, v: unknown) => void } };
type YCollection = YObject & { add: (o: YObject | YObject[]) => void; removeAll: () => void };
type YMap = { geoObjects: { add: (o: unknown) => void; removeAll: () => void; getBounds: () => number[][] | null }; setBounds: (b: number[][], o: Record<string, unknown>) => void; setCenter: (c: number[], z?: number, o?: Record<string, unknown>) => void; getZoom: () => number; destroy: () => void; container: { fitToViewport: () => void } };

let ymapsPromise: Promise<YMaps> | null = null;
function loadYmaps(key: string): Promise<YMaps> {
  if (ymapsPromise) return ymapsPromise;
  ymapsPromise = new Promise<YMaps>((resolve, reject) => {
    const w = window as unknown as { ymaps?: YMaps };
    if (w.ymaps) return w.ymaps.ready(() => resolve(w.ymaps!));
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    s.async = true;
    const timer = setTimeout(() => reject(new Error("timeout")), 12_000);
    s.onload = () => {
      clearTimeout(timer);
      if (w.ymaps) w.ymaps.ready(() => resolve(w.ymaps!));
      else reject(new Error("no ymaps"));
    };
    s.onerror = () => {
      clearTimeout(timer);
      reject(new Error("load error"));
    };
    document.head.appendChild(s);
  }).catch((e) => {
    ymapsPromise = null;
    throw e;
  });
  return ymapsPromise;
}

function colorOf(p: MapPoint) {
  if (p.kind === "subject") return COLORS.subject;
  if (p.kind === "infra") return COLORS.infra;
  if (p.kind === "found") return COLORS.found;
  return p.status === "use" ? COLORS.use : p.status === "review" ? COLORS.review : COLORS.exclude;
}

export interface EnvironmentMapProps {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (p: MapPoint) => void;
  height?: number;
  /** Какие слои доступны для переключения. */
  layers?: Array<"comparables" | "found" | "infra">;
  /** Подсказка, если координат объекта нет. */
  emptyText?: string;
}

export function EnvironmentMap({ points, selectedId, onSelect, height = 420, layers = ["comparables", "found", "infra"], emptyText }: EnvironmentMapProps) {
  const [show, setShow] = useState({ comparables: true, found: true, infra: true });
  const [mode, setMode] = useState<"loading" | "yandex" | "scheme">("loading");
  const [why, setWhy] = useState<string | null>(null);
  const [popup, setPopup] = useState<MapPoint | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ ym: YMaps; map: YMap; marks: Map<string, YObject> } | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const visible = useMemo(
    () => points.filter((p) => p.kind === "subject" || (p.kind === "comparable" && show.comparables) || (p.kind === "found" && show.found) || (p.kind === "infra" && show.infra)),
    [points, show],
  );

  // ключ JS API — с сервера, только для авторизованного пользователя
  useEffect(() => {
    let cancelled = false;
    api.get<{ jsApiKey: string | null }>("/api/maps/config")
      .then(async (c) => {
        if (!c.jsApiKey) throw new Error("no-key");
        const ym = await loadYmaps(c.jsApiKey);
        if (cancelled || !el.current) return;
        const map = new ym.Map(el.current, { center: [55.75, 37.62], zoom: 12, controls: ["zoomControl", "fullscreenControl"] }, { suppressMapOpenBlock: true });
        mapRef.current = { ym, map, marks: new Map() };
        setMode("yandex");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setWhy(e.message === "no-key" ? "Ключ Яндекс Карт не задан (YANDEX_API_KEY)" : "Карта Яндекса не загрузилась");
        setMode("scheme");
      });
    return () => {
      cancelled = true;
      mapRef.current?.map.destroy();
      mapRef.current = null;
    };
  }, []);

  // метки на карте Яндекса
  useEffect(() => {
    const m = mapRef.current;
    if (mode !== "yandex" || !m) return;
    m.map.geoObjects.removeAll();
    m.marks.clear();
    const clusterer = new m.ym.Clusterer({ preset: "islands#invertedDarkGreenClusterIcons", groupByCoordinates: false, clusterDisableClickZoom: false, hasBalloon: false });
    for (const p of visible) {
      const body = p.lines.map((l) => `<div>${esc(l)}</div>`).join("");
      const pm = new m.ym.Placemark(
        [p.lat, p.lon],
        { hintContent: esc(p.title), balloonContentHeader: esc(p.title), balloonContentBody: body, iconContent: p.caption ? esc(p.caption) : p.kind === "infra" ? esc(INFRA_GLYPH[p.category ?? ""] ?? "•") : "" },
        p.kind === "subject"
          ? { preset: "islands#blackStretchyIcon", iconColor: COLORS.subject, zIndex: 1000 }
          : p.kind === "comparable"
            ? { preset: "islands#circleIcon", iconColor: colorOf(p), zIndex: 900 }
            : p.kind === "infra"
              ? { preset: "islands#circleIcon", iconColor: COLORS.infra }
              : { preset: "islands#circleDotIcon", iconColor: COLORS.found },
      );
      pm.events.add("click", () => onSelectRef.current?.(p));
      m.marks.set(p.id, pm);
      if (p.kind === "found" || p.kind === "infra") clusterer.add(pm);
      else m.map.geoObjects.add(pm);
    }
    m.map.geoObjects.add(clusterer);
    const b = m.map.geoObjects.getBounds();
    if (b) m.map.setBounds(b, { checkZoomRange: true, zoomMargin: 40 });
  }, [visible, mode]);

  // выбор из списка → подсветка метки
  useEffect(() => {
    const m = mapRef.current;
    if (!selectedId) return setPopup(null);
    const p = points.find((x) => x.id === selectedId) ?? null;
    if (mode === "yandex" && m && p) {
      m.map.setCenter([p.lat, p.lon], Math.max(m.map.getZoom(), 15), { duration: 300 });
      m.marks.get(p.id)?.balloon.open();
    }
    setPopup(p);
  }, [selectedId, points, mode]);

  const counts = {
    comparables: points.filter((p) => p.kind === "comparable").length,
    found: points.filter((p) => p.kind === "found").length,
    infra: points.filter((p) => p.kind === "infra").length,
  };
  const hasSubject = points.some((p) => p.kind === "subject");

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px]">
        {layers.includes("comparables") && <LayerToggle on={show.comparables} onClick={() => setShow({ ...show, comparables: !show.comparables })} color={COLORS.use} label={`Аналоги в оценке · ${counts.comparables}`} />}
        {layers.includes("found") && <LayerToggle on={show.found} onClick={() => setShow({ ...show, found: !show.found })} color={COLORS.found} label={`Найденные · ${counts.found}`} hollow />}
        {layers.includes("infra") && <LayerToggle on={show.infra} onClick={() => setShow({ ...show, infra: !show.infra })} color={COLORS.infra} label={`Инфраструктура · ${counts.infra}`} />}
      </div>
      <div className="relative overflow-hidden rounded-md border border-line bg-[#eef1ef]" style={{ height }}>
        <div ref={el} className={`absolute inset-0 ${mode === "yandex" ? "" : "invisible"}`} />
        {mode === "loading" && <div className="absolute inset-0 flex items-center justify-center text-[12.5px] text-muted">Загрузка карты…</div>}
        {mode === "scheme" && (hasSubject || visible.length > 0 ? <Scheme points={visible} selectedId={selectedId ?? null} onSelect={(p) => onSelect?.(p)} height={height} /> : <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[12.5px] text-muted">{emptyText ?? "Нет координат для отображения"}</div>)}
        {mode === "scheme" && popup && <Popup p={popup} onClose={() => setPopup(null)} />}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
        <Legend color={COLORS.subject} square label="Объект оценки" />
        <Legend color={COLORS.use} label="Используется" />
        <Legend color={COLORS.review} label="На проверке" />
        <Legend color={COLORS.exclude} label="Не используется" />
        {mode === "scheme" && why && <span className="ml-auto">{why} — показана схема по координатам, без подложки</span>}
      </div>
    </div>
  );
}

function LayerToggle({ on, onClick, color, label, hollow }: { on: boolean; onClick: () => void; color: string; label: string; hollow?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition ${on ? "border-line-strong bg-white text-ink" : "border-line bg-subtle text-muted"}`}>
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={hollow ? { border: `2px solid ${on ? color : "#c4cbc7"}` } : { background: on ? color : "#c4cbc7" }} />
      {label}
    </button>
  );
}

function Legend({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return <span className="inline-flex items-center gap-1"><span className={`inline-block h-2.5 w-2.5 ${square ? "rounded-sm" : "rounded-full"}`} style={{ background: color }} />{label}</span>;
}

function Popup({ p, onClose }: { p: MapPoint; onClose: () => void }) {
  return (
    <div className="absolute left-2 top-2 z-10 max-w-[260px] rounded-md border border-line bg-white p-2.5 text-[12px] shadow-lg">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 font-medium leading-snug text-ink">{p.title}</div>
        <button className="text-muted hover:text-ink" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      {p.lines.map((l, i) => <div key={i} className="mt-0.5 leading-snug text-zinc-700">{l}</div>)}
    </div>
  );
}

/** Схема расположения по координатам: равнопромежуточная проекция, масштабная линейка. */
function Scheme({ points, selectedId, onSelect, height }: { points: MapPoint[]; selectedId: string | null; onSelect: (p: MapPoint) => void; height: number }) {
  const W = 1000;
  const H = Math.round((height / 420) * 600);
  const pad = 40;
  const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLon - minLon) * k, 0.002), spanY = Math.max(maxLat - minLat, 0.002);
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const cx = (minLon + maxLon) / 2, cy = (minLat + maxLat) / 2;
  const X = (lon: number) => W / 2 + (lon - cx) * k * scale;
  const Y = (lat: number) => H / 2 - (lat - cy) * scale;
  // масштабная линейка: 1° широты ≈ 111,32 км
  const mPerUnit = 111_320 / scale;
  const nice = [50, 100, 200, 500, 1000, 2000, 5000, 10000].find((m) => m / mPerUnit >= 70) ?? 10000;
  const order: MapPointKind[] = ["found", "infra", "comparable", "subject"];
  const sorted = [...points].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (a.id === selectedId ? 1 : b.id === selectedId ? -1 : 0));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" role="img" aria-label="Схема расположения объекта, аналогов и инфраструктуры">
      <rect width={W} height={H} fill="#f3f5f4" />
      {sorted.map((p) => {
        const x = X(p.lon), y = Y(p.lat), sel = p.id === selectedId, c = colorOf(p);
        const common = { onClick: () => onSelect(p), style: { cursor: "pointer" } };
        return (
          <g key={p.id} {...common}>
            <title>{[p.title, ...p.lines].join("\n")}</title>
            {sel && <circle cx={x} cy={y} r={p.kind === "found" ? 12 : 17} fill="none" stroke={c} strokeWidth={2.5} opacity={0.6} />}
            {/* невидимая увеличенная область нажатия */}
            <circle cx={x} cy={y} r={14} fill="transparent" />
            {p.kind === "subject" ? (
              <rect x={x - 9} y={y - 9} width={18} height={18} rx={3} fill={c} stroke="#fff" strokeWidth={2} />
            ) : p.kind === "found" ? (
              <circle cx={x} cy={y} r={5} fill="#fff" stroke={c} strokeWidth={2} />
            ) : p.kind === "infra" ? (
              <>
                <rect x={x - 8} y={y - 8} width={16} height={16} rx={8} fill="#fff" stroke={c} strokeWidth={1.5} />
                <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill={c}>{INFRA_GLYPH[p.category ?? ""] ?? "•"}</text>
              </>
            ) : (
              <>
                <circle cx={x} cy={y} r={11} fill={c} stroke="#fff" strokeWidth={2} />
                <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">{p.caption ?? ""}</text>
              </>
            )}
          </g>
        );
      })}
      <g transform={`translate(${pad}, ${H - 18})`}>
        <line x1={0} y1={0} x2={nice / mPerUnit} y2={0} stroke="#4f5a55" strokeWidth={2} />
        <line x1={0} y1={-4} x2={0} y2={4} stroke="#4f5a55" strokeWidth={2} />
        <line x1={nice / mPerUnit} y1={-4} x2={nice / mPerUnit} y2={4} stroke="#4f5a55" strokeWidth={2} />
        <text x={nice / mPerUnit + 8} y={4} fontSize={12} fill="#4f5a55">{nice >= 1000 ? `${nice / 1000} км` : `${nice} м`}</text>
      </g>
    </svg>
  );
}

/** Точки инфраструктуры из сохранённого снимка (без повторных запросов). */
export function infraPoints(infra: { categories: Array<{ key: string; label: string; items: Array<{ name: string; type: string | null; address: string | null; lat: number; lon: number; distanceM: number }> }>; providerTitle?: string } | null): MapPoint[] {
  if (!infra) return [];
  return infra.categories.flatMap((c) =>
    c.items.map((i, n) => ({
      id: `infra:${c.key}:${n}`,
      kind: "infra" as const,
      lat: i.lat,
      lon: i.lon,
      title: i.name,
      category: c.key,
      categoryLabel: c.label,
      lines: [c.label + (i.type ? ` · ${i.type}` : ""), i.address ?? "", `${fmtDistance(i.distanceM)} от объекта`, `${i.lat.toFixed(6)}, ${i.lon.toFixed(6)}`, `Источник: ${infra.providerTitle ?? "Яндекс Карты"}`].filter(Boolean),
    })),
  );
}

export const unitPriceLine = (v: number | string | null | undefined) => (v === null || v === undefined ? "Цена за м²: нет данных" : `${fmtNumber(v, 0)} ₽/м²`);
