import baseBlockStyles from "./PlatformBlocksBase.module.css";
import componentStyles from "./PlatformComponents.module.css";
import orientationBlockStyles from "./PlatformBlocksOrientation.module.css";
import responsiveStyles from "./PlatformResponsive.module.css";
import shellStyles from "./PlatformShell.module.css";
import trustBlockStyles from "./PlatformBlocksTrust.module.css";
import { mergeStyleModules } from "./mergeStyleModules";

// Diagnostic surfaces need the hero layer (orientation) and the trust card/boundary
// recipes in one object: the intro lives in a hero, the flow lives in cards.
const styles = mergeStyleModules([
  shellStyles,
  baseBlockStyles,
  orientationBlockStyles,
  trustBlockStyles,
  componentStyles,
  responsiveStyles,
]);

export default styles;
