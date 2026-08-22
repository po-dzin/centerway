"use client";

/**
 * The offer to install the app — a line, not a panel, and mostly in the footer.
 *
 * WHERE IT LIVES. Installing is a once-per-device act, and it had a full card
 * on the shelf and another in the profile: two panels competing with the
 * courses for the top of the page, for something almost every reader does zero
 * or one times ever. It moved to where standing offers belong — the footer,
 * present on every page of the platform and of learning — and the profile keeps
 * one row of it, because "is this installed" is a fact about this account's
 * device and the account page is where facts about it are listed.
 *
 * WHICH HOST. `ownsInstall` is not a host name but a question — does this origin
 * serve the personal surfaces? On `www` the root is the storefront, and an
 * install from there would put the SHOP on someone's home screen when what they
 * tap the icon for is the course. Asking the question rather than naming the
 * host keeps it working on localhost and on previews, where one origin serves
 * everything.
 *
 * TWO BRANCHES, NEVER BOTH, and neither renders once the app is already running
 * installed: Chrome parks a real prompt, Safari never fires one and has to be
 * told the two taps instead.
 */

import { usePwaInstall } from "../pwa/usePwaInstall";
import { useOwnsPersonalSurfaces } from "../layout/SurfaceHost";
import type { getCabinetCopy } from "./copy";
import styles from "./Cabinet.module.css";

/**
 * The profile's row. One line in the account section: what it is, and the
 * control — or, on iOS, the two steps behind a disclosure, since there is no
 * control to give.
 */
export function PwaInstallRow({ copy }: { copy: ReturnType<typeof getCabinetCopy> }) {
  const install = usePwaInstall();
  const ownsInstall = useOwnsPersonalSurfaces();

  if (!ownsInstall) return null;
  if (!install.canPrompt && !install.needsIosInstructions) return null;

  if (install.canPrompt) {
    return (
      <div className={styles.installRow}>
        <p className={styles.installRowText}>{copy.installTitle}</p>
        <button className={styles.actionGhost} type="button" onClick={() => void install.install()}>
          {copy.installAction}
        </button>
      </div>
    );
  }

  return (
    <details className={styles.installFold}>
      <summary className={styles.installRow}>
        <span className={styles.installRowText}>{copy.installTitle}</span>
      </summary>
      <p className={styles.cardText}>{copy.installIosLead}</p>
      <ul className={styles.metaList}>
        {copy.installIosSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The footer's entry. Only where there is a real one-tap prompt to give: a
 * footer link that opens a two-step instruction is a link that does not do what
 * a footer link does, and iOS readers are served by the profile row instead.
 */
export function PwaInstallFooterEntry({ label }: { label: string }) {
  const install = usePwaInstall();
  const ownsInstall = useOwnsPersonalSurfaces();

  if (!ownsInstall || !install.canPrompt) return null;

  return (
    <button type="button" onClick={() => void install.install()}>
      {label}
    </button>
  );
}
