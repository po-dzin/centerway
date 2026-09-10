"use client";

/**
 * The offer to install the app — a card, among the account's other cards.
 *
 * WHERE IT LIVES. Installing is a once-per-device act, and it kept claiming
 * page space for it: first a card on the shelf, then a row pinned under the
 * shelf's last course. That row was the worse of the two — the learning tree
 * renders `footer={false}`, so a full-width line under the grid read as a
 * footer that had lost its footer, one sentence and a button hanging off the
 * bottom of the page with nothing around them. It moved here, to the account
 * section, and was demoted again on arrival — from a card to a bare text row
 * — on the reasoning that a standing offer is not the account's fourth card.
 *
 * IT IS A CARD AGAIN (2026-09-10), and the reasoning that demoted it does not
 * apply here: that row hung off an unrelated shelf grid with nothing beside
 * it. This one sits inside the account's OWN grid, beside "Дані та контакти"
 * and "Нагадування про курс" — cards about exactly this kind of thing, a fact
 * about this account and its device. A plain text line among two matte
 * panels did not read as quieter; it read as unfinished, the one row on the
 * page with no material, no boundary, nothing to mark it as belonging. The
 * card IS the identifying mark on this page — see `docs/design-system.md`,
 * "Material layer": every panel here is matte, stroke and grain and shadow
 * from one recipe, and a row with none of that is not restraint, it is an
 * omission.
 *
 * THE TITLE IS STABLE ACROSS EVERY STATE, the same idiom `notificationsTitle`
 * already uses: "Нагадування про курс" does not change when Telegram is
 * linked or not, only the sentence beneath it does. `installCardTitle` does
 * the same job here, so the card is instantly recognisable and does not
 * change shape as the install state resolves — a title that read "Add" only
 * while its own body was saying "already added" would contradict itself for
 * one render.
 *
 * IT LIVES IN THE TWO PLACES A STANDING OFFER BELONGS ON THIS PLATFORM: the
 * account menu (the burger on a phone, the avatar popover on a desktop),
 * which is the chrome every page carries, and this card, because "is this
 * installed" is a fact about this account's device and the account page is
 * where facts about it are listed. See `InstallEntry` in
 * `layout/PlatformAccountMenu.tsx` for the menu half — that one stays a menu
 * row on purpose, since a chip-and-card treatment inside a popover would be
 * its own kind of wrong.
 *
 * WHICH HOST. `ownsInstall` is not a host name but a question — does this
 * origin serve the personal surfaces? On `www` the root is the storefront,
 * and an install from there would put the SHOP on someone's home screen when
 * what they tap the icon for is the course (the manifest's `start_url` is
 * relative, so it resolves to whichever host it was installed from). Asking
 * the question rather than naming the host keeps it working on localhost and
 * on previews, where one origin serves everything.
 *
 * THE PROFILE IS THE CROSSING, AND THAT IS WHY IT HANDS OFF RATHER THAN
 * PROMPTS. `/profile` is a `www` path on purpose: it is the step between the
 * platform a person buys on and the library they then live in, so it stands
 * on the public origin and its job is to carry them over. An account page
 * cannot be the thing that installs the app, because installing here would
 * add the storefront — `start_url` is relative and resolves against whichever
 * host fired the prompt. What it can do is name the crossing and take them
 * across.
 *
 * So the rule is one sentence: PROMPT WHERE THIS ORIGIN IS THE APP, POINT AT
 * THE ORIGIN THAT IS. The library prompts — from its menu; the profile sends
 * the reader to the library and lets it prompt there.
 *
 * FIVE BRANCHES, NEVER MORE THAN ONE: elsewhere (hand off to the shelf),
 * already installed, a native prompt to trigger, iOS's two-tap instructions
 * behind a disclosure, or a bare browser with neither. None renders once the
 * app is already running installed. Every branch keeps the same card shape —
 * title, then body, then (sometimes) an action — because that consistency is
 * what makes it read as one card settling into its state rather than four
 * different cards taking turns.
 */

import { usePwaInstall } from "../pwa/usePwaInstall";
import { useOwnsPersonalSurfaces } from "../layout/SurfaceHost";
import { LEARNING_SHELF_HREF } from "@/lib/platform/content";
import { canonicalPersonalPath, personalUrl } from "@/lib/surfaces/catalog";
import type { getCabinetCopy } from "./copy";
import { matte } from "./CourseCard";
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
 * The account's card for installing. One panel, the same shape as its
 * neighbours — title, body, and the control the current state calls for, or
 * none where there is nothing to do (already installed; a bare browser with
 * no prompt and no instructions to give).
 */
export function PwaInstallCard({ copy }: { copy: ReturnType<typeof getCabinetCopy> }) {
  const install = usePwaInstall();
  const ownsInstall = useOwnsPersonalSurfaces();

  if (!ownsInstall) {
    return (
      <article id="app-install" className={styles.card} {...matte}>
        <h3 className={styles.cardTitle}>{copy.installCardTitle}</h3>
        <p className={styles.cardText}>{copy.installElsewhereLead}</p>
        <div className={styles.actions}>
          <a className={styles.actionGhost} href={SHELF_INSTALL_URL}>
            {copy.installElsewhereAction}
          </a>
        </div>
      </article>
    );
  }

  if (install.isStandalone) {
    return (
      <article id="app-install" className={styles.card} {...matte}>
        <h3 className={styles.cardTitle}>{copy.installCardTitle}</h3>
        <p className={styles.cardText}>{copy.installInstalledTitle}</p>
      </article>
    );
  }

  if (install.canPrompt) {
    return (
      <article id="app-install" className={styles.card} {...matte}>
        <h3 className={styles.cardTitle}>{copy.installCardTitle}</h3>
        <p className={styles.cardText}>{copy.installLead}</p>
        <div className={styles.actions}>
          <button className={styles.actionGhost} type="button" onClick={() => void install.install()}>
            {copy.installAction}
          </button>
        </div>
      </article>
    );
  }

  if (install.needsIosInstructions) {
    return (
      <article id="app-install" className={styles.card} {...matte}>
        <h3 className={styles.cardTitle}>{copy.installCardTitle}</h3>
        <p className={styles.cardText}>{copy.installLead}</p>
        {/* The steps behind a disclosure rather than always open: they answer
            "how", and most readers only need "that it can be done" — the lead
            line already said so. `summary` wears the same secondary-button
            skin every other card action does (`.actionGhost`), so it reads as
            this card's control rather than as a caption. */}
        <details className={styles.cardDetails}>
          <summary className={`${styles.cardDetailsToggle} ${styles.actionGhost}`}>{copy.installIosToggle}</summary>
          <p className={styles.cardText}>{copy.installIosLead}</p>
          <ul className={styles.metaList}>
            {copy.installIosSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </details>
      </article>
    );
  }

  return (
    <article id="app-install" className={styles.card} {...matte}>
      <h3 className={styles.cardTitle}>{copy.installCardTitle}</h3>
      <p className={styles.cardText}>{copy.installBrowserLead}</p>
    </article>
  );
}
