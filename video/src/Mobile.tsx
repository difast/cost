// Вертикальная версия 1080×1920 — для телефона (лендинг на мобильном, соцсети).

import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { Background, Caption, DemoBadge, Floating, Fonts, SceneFade } from "./kit";
import { AddressScene, FileBadge, Intro, Outro, Phone, QualityCard, SignCard, ValueCard } from "./scenes";
import { CAPTIONS, SCENES, TOTAL } from "./timeline";

const PHONE = { left: 182, top: 372, width: 680 };
const CAP = { x: 80, y: 120, width: 920, scale: 1.12 } as const;
const shot = (n: string) => staticFile(`shots/m_${n}.jpg`);

const scenes: Record<string, () => React.ReactNode> = {
  intro: () => <Intro scale={1.0} />,
  address: () => (
    <>
      <Caption {...CAPTIONS.address} {...CAP} />
      <AddressScene input={{ x: 80, y: 400, w: 920 }} map={{ x: 80, y: 1020, w: 920, h: 800 }} s={1.2} />
    </>
  ),
  comps: () => (
    <>
      <Caption {...CAPTIONS.comps} {...CAP} />
      <Phone {...PHONE} src={shot("comparables")} scroll={[[0, 0], [45, 0], [95, 1250], [135, 1250], [180, 1556], [230, 1556]]} taps={[[118, 100, 1695]]} />
    </>
  ),
  adj: () => (
    <>
      <Caption {...CAPTIONS.adj} {...CAP} />
      <Phone {...PHONE} src={shot("adjustments")} scroll={[[0, 0], [40, 0], [95, 640], [120, 640], [175, 1150]]} />
      <Floating x={300} y={1470} delay={80} scale={1.15}><SignCard /></Floating>
    </>
  ),
  calc: () => (
    <>
      <Caption {...CAPTIONS.calc} {...CAP} />
      <Phone {...PHONE} src={shot("calculation")} scroll={[[0, 0], [40, 0], [95, 560], [180, 600]]} />
      <Floating x={150} y={1500} delay={70} scale={1.2}><ValueCard from={74} /></Floating>
    </>
  ),
  quality: () => (
    <>
      <Caption {...CAPTIONS.quality} {...CAP} />
      <Phone {...PHONE} src={shot("checks")} scroll={[[0, 0], [40, 0], [95, 470], [150, 470], [205, 1000]]} taps={[[188, 120, 1230]]} />
      <Floating x={110} y={1540} delay={60} scale={1.05}><QualityCard from={64} /></Floating>
    </>
  ),
  report: () => (
    <>
      <Caption {...CAPTIONS.report} {...CAP} />
      <Phone {...PHONE} src={shot("report")} scroll={[[0, 0], [200, 40]]} taps={[[70, 70, 448]]} />
      {[["DOCX", "#2b579a"], ["PDF", "#c2410c"], ["XLSX", "#1d6f42"]].map(([e, c], i) => (
        <Floating key={e} x={250 + i * 200} y={1560} delay={100 + i * 9} scale={1.15}><FileBadge ext={e} color={c} /></Floating>
      ))}
    </>
  ),
  outro: () => <Outro scale={0.95} />,
};

export function Mobile() {
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
      <Sequence from={80} durationInFrames={SCENES[SCENES.length - 1].from + 10 - 80}><DemoBadge x={60} y={50} scale={1.3} /></Sequence>
      <Audio src={staticFile("music.mp3")} volume={(f) => interpolate(f, [0, fps * 1.2, TOTAL - fps * 2.5, TOTAL], [0, 0.9, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    </AbsoluteFill>
  );
}
