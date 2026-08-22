"use client";

/**
 * The offer to install the app, on the host that OWNS the app.
 *
 * It used to live in the cabinet, because that is where a buyer ended up. After
 * the split the cabinet is on `www`, whose root is the storefront — installing
 * from there would put the SHOP on someone's home screen, when what they tap
 * the icon for is the course. The shelf is on `my`, whose root is the shelf
 * itself, so the offer belongs there.
 *
 * `ownsInstall` is not a host name but a question — does this origin serve the
 * personal surfaces? — which keeps the card working on localhost and on preview
 * deployments, where one origin serves everything.
 */

import { usePwaInstall } from "../pwa/usePwaInstall";
import { useOwnsPersonalSurfaces } from "../layout/SurfaceHost";
import { matte } from "./CourseCard";
import type { getCabinetCopy } from "./copy";
import styles from "./Cabinet.module.css";

export function PwaInstallCard({ copy }: { copy: ReturnType<typeof getCabinetCopy> }) {
  const install = usePwaInstall();
  const ownsInstall = useOwnsPersonalSurfaces();

  /* Only ever one of the two branches, and neither renders once the app is
     already running installed: Chrome parks a real prompt, Safari never fires
     one and has to be told the two taps instead. */
  if (!ownsInstall) return null;
  if (!install.canPrompt && !install.needsIosInstructions) return null;

  return (
    <article className={styles.card} {...matte}>
      <h3 className={styles.cardTitle}>{copy.installTitle}</h3>
      <p className={styles.cardText}>{copy.installLead}</p>
      {install.canPrompt ? (
        <div className={styles.actions}>
          <button className={styles.actionPrimary} type="button" onClick={() => void install.install()}>
            {copy.installAction}
          </button>
        </div>
      ) : (
        <>
          <p className={styles.cardText}>{copy.installIosLead}</p>
          <ul className={styles.metaList}>
            {copy.installIosSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
