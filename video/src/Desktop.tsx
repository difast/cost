// Горизонтальная версия 1920×1080 — для лендинга на компьютере.

import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import boxesJson from "../public/shots/boxes.json";
import { Background, BrowserShot, Caption, Cursor, DemoBadge, Floating, Fonts, Highlight, SceneFade } from "./kit";
import { AddressScene, FileBadge, Intro, Outro, QualityCard, SignCard, ValueCard } from "./scenes";
import { CAPTIONS, SCENES, TOTAL } from "./timeline";

const B = boxesJson.boxes;
const WIN = { left: 520, top: 146, width: 1340, height: 789 };
const CAP = { x: 70, y: 170, width: 420, vertical: true } as const;

function Shot({ k, children }: { k: keyof typeof CAPTIONS; children: React.ReactNode }) {
  return (
    <>
      <Caption {...CAPTIONS[k]} {...CAP} />
      {children}
    </>
  );
}

const scenes: Record<string, () => React.ReactNode> = {
  intro: () => <Intro />,
  address: () => (
    <>
      <Caption {...CAPTIONS.address} x={110} y={150} width={720} />
      <AddressScene input={{ x: 110, y: 400, w: 720 }} map={{ x: 920, y: 130, w: 900, h: 820 }} />
    </>
  ),
  comps: () => (
    <Shot k="comps">
      <BrowserShot
        {...WIN} src="shots/comp_list.jpg" crossTo="shots/comp_card.jpg" crossAt={156}
        cam={[{ f: 0, s: 1, x: 800, y: 450 }, { f: 40, s: 1.55, x: 520, y: 600 }, { f: 95, s: 1.55, x: 520, y: 600 }, { f: 130, s: 1.5, x: 700, y: 780 }, { f: 160, s: 1.5, x: 700, y: 780 }, { f: 180, s: 1.35, x: 700, y: 640 }, { f: 230, s: 1.42, x: 700, y: 660 }]}
      >
        {(s) => (
          <>
            <Highlight box={B.comp_search} from={55} to={100} camScale={s} />
            <Highlight box={B.comp_first} from={118} to={152} camScale={s} />
            <Highlight box={{ x: 285, y: 490, w: 820, h: 390 }} from={180} camScale={s} dim={false} />
            <Cursor path={[[30, 900, 520], [70, 362, 676], [110, 362, 676], [140, 520, 848], [158, 520, 848]]} clicks={[76, 148]} camScale={s} until={160} />
          </>
        )}
      </BrowserShot>
    </Shot>
  ),
  adj: () => (
    <Shot k="adj">
      <BrowserShot {...WIN} src="shots/adj.jpg" cam={[{ f: 0, s: 1, x: 800, y: 450 }, { f: 40, s: 1.5, x: 800, y: 720 }, { f: 180, s: 1.58, x: 820, y: 740 }]}>
        {(s) => <Highlight box={B.adj_row2} from={50} camScale={s} />}
      </BrowserShot>
      <Floating x={70} y={600} delay={70}><SignCard s={0.95} /></Floating>
    </Shot>
  ),
  calc: () => (
    <Shot k="calc">
      <BrowserShot {...WIN} src="shots/calc.jpg" cam={[{ f: 0, s: 1, x: 800, y: 450 }, { f: 38, s: 1.6, x: 520, y: 440 }, { f: 180, s: 1.68, x: 520, y: 450 }]}>
        {(s) => <Highlight box={{ x: 285, y: 385, w: 530, h: 120 }} from={48} camScale={s} />}
      </BrowserShot>
      <Floating x={60} y={560} delay={58} scale={0.9}><ValueCard from={62} /></Floating>
    </Shot>
  ),
  quality: () => (
    <Shot k="quality">
      <BrowserShot
        {...WIN} src="shots/checks.jpg" crossTo="shots/goto.jpg" crossAt={150}
        cam={[{ f: 0, s: 1, x: 800, y: 450 }, { f: 32, s: 1.35, x: 920, y: 360 }, { f: 75, s: 1.35, x: 920, y: 360 }, { f: 105, s: 1.5, x: 1100, y: 490 }, { f: 152, s: 1.5, x: 1100, y: 490 }, { f: 178, s: 1.4, x: 920, y: 460 }, { f: 230, s: 1.46, x: 920, y: 455 }]}
      >
        {(s) => (
          <>
            <Highlight box={{ x: 276, y: 294, w: 1291, h: 92 }} from={36} to={80} camScale={s} />
            <Highlight box={B.q_first} from={106} to={150} camScale={s} />
            <Highlight box={B.goto_field} from={175} camScale={s} dim={false} />
            <Cursor path={[[95, 1250, 700], [128, 1445, 494], [152, 1445, 494]]} clicks={[140]} camScale={s} until={158} />
          </>
        )}
      </BrowserShot>
      <Floating x={60} y={620} delay={45} scale={0.6}><QualityCard from={50} /></Floating>
    </Shot>
  ),
  report: () => (
    <Shot k="report">
      <BrowserShot {...WIN} src="shots/report.jpg" cam={[{ f: 0, s: 1, x: 800, y: 450 }, { f: 40, s: 1.45, x: 860, y: 600 }, { f: 110, s: 1.45, x: 860, y: 650 }, { f: 150, s: 1.02, x: 800, y: 450 }, { f: 200, s: 1, x: 800, y: 450 }]}>
        {(s) => <Highlight box={{ x: 285, y: 324, w: 202, h: 104 }} from={150} camScale={s} />}
      </BrowserShot>
      {[["DOCX", "#2b579a"], ["PDF", "#c2410c"], ["XLSX", "#1d6f42"]].map(([e, c], i) => (
        <Floating key={e} x={70 + i * 136} y={610} delay={118 + i * 9} scale={0.82}><FileBadge ext={e} color={c} /></Floating>
      ))}
    </Shot>
  ),
  outro: () => <Outro />,
};

export function Desktop() {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Fonts />
      <Background />
      {SCENES.map(({ key, from, dur }) => (
        <Sequence key={key} from={from} durationInFrames={dur} name={key}>
          <SceneFade dur={dur}>{scenes[key]()}</SceneFade>
        </Sequence>
      ))}
      <Sequence from={80} durationInFrames={SCENES[SCENES.length - 1].from + 10 - 80}><DemoBadge /></Sequence>
      <Audio src={staticFile("music.mp3")} volume={(f) => interpolate(f, [0, fps * 1.2, TOTAL - fps * 2.5, TOTAL], [0, 0.9, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    </AbsoluteFill>
  );
}
