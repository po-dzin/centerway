import baseBlockStyles from "./PlatformBlocksBase.module.css";
import componentStyles from "./PlatformComponents.module.css";
import responsiveStyles from "./PlatformResponsive.module.css";
import routeBlockStyles from "./PlatformBlocksRoute.module.css";
import shellStyles from "./PlatformShell.module.css";
import { mergeStyleModules } from "./mergeStyleModules";

const styles = mergeStyleModules([
  shellStyles,
  baseBlockStyles,
  routeBlockStyles,
  componentStyles,
  responsiveStyles,
]);

export default styles;
