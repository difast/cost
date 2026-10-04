import { Composition } from "remotion";
import { Desktop } from "./Desktop";
import { Mobile } from "./Mobile";
import { TOTAL } from "./timeline";

export const RemotionRoot = () => (
  <>
    <Composition id="Desktop" component={Desktop} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
    <Composition id="Mobile" component={Mobile} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
  </>
);
