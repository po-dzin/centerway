import { LogoMark } from "@/components/brand/LogoMark";
import styles from "./PlatformShellStyles";

/**
 * The one waiting state for the personal platform.
 *
 * It is deliberately content-sized and shell-agnostic: the storefront,
 * learner shelf, course player and Builder keep their own header/footer and
 * route width while this node answers only "the current content is loading".
 * That prevents a second full-page layer from replacing the first one midway
 * through session + data restoration.
 */
export function PlatformLoadingState({
  label,
  title,
  detail,
}: {
  label?: string;
  title: string;
  detail?: string;
}) {
  return (
    <section
      className={styles.platformLoadingState}
      data-cw-material="matte"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={styles.platformLoadingSignal}>
        <LogoMark size={30} animate="wait" />
        <div className={styles.platformLoadingCopy}>
          {label ? <p className={styles.platformLoadingLabel}>{label}</p> : null}
          <p className={styles.platformLoadingTitle}>{title}</p>
          {detail ? <p className={styles.platformLoadingDetail}>{detail}</p> : null}
        </div>
      </div>
    </section>
  );
}
