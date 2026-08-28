"use client";

/**
 * The offer to install the app — one row, in the cabinet.
 *
 * WHERE IT LIVES. Installing is a once-per-device act, and it kept claiming
 * page space for it: first a card on the shelf and another in the profile, then
 * a row pinned under the shelf's last course. That row was the worse of the
 * two. The learning tree renders `footer={false}` — a lesson has no footer, and
 * neither does the shelf — so a full-width line under the grid read as a footer
 * that had lost its footer: one sentence and a button, hanging off the bottom
 * of the page with nothing around them.
 *
 * It lives in the two places a standing offer belongs on this platform: the
 * account menu (the burger on a phone, the avatar popover on a desktop), which
 * is the chrome every page carries, and this row in the cabinet, because "is
 * this installed" is a fact about this account's device and the account page is
 * where facts about it are listed. See `InstallEntry` in
 * `layout/PlatformAccountMenu.tsx` for the menu half.
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
 * ORIGIN THAT IS. The library prompts — from its menu; the profile sends the
 * reader to the library and lets it prompt there.
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
 * The shelf, addressed absolutely: from the storefront this has to cross an
 * origin. No hash any more — the offer on that side is in the account menu the
 * shelf carries, not a row on the page, and a link to a `#app-install` that no
 * longer exists there would land the reader at the top of the shelf with no
 * sign of what they came for.
 */
const SHELF_INSTALL_URL = personalUrl(canonicalPersonalPath(LEARNING_SHELF_HREF));

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
