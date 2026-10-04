// Заготовка видео-обзора для первого экрана лендинга.
// Сцены — реальные экраны сервиса на демонстрационной оценке.
// Финальный ролик заменит этот черновик; структура сцен остаётся точкой отсчёта.

import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const BRAND = "#1f45a8";
const INK = "#0f172a";
const FONT = "Inter, 'Segoe UI', Roboto, 'DejaVu Sans', Arial, sans-serif";

const INTRO = 90;
const SCENE = 120;
const OUTRO = 105;

const SCENES = [
  { img: "ui-list.jpg", step: "01", title: "Создайте оценку", text: "По адресу или кадастровому номеру квартиры" },
  { img: "ui-property.jpg", step: "02", title: "Данные объекта", text: "XML-выписка ЕГРН заполняет карточку объекта" },
  { img: "ui-comparables.jpg", step: "03", title: "Аналоги", text: "Ссылка, дата получения и скриншот у каждого аналога" },
  { img: "ui-adjustments.jpg", step: "04", title: "Корректировки", text: "По выбранной редакции справочника — с обоснованием изменений" },
  { img: "ui-calculation.jpg", step: "05", title: "Расчёт", text: "Цепочка от цены предложения до итоговой стоимости" },
  { img: "ui-checks.jpg", step: "06", title: "Проверки", text: "Несоответствия видны до формирования отчёта" },
  { img: "ui-report.jpg", step: "07", title: "Отчёт", text: "DOCX и PDF из данных этой же оценки" },
];

export const TOTAL_FRAMES = INTRO + SCENES.length * SCENE + OUTRO;

const Logo = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 512 512">
    <rect width="512" height="512" rx="96" fill="#fff" />
    <path d="M128 300 256 168l128 132v108H292v-80h-72v80h-92z" fill={BRAND} />
  </svg>
);

const Intro = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 200 } });
  const out = interpolate(f, [INTRO - 15, INTRO], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: BRAND, justifyContent: "center", padding: "0 180px", opacity: out }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, color: "#fff", fontSize: 40, fontWeight: 700, opacity: s }}>
        <Logo /> Оценка.Про
      </div>
      <div style={{ marginTop: 48, color: "#fff", fontSize: 88, fontWeight: 700, lineHeight: 1.1, maxWidth: 1300, transform: `translateY(${(1 - s) * 30}px)`, opacity: s }}>
        Оценка недвижимости — в одном рабочем месте
      </div>
    </AbsoluteFill>
  );
};

const Scene = ({ img, step, title, text }: (typeof SCENES)[number]) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 200 } });
  const fade = interpolate(f, [0, 10, SCENE - 10, SCENE], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(f, [0, SCENE], [1.02, 1.1]);
  return (
    <AbsoluteFill style={{ background: "#f4f6f9", fontFamily: FONT, opacity: fade }}>
      <Img src={staticFile(img)} style={{ position: "absolute", width: 1920, top: -40, left: 0, transform: `scale(${zoom})`, transformOrigin: "35% 25%" }} />
      <div
        style={{
          position: "absolute", left: 64, bottom: 64, maxWidth: 1000, padding: "30px 40px", borderRadius: 18,
          background: "#0f172a", color: "#fff", display: "flex", gap: 28, alignItems: "center",
          transform: `translateY(${(1 - enter) * 30}px)`, opacity: enter,
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, color: "#93b4ff", fontFamily: "monospace" }}>{step}</div>
        <div>
          <div style={{ fontSize: 50, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
          <div style={{ marginTop: 10, fontSize: 30, lineHeight: 1.35, color: "#cbd5e1" }}>{text}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Outro = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: BRAND, justifyContent: "center", alignItems: "center", fontFamily: FONT, color: "#fff", textAlign: "center" }}>
      <div style={{ opacity: s, transform: `scale(${0.96 + s * 0.04})` }}>
        <div style={{ display: "flex", justifyContent: "center" }}><Logo size={84} /></div>
        <div style={{ marginTop: 36, fontSize: 72, fontWeight: 700 }}>От адреса до готового отчёта</div>
        <div style={{ marginTop: 24, fontSize: 34, opacity: 0.85 }}>Рабочее место оценщика недвижимости</div>
      </div>
    </AbsoluteFill>
  );
};

export const ProductOverview = () => (
  <AbsoluteFill style={{ fontFamily: FONT }}>
    <Sequence durationInFrames={INTRO}><Intro /></Sequence>
    {SCENES.map((s, i) => (
      <Sequence key={s.step} from={INTRO + i * SCENE} durationInFrames={SCENE}><Scene {...s} /></Sequence>
    ))}
    <Sequence from={INTRO + SCENES.length * SCENE} durationInFrames={OUTRO}><Outro /></Sequence>
  </AbsoluteFill>
);
