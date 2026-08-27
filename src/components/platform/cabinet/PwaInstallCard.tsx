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
 * tap the icon for is the course (the manifest's `start_url` is relative, so it
 * resolves to whichever host it was installed from). Asking the question rather
 * than naming the host keeps it working on localhost and on previews, where one
 * origin serves everything.
 *
 * THE PROFILE IS THE CROSSING, AND THAT IS WHY IT HANDS OFF RATHER THAN PROMPTS.
 * `/profile` is a `www` path on purpose: it is the step between the platform a
 * person buys on and the library they then live in, so it stands on the public
 * origin and its job is to carry them over. An account page cannot be the thing
 * that installs the app, because installing here would add the storefront —
 * `start_url` is relative and resolves against whichever host fired the prompt.
 * What it can do is name the crossing and take them across.
 *
 * So the rule is one sentence: PROMPT WHERE THIS ORIGIN IS THE APP, POINT AT THE
 * ORIGIN THAT IS. The library prompts; the platform and the profile between them
 * send the reader to the shelf and let it prompt. Returning null instead — which
 * is what this did — left the offer unreachable from the account page and from
 * every footer beside it, which is not a boundary, only a gap.
 *
 * TWO BRANCHES, NEVER BOTH, and neither renders once the app is already running
 * installed: Chrome parks a real prompt, Safari never fires one and has to be
 * told the two taps instead.
 */

import { usePwaInstall } from "../pwa/usePwaInstall";
import { useOwnsPersonalSurfaces } from "../layout/SurfaceHost";
import { LEARNING_SHELF_HREF } from "@/lib/platform/content";
import { canonicalPersonalPath, personalUrl } from "@/lib/surfaces/catalog";
import type { getCabinetCopy } from "./copy";
import styles from "./Cabinet.module.css";

/**
 * The shelf, addressed absolutely and anchored at its own install row: from the
 * storefront this has to cross an origin, and landing on the row means the next
 * step is the one the reader came for rather than a page to search.
 */
const SHELF_INSTALL_URL = `${personalUrl(canonicalPersonalPath(LEARNING_SHELF_HREF))}#app-install`;

/**
 * The profile's row. One line in the account section: what it is, and the
 * control — or, on iOS, the two steps behind a disclosure, since there is no
 * control to give.
 */
export function PwaInstallRow({ copy }: { copy: ReturnType<typeof getCabinetCopy> }) {
  const install = usePwaInstall();
  const ownsInstall = useOwnsPersonalSurfaces();

  if (!ownsInstall) {
    return (
      <div id="app-install" className={styles.installRow}>
        <p className={styles.installRowText}>{copy.installElsewhereLead}</p>
        <a className={styles.actionGhost} href={SHELF_INSTALL_URL}>
          {copy.installElsewhereAction}
        </a>
      </div>
    );
  }

  if (install.isStandalone) {
    return (
      <div id="app-install" className={styles.installRow}>
        <p className={styles.installRowText}>{copy.installInstalledTitle}</p>
      </div>
    );
  }

  if (install.canPrompt) {
    return (
      <div id="app-install" className={styles.installRow}>
        <p className={styles.installRowText}>{copy.installTitle}</p>
        <button className={styles.actionGhost} type="button" onClick={() => void install.install()}>
          {copy.installAction}
        </button>
      </div>
    );
  }

  if (install.needsIosInstructions) {
    return (
      <details className={styles.installFold}>
        <summary id="app-install" className={styles.installRow}>
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

  return (
    <div id="app-install" className={styles.installRow}>
      <p className={styles.installRowText}>{copy.installBrowserLead}</p>
    </div>
  );
}

/**
 * The footer always keeps the installation route visible. Where the browser
 * exposes its native prompt it remains a one-tap action; elsewhere it points to
 * the last account row, which names the browser-specific next step.
 */
export function PwaInstallFooterEntry({ label, fallbackHref }: { label: string; fallbackHref: string }) {
  const install = usePwaInstall();
  const ownsInstall = useOwnsPersonalSurfaces();

  if (install.isStandalone) return null;

  /* The storefront's footer keeps the offer, but sends it to the origin whose
     root is the app rather than firing a prompt that would install the shop. */
  if (!ownsInstall) return <a href={SHELF_INSTALL_URL}>{label}</a>;

  if (install.canPrompt) {
    return (
      <button type="button" onClick={() => void install.install()}>
        {label}
      </button>
    );
  }

  return <a href={fallbackHref}>{label}</a>;
}
