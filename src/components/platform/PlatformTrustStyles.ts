import baseBlockStyles from "./PlatformBlocksBase.module.css";
/* The hub puts a product card on `aggregateRail`, so this bundle needs the rail's
   own recipe. Without it that one key resolved to the responsive overrides alone
   and the card fell through to `display: block` — the rail worked by accident,
   and only at the widths the overrides happened to cover. */
import offerBlockStyles from "./PlatformBlocksOffer.module.css";
import orientationBlockStyles from "./PlatformBlocksOrientation.module.css";
import componentStyles from "./PlatformComponents.module.css";
import responsiveStyles from "./PlatformResponsive.module.css";
import shellStyles from "./PlatformShell.module.css";
import trustBlockStyles from "./PlatformBlocksTrust.module.css";
import { mergeStyleModules } from "./mergeStyleModules";

const styles = mergeStyleModules([
  shellStyles,
  baseBlockStyles,
  offerBlockStyles,
  orientationBlockStyles,
  trustBlockStyles,
  componentStyles,
  responsiveStyles,
]);

export default styles;
