import shellStyles from "./PlatformShell.module.css";
import blockStyles from "./PlatformBlocks.module.css";
import componentStyles from "./PlatformComponents.module.css";
import responsiveStyles from "./PlatformResponsive.module.css";
import { mergeStyleModules } from "./mergeStyleModules";

const styles = mergeStyleModules([shellStyles, blockStyles, componentStyles, responsiveStyles]);

export default styles;
