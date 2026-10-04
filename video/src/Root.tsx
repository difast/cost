import { Composition } from "remotion";
import { ProductOverview, TOTAL_FRAMES } from "./ProductOverview";

export const RemotionRoot = () => (
  <Composition id="ProductOverview" component={ProductOverview} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} />
);
