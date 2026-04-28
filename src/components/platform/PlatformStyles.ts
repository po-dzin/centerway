import shellStyles from "./PlatformShell.module.css";
import blockStyles from "./PlatformBlocks.module.css";
import componentStyles from "./PlatformComponents.module.css";
import responsiveStyles from "./PlatformResponsive.module.css";

const modules = [shellStyles, blockStyles, componentStyles, responsiveStyles] as Array<
  Record<string, string>
>;

const styles: Record<string, string> = {};

for (const moduleStyles of modules) {
  for (const [key, value] of Object.entries(moduleStyles)) {
    styles[key] = styles[key] ? `${styles[key]} ${value}` : value;
  }
}

export default styles;
