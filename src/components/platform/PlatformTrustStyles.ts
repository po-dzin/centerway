import baseBlockStyles from "./PlatformBlocksBase.module.css";
import orientationBlockStyles from "./PlatformBlocksOrientation.module.css";
import componentStyles from "./PlatformComponents.module.css";
import responsiveStyles from "./PlatformResponsive.module.css";
import shellStyles from "./PlatformShell.module.css";
import trustBlockStyles from "./PlatformBlocksTrust.module.css";
import { mergeStyleModules } from "./mergeStyleModules";

const styles = mergeStyleModules([
  shellStyles,
  baseBlockStyles,
  orientationBlockStyles,
  trustBlockStyles,
  componentStyles,
  responsiveStyles,
]);

export default styles;
