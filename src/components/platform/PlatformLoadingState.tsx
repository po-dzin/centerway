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
 *
 * EVERY WAIT IS THIS CARD (2026-10-03). The diagnostic stacked a chip, the
 * mark, a display heading and a lead down a whole panel, and the admin panel
 * centred the mark over its line in a column of padding — two more shapes for
 * the same sentence. G: «текст можно в одну линию с лого загрузки… ЕДИНУЮ
 * карточку загрузки ДЛЯ ВСЕХ вариантов». Both now render this node: the mark
 * and the words on one row, the card as tall as they are.
 */
export function PlatformLoadingState({
  label,
  title,
  detail,
  className,
}: {
  label?: string;
  title: string;
  detail?: string;
  /** Placement only (a panel's plate, a margin) — never a second look. */
  className?: string;
}) {
  return (
    <section
      className={className ? `${styles.platformLoadingState} ${className}` : styles.platformLoadingState}
      data-cw-material="matte"
      data-cw-edge="none"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={styles.platformLoadingSignal}>
        <LogoMark className="cw-wait-mark" size={30} animate="wait" tone="brand" />
        <div className={styles.platformLoadingCopy}>
          {label ? <p className={styles.platformLoadingLabel}>{label}</p> : null}
          <p className={styles.platformLoadingTitle}>{title}</p>
          {detail ? <p className={styles.platformLoadingDetail}>{detail}</p> : null}
        </div>
      </div>
    </section>
  );
}
