/* Split out of DoshaTestClient on 2026-09-13. Owns the loading phase inside
   the flow panel: the step chip and the waiting mark while the server
   classifies the answers. */

import { LogoMark } from "@/components/brand/LogoMark";
import styles from "@/components/platform/PlatformDiagnosticStyles";

type DoshaLoadingStepProps = {
  topbarBadge: string;
};

export function DoshaLoadingStep({ topbarBadge }: DoshaLoadingStepProps) {
  return (
    <div className={styles.diagnosticFlowStack}>
      <div className={styles.diagnosticFlowHead}>
        <span className={styles.diagnosticStepChip}>{topbarBadge}</span>
      </div>

      <div className={styles.diagnosticLoadingStack}>
        {/* THE MARK WAITS, NOT A RING (2026-09-06). `LogoMark`'s
            `wait` — turns gaining density in turn — has been «the
            spinner replacement» in its own source since it was
            written; this screen and the admin panel were the two
            places still drawing a rotating circle, which is a
            borrowed glyph that says «something is happening» without
            saying what, next to a heading that says exactly what. */}
        <LogoMark className="cw-wait-mark" size={36} animate="wait" tone="brand" aria-hidden="true" />
        <h2 className={styles.title}>Аналізуємо ваш профіль...</h2>
        <p className={styles.lead}>Формуємо практичний вектор і наступний крок у платформі.</p>
      </div>
    </div>
  );
}
