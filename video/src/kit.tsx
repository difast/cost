// Общие элементы ролика: шрифт, фон, окно браузера, камера, курсор, подсветка, подписи.
// Все движения — по кривым с плавным разгоном и торможением (без линейных рывков).

import React, { useEffect, useState } from "react";
import { AbsoluteFill, Easing, Img, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const C = {
  brand: "#176b4d",
  brandLight: "#2a9a6d",
  brandSoft: "#e8f2ed",
  deep: "#101413",
  graphite: "#171a19",
  ink: "#111816",
  muted: "#66706b",
  line: "#e3e8e5",
  warn: "#b7791f",
  err: "#c2410c",
};
export const FONT = "'Inter EVMO', Inter, 'DejaVu Sans', Arial, sans-serif";
export const FPS = 30;

/** Плавная кривая (ease-in-out). */
export const EASE = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Значение по ключевым кадрам [[кадр, значение], …] с плавными переходами между ними. */
export function kf(frame: number, keys: Array<[number, number]>, easing = EASE): number {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (frame <= f1) return interpolate(frame, [f0, f1], [v0, v1], { easing, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }
  return keys[keys.length - 1][1];
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const appear = (frame: number, start: number, dur = 18) => interpolate(frame, [start, start + dur], [0, 1], { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Подключение шрифта Inter из public/fonts (рендер ждёт загрузки). */
export function Fonts() {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const faces = [
      new FontFace("Inter EVMO", `url(${staticFile("fonts/inter-cyrillic-wght-normal.woff2")})`, { weight: "100 900", unicodeRange: "U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" }),
      new FontFace("Inter EVMO", `url(${staticFile("fonts/inter-latin-wght-normal.woff2")})`, { weight: "100 900" }),
    ];
    Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff))))
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
  return null;
}

/** Знак ЭВМО: крыша над буквой «Э». */
export function Mark({ size = 64, bg = C.brand, fg = "#fff" }: { size?: number; bg?: string; fg?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
      <rect width="512" height="512" rx="112" fill={bg} />
      <g fill="none" stroke={fg} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round">
        <path d="M124 176 256 92l132 84" />
        <path d="M191.8 250.7A96 96 0 1 1 191.8 393.3" />
        <path d="M220 322H352" />
      </g>
    </svg>
  );
}

/** Фон: графит с медленно плывущими мягкими пятнами фирменного цвета. */
export function Background({ light = false }: { light?: boolean }) {
  const f = useCurrentFrame();
  const blob = (x: number, y: number, r: number, color: string, speed: number, phase: number) => (
    <div
      style={{
        position: "absolute",
        left: `${x + Math.sin(f / speed + phase) * 6}%`,
        top: `${y + Math.cos(f / (speed * 1.3) + phase) * 6}%`,
        width: r, height: r, borderRadius: "50%", background: color, filter: "blur(120px)", opacity: light ? 0.35 : 0.55,
        transform: "translate(-50%, -50%)",
      }}
    />
  );
  return (
    <AbsoluteFill style={{ background: light ? "#eef3f0" : `linear-gradient(160deg, ${C.deep} 0%, #13201b 55%, #0d1714 100%)`, overflow: "hidden" }}>
      {blob(18, 22, 900, C.brand, 70, 0)}
      {blob(85, 78, 1000, light ? "#cfe6da" : "#1d5a43", 90, 2)}
      {blob(70, 10, 600, light ? "#e2efe8" : "#24493c", 60, 4)}
    </AbsoluteFill>
  );
}

/** Метка «Демонстрационные данные» в углу кадра. */
export function DemoBadge({ x = 40, y = 34, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <div style={{ position: "absolute", right: x, top: y, fontFamily: FONT, fontSize: 20 * scale, color: "rgba(255,255,255,.62)", letterSpacing: ".02em", display: "flex", alignItems: "center", gap: 10 * scale }}>
      <span style={{ width: 8 * scale, height: 8 * scale, borderRadius: 9, background: C.brandLight }} />
      Демонстрационные данные
    </div>
  );
}

/** Подпись сцены: номер шага, заголовок, пояснение. */
export function Caption({ step, title, text, x, y, width = 720, scale = 1, delay = 8, vertical = false }: { step: string; title: string; text: string; x: number; y: number; width?: number; scale?: number; delay?: number; vertical?: boolean }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 200, mass: 0.9 } });
  const s2 = spring({ frame: f - delay - 6, fps, config: { damping: 200 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, width, fontFamily: FONT, color: "#fff" }}>
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: vertical ? "flex-start" : "center", gap: (vertical ? 18 : 14) * scale, opacity: s, transform: `translateY(${(1 - s) * 24}px)` }}>
        <span style={{ fontSize: 22 * scale, fontWeight: 600, color: C.ink, background: "#9fe0bf", borderRadius: 999, padding: `${5 * scale}px ${14 * scale}px` }}>{step}</span>
        <span style={{ fontSize: 50 * scale, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05 }}>{title}</span>
      </div>
      <div style={{ marginTop: 14 * scale, fontSize: 27 * scale, lineHeight: 1.35, color: "rgba(255,255,255,.78)", opacity: s2, transform: `translateY(${(1 - s2) * 18}px)` }}>{text}</div>
    </div>
  );
}

export interface CamKey { f: number; s: number; x: number; y: number }

/**
 * Окно браузера с кадром интерфейса и «камерой»: масштаб и точка фокуса по ключевым кадрам.
 * Дочерние элементы (курсор, подсветка) задаются в координатах кадра (CSS-пиксели 1600×900) и движутся вместе с камерой.
 */
export function BrowserShot({
  src, cam, width, height, left, top, url = "evmo.ru/app/assessments/2026-001", children, crossTo, crossAt = 0,
}: {
  src: string; cam: CamKey[]; width: number; height: number; left: number; top: number; url?: string; children?: (s: number) => React.ReactNode;
  crossTo?: string; crossAt?: number;
}) {
  const f = useCurrentFrame();
  const BAR = Math.round(height * 0.045);
  const vh = height - BAR;
  const k = width / 1600;
  const s = kf(f, cam.map((c) => [c.f, c.s]));
  const fx = kf(f, cam.map((c) => [c.f, c.x]));
  const fy = kf(f, cam.map((c) => [c.f, c.y]));
  const sw = 1600 * k * s, sh = 900 * k * s;
  const tx = Math.min(0, Math.max(width - sw, width / 2 - fx * k * s));
  const ty = Math.min(0, Math.max(vh - sh, vh / 2 - fy * k * s));
  const cross = crossTo ? interpolate(f, [crossAt, crossAt + 14], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <div style={{ position: "absolute", left, top, width, height, borderRadius: 18, overflow: "hidden", background: "#fff", boxShadow: "0 40px 120px -30px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08)" }}>
      <div style={{ height: BAR, background: "#f1f3f2", borderBottom: "1px solid #e1e5e3", display: "flex", alignItems: "center", gap: BAR * 0.22, padding: `0 ${BAR * 0.5}px` }}>
        {["#f26b5b", "#f6be4f", "#5ec46b"].map((c) => <span key={c} style={{ width: BAR * 0.3, height: BAR * 0.3, borderRadius: 99, background: c }} />)}
        <div style={{ marginLeft: BAR * 0.6, flex: 1, maxWidth: width * 0.45, height: BAR * 0.62, borderRadius: 8, background: "#fff", border: "1px solid #e1e5e3", display: "flex", alignItems: "center", padding: `0 ${BAR * 0.35}px`, fontFamily: FONT, fontSize: BAR * 0.36, color: "#5b6460" }}>
          <svg width={BAR * 0.34} height={BAR * 0.34} viewBox="0 0 24 24" style={{ marginRight: 8 }}><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" fill="none" stroke="#5b6460" strokeWidth="2" /></svg>
          {url}
        </div>
      </div>
      <div style={{ position: "absolute", top: BAR, left: 0, width, height: vh, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: tx, top: ty, width: 1600, height: 900, transform: `scale(${k * s})`, transformOrigin: "0 0" }}>
          <Img src={staticFile(src)} style={{ position: "absolute", width: 1600, height: 900 }} />
          {crossTo && <Img src={staticFile(crossTo)} style={{ position: "absolute", width: 1600, height: 900, opacity: cross }} />}
          {children?.(s)}
        </div>
      </div>
    </div>
  );
}

/** Курсор: плавное движение по точкам, «нажатие» с волной. Координаты — в системе кадра. */
export function Cursor({ path, clicks = [], camScale = 1, until = 99999 }: { path: Array<[number, number, number]>; clicks?: number[]; camScale?: number; until?: number }) {
  const f = useCurrentFrame();
  const x = kf(f, path.map(([fr, px]) => [fr, px]));
  const y = kf(f, path.map(([fr, , py]) => [fr, py]));
  const opacity = Math.min(interpolate(f, [path[0][0], path[0][0] + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), interpolate(f, [until - 8, until], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  if (opacity <= 0 && f > path[0][0]) return null;
  const press = clicks.reduce((acc, c) => acc + interpolate(f, [c - 3, c, c + 6], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0);
  const inv = 1 / camScale;
  return (
    <>
      {clicks.map((c) => {
        const t = interpolate(f, [c, c + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        if (f < c || t >= 1) return null;
        return <div key={c} style={{ position: "absolute", left: x - 26 * inv, top: y - 26 * inv, width: 52 * inv, height: 52 * inv, borderRadius: "50%", border: `${3 * inv}px solid ${C.brand}`, opacity: 1 - t, transform: `scale(${0.4 + t})` }} />;
      })}
      <svg width={30 * inv} height={30 * inv} viewBox="0 0 24 24" style={{ position: "absolute", left: x, top: y, opacity, transform: `scale(${1 - press * 0.15})`, transformOrigin: "0 0", filter: "drop-shadow(0 3px 6px rgba(0,0,0,.35))" }}>
        <path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </>
  );
}

/** Подсветка области кадра: мягкая рамка с затемнением вокруг. */
export function Highlight({ box, from, to = 9999, pad = 8, camScale = 1, dim = true }: { box: { x: number; y: number; w: number; h: number }; from: number; to?: number; pad?: number; camScale?: number; dim?: boolean }) {
  const f = useCurrentFrame();
  const o = Math.min(appear(f, from, 16), 1 - appear(f, to, 14));
  if (o <= 0) return null;
  const inv = 1 / camScale;
  const r = { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
  return (
    <>
      {dim && <div style={{ position: "absolute", inset: 0, opacity: o * 0.42, background: "#0b1210", clipPath: `polygon(0 0, 1600px 0, 1600px 900px, 0 900px, 0 0, ${r.x}px ${r.y}px, ${r.x}px ${r.y + r.h}px, ${r.x + r.w}px ${r.y + r.h}px, ${r.x + r.w}px ${r.y}px, ${r.x}px ${r.y}px)` }} />}
      <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: 12, opacity: o, boxShadow: `0 0 0 ${3 * inv}px ${C.brand}, 0 0 ${30 * inv}px ${C.brand}88` }} />
    </>
  );
}

/** Плавное появление и исчезновение сцены (перекрёстные переходы между сценами). */
export function SceneFade({ dur, children, fade = 16 }: { dur: number; children: React.ReactNode; fade?: number }) {
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [0, fade], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" }), interpolate(f, [dur - fade, dur], [1, 0], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const sc = interpolate(f, [0, fade + 6], [1.025, 1], { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o, transform: `scale(${sc})` }}>{children}</AbsoluteFill>;
}

/** Всплывающая карточка поверх кадра (итог, счётчики, файлы). */
export function Floating({ x, y, delay, children, scale = 1 }: { x: number; y: number; delay: number; children: React.ReactNode; scale?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 16, mass: 0.8, stiffness: 120 } });
  const float = Math.sin((f - delay) / 22) * 4;
  return (
    <div style={{ position: "absolute", left: x, top: y + float, opacity: clamp01(s * 1.4), transform: `translateY(${(1 - s) * 40}px) scale(${(0.9 + s * 0.1) * scale})`, transformOrigin: "0 0" }}>
      {children}
    </div>
  );
}

export const card: React.CSSProperties = { background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px -18px rgba(0,0,0,.45), 0 0 0 1px rgba(0,0,0,.04)", fontFamily: FONT, color: C.ink };

/** Число, «досчитывающееся» до значения. */
export function useCount(target: number, from: number, dur: number) {
  const f = useCurrentFrame();
  return Math.round(interpolate(f, [from, from + dur], [0, target], { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
}
export const rub = (n: number) => n.toLocaleString("ru-RU").replace(/ /g, " ") + " ₽";
