// Сцены ролика. Экранные сцены — реальные кадры интерфейса (демо-оценка);
// сцена «Адрес и карта» — анимированная иллюстрация в стиле интерфейса.

import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, EASE_OUT, FONT, Mark, appear, card, clamp01, kf } from "./kit";

/* ───────────────────────── Вступление и финал ───────────────────────── */

export function Intro({ scale = 1 }: { scale?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 110, mass: 0.9 } });
  const w = spring({ frame: f - 14, fps, config: { damping: 200 } });
  const t = spring({ frame: f - 26, fps, config: { damping: 200 } });
  const line = interpolate(f, [30, 70], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, color: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 34 * scale }}>
        <div style={{ transform: `scale(${0.6 + m * 0.4}) rotate(${(1 - m) * -8}deg)`, opacity: clamp01(m * 1.5) }}>
          <Mark size={150 * scale} />
        </div>
        <div style={{ fontSize: 150 * scale, fontWeight: 800, letterSpacing: "-0.035em", opacity: w, transform: `translateX(${(1 - w) * -30}px)` }}>ЭВМО</div>
      </div>
      <div style={{ marginTop: 40 * scale, height: 3, width: 520 * scale * line, background: `linear-gradient(90deg, transparent, ${C.brandLight}, transparent)` }} />
      <div style={{ marginTop: 34 * scale, fontSize: 42 * scale, fontWeight: 500, color: "rgba(255,255,255,.86)", opacity: t, transform: `translateY(${(1 - t) * 20}px)`, textAlign: "center", padding: "0 60px" }}>
        Рабочая система для оценки недвижимости
      </div>
    </AbsoluteFill>
  );
}

export function Outro({ scale = 1 }: { scale?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: f - 4, fps, config: { damping: 200 } });
  const b = spring({ frame: f - 16, fps, config: { damping: 200 } });
  const c = spring({ frame: f - 28, fps, config: { damping: 13, stiffness: 120 } });
  const glow = 0.5 + Math.sin(f / 12) * 0.5;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, color: "#fff", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26 * scale, opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
        <Mark size={110 * scale} />
        <span style={{ fontSize: 110 * scale, fontWeight: 800, letterSpacing: "-0.035em" }}>ЭВМО</span>
      </div>
      <div style={{ marginTop: 30 * scale, fontSize: 40 * scale, color: "rgba(255,255,255,.85)", opacity: b, transform: `translateY(${(1 - b) * 20}px)`, padding: "0 60px" }}>
        От адреса до готового отчёта — в одной системе
      </div>
      <div style={{ marginTop: 56 * scale, opacity: clamp01(c * 1.3), transform: `scale(${0.85 + c * 0.15})` }}>
        <span style={{ display: "inline-block", fontSize: 38 * scale, fontWeight: 700, background: C.brand, padding: `${22 * scale}px ${54 * scale}px`, borderRadius: 16 * scale, boxShadow: `0 0 ${40 + glow * 40}px ${C.brand}aa` }}>
          Создать аккаунт на evmo.ru
        </span>
      </div>
    </AbsoluteFill>
  );
}

/* ───────────────────────── Адрес → подсказки → карта ───────────────────────── */

const TYPED = "Москва, Профсоюзная 104";
const FULL = "г. Москва, ул. Профсоюзная, д. 104";
const INFRA: Array<{ g: string; name: string; d: string; x: number; y: number; at: number }> = [
  { g: "М", name: "Метро", d: "650 м", x: 0.24, y: 0.3, at: 150 },
  { g: "Ш", name: "Школа", d: "320 м", x: 0.7, y: 0.26, at: 158 },
  { g: "А", name: "Аптека", d: "140 м", x: 0.62, y: 0.66, at: 166 },
  { g: "П", name: "Поликлиника", d: "900 м", x: 0.22, y: 0.72, at: 174 },
  { g: "Т", name: "Магазин", d: "210 м", x: 0.8, y: 0.5, at: 182 },
];

/** layout: позиции и размеры карточек (горизонтальный или вертикальный кадр). */
export function AddressScene({ input, map, s = 1 }: { input: { x: number; y: number; w: number }; map: { x: number; y: number; w: number; h: number }; s?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inApp = spring({ frame: f - 12, fps, config: { damping: 200 } });
  const chars = Math.floor(interpolate(f, [28, 82], [0, TYPED.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const picked = f >= 118;
  const text = picked ? FULL : TYPED.slice(0, chars);
  const caret = !picked && Math.floor(f / 8) % 2 === 0;
  const drop = picked ? 0 : appear(f, 88, 14);
  const hover = f >= 104;
  const parsed = (i: number) => appear(f, 124 + i * 6, 16);
  const mapIn = spring({ frame: f - 100, fps, config: { damping: 200 } });
  const pin = spring({ frame: f - 132, fps, config: { damping: 9, stiffness: 140, mass: 0.7 } });
  const ring = interpolate(f, [142, 190], [0, 1], { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = (f - 142) % 46 / 46;
  const fs = (n: number) => n * s;

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {/* поле адреса */}
      <div style={{ position: "absolute", left: input.x, top: input.y, width: input.w, opacity: inApp, transform: `translateY(${(1 - inApp) * 30}px)` }}>
        <div style={{ ...card, padding: fs(30) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: fs(19), color: C.muted, fontWeight: 600 }}>
            <span>Адрес объекта</span>
            {picked && <span style={{ fontSize: fs(15), background: C.brandSoft, color: C.brand, padding: `${fs(3)}px ${fs(10)}px`, borderRadius: 6, opacity: appear(f, 118, 10) }}>ГАР</span>}
          </div>
          <div style={{ marginTop: fs(12), height: fs(66), border: `2px solid ${picked || chars > 0 ? C.brand : C.line}`, borderRadius: fs(12), display: "flex", alignItems: "center", padding: `0 ${fs(20)}px`, fontSize: fs(26), color: C.ink, boxShadow: chars > 0 ? `0 0 0 ${fs(5)}px ${C.brandSoft}` : "none" }}>
            {text}
            {caret && <span style={{ width: 2, height: fs(30), background: C.ink, marginLeft: 2 }} />}
          </div>
          {/* разобранный адрес */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: `${fs(10)}px ${fs(24)}px`, marginTop: picked ? fs(22) : 0, maxHeight: picked ? fs(200) : 0, overflow: "hidden" }}>
            {[["Регион", "Москва"], ["Улица", "Профсоюзная"], ["Дом", "104"], ["Координаты", "определены ✓"]].map(([k, v], i) => (
              <div key={k} style={{ opacity: parsed(i), transform: `translateY(${(1 - parsed(i)) * 10}px)` }}>
                <div style={{ fontSize: fs(15), color: C.muted }}>{k}</div>
                <div style={{ fontSize: fs(21), fontWeight: 600, color: k === "Координаты" ? C.brand : C.ink }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        {/* подсказки */}
        {drop > 0 && (
          <div style={{ ...card, marginTop: fs(10), padding: `${fs(8)}px 0`, opacity: drop, transform: `translateY(${(1 - drop) * -10}px)` }}>
            {[FULL, "г. Москва, ул. Профсоюзная, д. 104, корп. 2"].map((t, i) => (
              <div key={t} style={{ padding: `${fs(14)}px ${fs(24)}px`, fontSize: fs(22), background: i === 0 && hover ? C.brandSoft : "transparent", color: C.ink }}>{t}</div>
            ))}
            <div style={{ borderTop: `1px solid ${C.line}`, margin: `${fs(4)}px 0 0`, padding: `${fs(10)}px ${fs(24)}px ${fs(4)}px`, fontSize: fs(15), color: C.muted }}>Государственный адресный реестр (ГАР)</div>
          </div>
        )}
      </div>

      {/* карта */}
      <div style={{ position: "absolute", left: map.x, top: map.y, width: map.w, height: map.h, ...card, overflow: "hidden", opacity: mapIn, transform: `translateX(${(1 - mapIn) * 60 * s}px)` }}>
        <svg width={map.w} height={map.h} viewBox={`0 0 ${map.w} ${map.h}`} style={{ position: "absolute", inset: 0 }}>
          <rect width={map.w} height={map.h} fill="#eef2ef" />
          <path d={`M${-20} ${map.h * 0.78} C ${map.w * 0.3} ${map.h * 0.62}, ${map.w * 0.55} ${map.h * 0.95}, ${map.w + 20} ${map.h * 0.8}`} stroke="#cfe2ee" strokeWidth={34 * s} fill="none" />
          <ellipse cx={map.w * 0.83} cy={map.h * 0.2} rx={map.w * 0.14} ry={map.h * 0.1} fill="#dbeadf" />
          <ellipse cx={map.w * 0.12} cy={map.h * 0.5} rx={map.w * 0.09} ry={map.h * 0.12} fill="#dbeadf" />
          {[0.18, 0.42, 0.66, 0.88].map((p, i) => <line key={`v${i}`} x1={map.w * p} y1={0} x2={map.w * (p - 0.06)} y2={map.h} stroke="#fff" strokeWidth={(i === 1 ? 22 : 12) * s} />)}
          {[0.15, 0.4, 0.58].map((p, i) => <line key={`h${i}`} x1={0} y1={map.h * p} x2={map.w} y2={map.h * (p + 0.05)} stroke="#fff" strokeWidth={(i === 1 ? 20 : 11) * s} />)}
        </svg>
        {/* радиус */}
        <div style={{ position: "absolute", left: map.w * 0.48, top: map.h * 0.47, width: 0, height: 0 }}>
          <div style={{ position: "absolute", width: map.w * 0.62 * ring, height: map.w * 0.62 * ring, left: (-map.w * 0.62 * ring) / 2, top: (-map.w * 0.62 * ring) / 2, borderRadius: "50%", background: `${C.brand}14`, border: `2px dashed ${C.brand}66` }} />
          {f > 142 && <div style={{ position: "absolute", width: 120 * s * (0.3 + pulse), height: 120 * s * (0.3 + pulse), left: (-120 * s * (0.3 + pulse)) / 2, top: (-120 * s * (0.3 + pulse)) / 2, borderRadius: "50%", border: `3px solid ${C.brand}`, opacity: 1 - pulse }} />}
        </div>
        {/* инфраструктура */}
        {INFRA.map((o) => {
          const p = spring({ frame: f - o.at, fps, config: { damping: 12, stiffness: 160 } });
          if (f < o.at) return null;
          return (
            <div key={o.g} style={{ position: "absolute", left: map.w * o.x, top: map.h * o.y, transform: `translate(-50%, -50%) scale(${p})`, display: "flex", alignItems: "center", gap: 8 * s }}>
              <span style={{ width: 40 * s, height: 40 * s, borderRadius: "50%", background: "#3f4a45", color: "#fff", fontSize: 19 * s, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px #fff" }}>{o.g}</span>
              <span style={{ background: "#fff", borderRadius: 8, padding: `${4 * s}px ${10 * s}px`, fontSize: 17 * s, color: C.ink, boxShadow: "0 4px 14px rgba(0,0,0,.12)", whiteSpace: "nowrap" }}>{o.name} · {o.d}</span>
            </div>
          );
        })}
        {/* метка объекта */}
        {f >= 130 && (
          <div style={{ position: "absolute", left: map.w * 0.48, top: map.h * 0.47, transform: `translate(-50%, -100%) translateY(${(1 - pin) * -120 * s}px)` }}>
            <svg width={54 * s} height={70 * s} viewBox="0 0 54 70"><path d="M27 2C13 2 3 12.6 3 26c0 17 24 42 24 42s24-25 24-42C51 12.6 41 2 27 2z" fill={C.brand} stroke="#fff" strokeWidth="3" /><circle cx="27" cy="26" r="9" fill="#fff" /></svg>
          </div>
        )}
        <div style={{ position: "absolute", left: 20 * s, top: 18 * s, background: "#fff", borderRadius: 10, padding: `${8 * s}px ${14 * s}px`, fontSize: 18 * s, fontWeight: 600, color: C.ink, boxShadow: "0 4px 14px rgba(0,0,0,.1)", opacity: appear(f, 140) }}>
          Объект оценки · инфраструктура в радиусе 1 км
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ───────────────────────── Плашки поверх экранов ───────────────────────── */

export function ValueCard({ s = 1, from }: { s?: number; from: number }) {
  const f = useCurrentFrame();
  const v = Math.round(interpolate(f, [from, from + 45], [0, 9584000], { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" }) / 1000) * 1000;
  return (
    <div style={{ ...card, padding: `${22 * s}px ${30 * s}px`, minWidth: 420 * s }}>
      <div style={{ fontSize: 17 * s, color: C.muted, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>Итоговая стоимость</div>
      <div style={{ fontSize: 54 * s, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 4 * s, fontVariantNumeric: "tabular-nums" }}>{v.toLocaleString("ru-RU").replace(/ /g, " ")} ₽</div>
      <div style={{ fontSize: 18 * s, color: C.brand, marginTop: 6 * s, fontWeight: 600 }}>Тот же результат в интерфейсе, DOCX, PDF и XLSX</div>
    </div>
  );
}

export function SignCard({ s = 1 }: { s?: number }) {
  const rows: Array<[string, string, string]> = [["Аналог лучше объекта", "−", C.err], ["Равны", "0", C.muted], ["Аналог хуже объекта", "+", C.brand]];
  return (
    <div style={{ ...card, padding: `${20 * s}px ${26 * s}px`, width: 400 * s }}>
      <div style={{ fontSize: 17 * s, color: C.muted, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 10 * s }}>Правило знака</div>
      {rows.map(([t, sign, col]) => (
        <div key={t} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22 * s, padding: `${6 * s}px 0` }}>
          <span>{t}</span>
          <span style={{ width: 40 * s, height: 40 * s, borderRadius: 10, background: `${col}18`, color: col, fontWeight: 800, fontSize: 26 * s, display: "flex", alignItems: "center", justifyContent: "center" }}>{sign}</span>
        </div>
      ))}
    </div>
  );
}

export function QualityCard({ s = 1, from }: { s?: number; from: number }) {
  const f = useCurrentFrame();
  const items: Array<[string, number, string]> = [["Ошибки", 1, C.err], ["Предупреждения", 10, C.warn], ["Информация", 3, C.muted]];
  return (
    <div style={{ ...card, padding: `${20 * s}px ${26 * s}px`, display: "flex", gap: 30 * s }}>
      {items.map(([t, n, col], i) => {
        const v = Math.round(interpolate(f, [from + i * 6, from + i * 6 + 30], [0, n], { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
        return (
          <div key={t}>
            <div style={{ fontSize: 16 * s, color: C.muted }}>{t}</div>
            <div style={{ fontSize: 48 * s, fontWeight: 800, color: col, fontVariantNumeric: "tabular-nums" }}>{v}</div>
          </div>
        );
      })}
      <div style={{ alignSelf: "center", fontSize: 18 * s, color: C.ink, maxWidth: 200 * s, lineHeight: 1.3 }}>Отчёт <b>не блокируется</b> — замечания видны и ведут к полю</div>
    </div>
  );
}

export function FileBadge({ ext, color, s = 1 }: { ext: string; color: string; s?: number }) {
  return (
    <div style={{ ...card, width: 150 * s, padding: `${18 * s}px 0`, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * s }}>
      <svg width={60 * s} height={74 * s} viewBox="0 0 60 74">
        <path d="M4 4h36l16 16v50H4z" fill="#f6f8f7" stroke="#cfd6d2" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M40 4v16h16" fill="none" stroke="#cfd6d2" strokeWidth="2.5" />
        <rect x="0" y="38" width="46" height="22" rx="5" fill={color} />
        <text x="23" y="54" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="Arial">{ext}</text>
      </svg>
      <span style={{ fontSize: 20 * s, fontWeight: 700 }}>{ext}</span>
    </div>
  );
}

/* ───────────────────────── Телефон для вертикальной версии ───────────────────────── */

/** Телефон с длинным кадром мобильного интерфейса: прокрутка по ключевым кадрам, касания. */
export function Phone({ src, scroll, taps = [], left, top, width, children }: { src: string; scroll: Array<[number, number]>; taps?: Array<[number, number, number]>; left: number; top: number; width: number; children?: React.ReactNode }) {
  const f = useCurrentFrame();
  const k = width / 390;
  const h = 844 * k;
  const y = kf(f, scroll);
  const bez = 18;
  return (
    <div style={{ position: "absolute", left, top, width: width + bez * 2, height: h + bez * 2, borderRadius: 88, background: "#0b0d0c", padding: bez, boxShadow: "0 50px 120px -30px rgba(0,0,0,.8), 0 0 0 2px #2b302e" }}>
      <div style={{ position: "relative", width, height: h, borderRadius: 72, overflow: "hidden", background: "#f6f7f6" }}>
        <Img src={src} style={{ position: "absolute", left: 0, top: -y * k, width }} />
        {taps.map(([fr, x, ty]) => {
          const t = interpolate(f, [fr, fr + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (f < fr - 8 || t >= 1) return null;
          const pre = interpolate(f, [fr - 8, fr], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <React.Fragment key={fr}>
              <div style={{ position: "absolute", left: x * k - 34, top: ty * k - 34, width: 68, height: 68, borderRadius: "50%", background: `${C.brand}55`, opacity: f < fr ? pre : 1 - t, transform: `scale(${f < fr ? 0.6 + pre * 0.4 : 1 - t * 0.2})` }} />
              {f >= fr && <div style={{ position: "absolute", left: x * k - 50, top: ty * k - 50, width: 100, height: 100, borderRadius: "50%", border: `4px solid ${C.brand}`, opacity: 1 - t, transform: `scale(${0.5 + t * 0.8})` }} />}
            </React.Fragment>
          );
        })}
        <div style={{ position: "absolute", left: "50%", top: 14, width: 130, height: 36, marginLeft: -65, borderRadius: 20, background: "#0b0d0c" }} />
        {children}
      </div>
    </div>
  );
}
