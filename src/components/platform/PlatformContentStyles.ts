import shellStyles from "./PlatformShell.module.css";
import baseBlockStyles from "./PlatformBlocksBase.module.css";
import orientationBlockStyles from "./PlatformBlocksOrientation.module.css";
import offerBlockStyles from "./PlatformBlocksOffer.module.css";
import routeBlockStyles from "./PlatformBlocksRoute.module.css";
import trustBlockStyles from "./PlatformBlocksTrust.module.css";
import componentStyles from "./PlatformComponents.module.css";
import responsiveStyles from "./PlatformResponsive.module.css";

const modules = [
  shellStyles,
  baseBlockStyles,
  orientationBlockStyles,
  offerBlockStyles,
  routeBlockStyles,
  trustBlockStyles,
  componentStyles,
  responsiveStyles,
] as Array<Record<string, string>>;

const styles: Record<string, string> = {};

for (const moduleStyles of modules) {
  for (const [key, value] of Object.entries(moduleStyles)) {
    styles[key] = styles[key] ? `${styles[key]} ${value}` : value;
  }
}

export default styles;
