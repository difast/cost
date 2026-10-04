"use client";

// Лёгкие SVG-графики в стиле ЛК: одна серия, фирменный тёмно-зелёный, подсказка при наведении.

import { useEffect, useMemo, useRef, useState } from "react";

/** Ширина контейнера: график рисуется в реальных пикселях, текст остаётся читаемым на телефоне. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
import { fmtNumber } from "@/core/format";

const BRAND = "#176b4d";
const BAND = "#cde3d7";
const GRID = "#e3e7e4";
const MUTED = "#65706b";

function niceTicks(min: number, max: number, n = 4) {
  if (min === max) return [min];
  const raw = (max - min) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((x) => x >= raw) ?? 10 * mag;
  const out: number[] = [];
  const top = Math.ceil(max / step) * step;
  for (let v = Math.floor(min / step) * step; v <= top + step * 0.001; v += step) out.push(v);
  return out;
}

const short = (v: number) => (v >= 1000 ? `${fmtNumber(v / 1000, 0)} тыс` : fmtNumber(v, 0));

export interface LinePoint { label: string; value: number; lo?: number; hi?: number; count: number }

/** Линия медианы с полосой межквартильного диапазона. */
export function LineChart({ points, height = 240, valueLabel }: { points: LinePoint[]; height?: number; valueLabel: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [box, W] = useWidth(720);
  const [hover, setHover] = useState<number | null>(null);
  const H = height, pl = 56, pr = 16, pt = 12, pb = 28;
  const { ys, ticks } = useMemo(() => {
    const all = points.flatMap((p) => [p.value, p.lo ?? p.value, p.hi ?? p.value]);
    const lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.08 || hi * 0.05;
    const t = niceTicks(lo - pad, hi + pad);
    return { ys: [t[0], t[t.length - 1]] as [number, number], ticks: t };
  }, [points]);
  const x = (i: number) => (points.length === 1 ? (pl + W - pr) / 2 : pl + (i * (W - pl - pr)) / (points.length - 1));
  const y = (v: number) => pt + (1 - (v - ys[0]) / (ys[1] - ys[0] || 1)) * (H - pt - pb);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const band = points.some((p) => p.lo !== undefined)
    ? `M${points.map((p, i) => `${x(i)},${y(p.hi ?? p.value)}`).join(" L")} L${[...points].reverse().map((p, i) => `${x(points.length - 1 - i)},${y(p.lo ?? p.value)}`).join(" L")} Z`
    : null;

  function onMove(e: React.MouseEvent) {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    setHover(best);
  }
  const hp = hover !== null ? points[hover] : null;

  return (
    <div ref={box} className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={valueLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={MUTED} className="tnum">{short(t)}</text>
          </g>
        ))}
        {points.map((p, i) => (i % Math.max(1, Math.ceil(points.length / Math.floor((W - pl - pr) / 64))) === 0) && (
          <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>{p.label}</text>
        ))}
        {band && <path d={band} fill={BAND} opacity={0.6} />}
        <path d={line} fill="none" stroke={BRAND} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : 3.5} fill={BRAND} stroke="#fff" strokeWidth={2} />)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke={MUTED} strokeDasharray="3 3" strokeWidth={1} />}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] shadow-md"
          style={{ left: `${(x(hover!) / W) * 100}%` }}
        >
          <div className="font-medium text-ink">{hp.label}</div>
          <div className="tnum text-zinc-700">{valueLabel}: {fmtNumber(hp.value, 0)} ₽</div>
          {hp.lo !== undefined && <div className="tnum text-muted">25–75 %: {fmtNumber(hp.lo, 0)} – {fmtNumber(hp.hi!, 0)} ₽</div>}
          <div className="text-muted">аналогов: {hp.count}</div>
        </div>
      )}
    </div>
  );
}

export interface BarDatum { label: string; value: number; hint: string }

/** Столбцы распределения (гистограмма). */
export function BarChart({ data, height = 210, ariaLabel }: { data: BarDatum[]; height?: number; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth(460);
  const H = height, pl = 28, pr = 6, pt = 10, pb = 24;
  const max = Math.max(...data.map((d) => d.value), 1);
  // Количество аналогов — только целые деления
  const raw = niceTicks(0, max, 3).filter((t) => t >= 0 && Number.isInteger(t));
  const ticks = raw.length >= 2 ? raw : [0, Math.ceil(max)];
  const top = ticks[ticks.length - 1] || 1;
  const bw = (W - pl - pr) / data.length;
  const y = (v: number) => pt + (1 - v / top) * (H - pt - pb);
  const every = Math.max(1, Math.ceil(data.length / Math.floor((W - pl - pr) / 44)));
  return (
    <div ref={box} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={pl - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={MUTED}>{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = y(0) - y(d.value);
          const bx = pl + i * bw + 1;
          const w = Math.max(bw - 2, 1);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={pl + i * bw} y={pt} width={bw} height={H - pt - pb} fill="transparent" />
              {d.value > 0 && <path d={`M${bx},${y(0)} V${y(d.value) + Math.min(4, h)} q0,-4 4,-4 H${bx + w - 4} q4,0 4,4 V${y(0)} Z`} fill={BRAND} opacity={hover === null || hover === i ? 1 : 0.55} />}
              {i % every === 0 && <text x={bx + w / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] shadow-md" style={{ left: `${((pl + (hover + 0.5) * bw) / W) * 100}%` }}>
          <div className="tnum text-ink">{data[hover].hint}</div>
          <div className="text-muted">аналогов: {data[hover].value}</div>
        </div>
      )}
    </div>
  );
}
