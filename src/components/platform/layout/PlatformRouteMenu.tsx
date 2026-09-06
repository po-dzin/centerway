"use client";

import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";
import styles from "@/components/platform/PlatformShellStyles";
import { ChromeSheetPanel, useChromeSheet } from "./ChromeSheet";

/**
 * THE MAP, BACK IN ITS OWN CONTROL (2026-09-06).
 *
 * When the phone's bar became two floating islands the route map had nowhere to
 * live, so it was folded into the account sheet above the account's own rows.
 * That was wrong in a way the admin panel made obvious: the panel's SEVEN
 * SECTIONS — Аналітика, Замовлення, Клієнти … — came out inside the menu that
 * hangs off a person's face, above «Вийти», with «Аналітика» and «Адмінка»
 * both ink-marked as current in one column. A rail had crawled into an account
 * control.
 *
 * The two are different questions and now have different buttons, which is what
 * the bar always did: WHERE CAN I GO is the burger, WHO AM I is the avatar. The
 * three lines are the same glyph the bar's burger used, so the control a reader
 * learned on a wide screen is the control they find on a narrow one.
 *
 * BOTH IN THE TRAILING CORNER, not one at each end. The leading island is the
 * mark — the way back to the platform — and it is the only thing on that side;
 * moving the map there would have put two menus at opposite edges with no rule
 * saying which held what. Chrome that opens things opens them from one corner.
 *
 * IT RENDERS NOTHING WHEN THERE IS NOTHING TO SHOW. `learn` has no top-level
 * route map by design — the lesson tree is the page — and a burger opening an
 * empty sheet is a control that lies about having somewhere to take you.
 */
export function PlatformRouteMenu({
  routes,
  label = "Навігація",
}: {
  /**
   * The surface's own destinations, as menu rows.
   *
   * A FUNCTION, so every row can close the sheet it was chosen from. Wrapping
   * the rows in a click-catching div would have done it in fewer characters and
   * made the sheet a `<div onClick>` — a control with no role, no key handling
   * and no name, wrapped around real links.
   */
  routes: (close: () => void) => ReactNode;
  label?: string;
}) {
  const { open, toggle, close, form, anchor, tone, attachWrap, attachTrigger, attachMenu } = useChromeSheet();

  return (
    <div className={styles.profileWrap} ref={attachWrap}>
      <button
        ref={attachTrigger}
        className={`${styles.profileEntry} ${styles.profileEntryCompact}`}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        /* The same hook the islands' CSS plates the signed-out account glyph
           with: this is a glyph on nothing too, and one corner an object beside
           the other a smudge is the state that rule exists to prevent. */
        data-auth-state="routes"
      >
        <Icon name="menu" size={20} />
      </button>
      <ChromeSheetPanel
        open={open}
        anchor={anchor}
        form={form}
        tone={tone}
        close={close}
        attachMenu={attachMenu}
        label={label.toLowerCase()}
      >
        {routes(close)}
      </ChromeSheetPanel>
    </div>
  );
}
