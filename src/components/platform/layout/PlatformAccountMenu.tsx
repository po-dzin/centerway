"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import { HandGraphic } from "@/components/Icon";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { supabaseClient } from "@/lib/supabaseClient";
import styles from "@/components/platform/PlatformShellStyles";
import {
  appHref,
  appIsOffOrigin,
  appsFor,
  currentAppKey,
  leadsBackToPublicSite,
  type PlatformAppKey,
} from "@/lib/platform/apps";
import { useSignInHref } from "@/components/auth/useSignInReturn";
import { markInstallSurface } from "../pwa/installStore";
import { usePwaInstall } from "../pwa/usePwaInstall";
import { usePlatformIdentity } from "./usePlatformIdentity";
import { isAuthConfigured, usePlatformSession } from "./usePlatformSession";
import { useOwnsPersonalSurfaces, useSurfaceHost, useSurfaceHref } from "./SurfaceHost";
import { PlatformThemeControl } from "@/components/platform/layout/PlatformThemeControl";
import { ChromeSheetPanel, useChromeSheet } from "./ChromeSheet";

/**
 * The account control: who am I, which applications may I enter, and how do I
 * leave.
 *
 * IT REPLACED A LINK. The entry used to be a bare link to `/profile`, and the
 * admin panel had a different one — a Tailwind dropdown whose only item was
 * `signOut()`. So the panel could be entered and not left: the single control
 * that took you out of `/admin` took you out of the account with it. The
 * builder had no account control at all.
 *
 * The fix is not a back-link per shell. It is this: every shell shows the same
 * list of applications, computed once in `src/lib/platform/apps.ts`, and marks
 * the one you are in rather than hiding it — a menu that changes shape by where
 * you opened it has to be re-read every time.
 *
 * TWO PRESENTATIONS, ONE SOURCE. `menu` is the avatar and a popover, used on
 * the bar. `inline` is the same rows laid flat, used inside the mobile sheet
 * the burger opens, because a popover nested in a sheet is a second layer over
 * a layer on the smallest screen there is.
 *
 * The panel keeps its own markup — it runs a grey Tailwind skin and pulling
 * `--ds-*` into it is the cross-layer consumption `guard:ds-contract` bans — but
 * it reads the same list, so the two cannot disagree about where you may go.
 */

/* Short on purpose: it stands in a column of two- and three-word rows, and the
   cabinet's full sentence would be the one item that wraps. */
const INSTALL_LABEL = "Додати на екран";

/**
 * INSTALL, AS A ROW OF THIS MENU. It used to be a line pinned under the shelf's
 * last course, on a tree that renders no footer — a full-width sentence and a
 * button hanging off the bottom of the page, reading as a footer that had lost
 * its footer. This is where a once-per-device offer belongs instead: in the
 * chrome every page carries, one row among the other things you do to the
 * account rather than a panel competing with the courses.
 *
 * ONLY WHERE THIS ORIGIN IS THE APP. `start_url` is relative, so a prompt fired
 * on `www` would put the STOREFRONT on the home screen. From there the offer is
 * the cabinet's row, which names the crossing and sends the reader to the
 * library — this menu stays silent rather than offering the wrong install.
 *
 * SAFARI GETS THE TWO TAPS, folded. It never fires a prompt, so the only honest
 * thing to offer is the instruction; two lines of it are not a row, hence the
 * disclosure. Anything else — a desktop browser with no prompt and no Share
 * sheet — renders nothing, because a row that leads nowhere is worse than no
 * row.
 */
/* THE ATTRIBUTE IS THE OPT-IN, AND ITS ABSENCE WAS THE BUG (2026-09-10).
   `InkMenuLabel` renders the selection stroke, but the stroke's hover and
   focus rules key on `:is(.cw-tab, .cw-nav-link, [data-cw-ink-control])` —
   and these rows are bare `<a>`/`<button>` with no class of their own. So the
   mark could only ever be painted by `data-cw-ink-active`, the current row,
   and pointing at any other row drew nothing at all. The menu used to hide
   that: it carried its own `::after` underline, retired to `content: none`
   when the ink label took over — the retirement landed, the opt-in did not.
   One constant, spread onto every row, so a row added later cannot forget it. */
const INK_ROW = { "data-cw-ink-control": "" } as const;

function InstallEntry({ onSelect, cabinetHref }: { onSelect: () => void; cabinetHref: string }) {
  const install = usePwaInstall();
  const ownsInstall = useOwnsPersonalSurfaces();

  /* Declares that an install offer is on screen, which is what lets
     `installStore` cancel the browser's own. Without the pairing, suppression
     happened at module scope and a guest on this origin lost the native prompt
     with nothing put in its place. Marked only where the row can actually
     render — the personal origin, outside the installed app. */
  const canOffer = ownsInstall && !install.isStandalone;
  useEffect(() => {
    if (!canOffer) return;
    return markInstallSurface();
  }, [canOffer]);

  if (!canOffer) return null;

  if (install.canPrompt) {
    return (
      <button
        type="button"
        {...INK_ROW}
        onClick={() => {
          onSelect();
          void install.install();
        }}
      >
        <InkMenuLabel>{INSTALL_LABEL}</InkMenuLabel>
      </button>
    );
  }

  if (install.needsIosInstructions) {
    /* A ROW THAT LEADS, NOT A ROW THAT GROWS (2026-09-10). Safari fires no
       prompt, so the only honest offer is the two taps that do it by hand — and
       this used to unfold them right here, which put a lead sentence and a
       numbered list inside a column of two-word destinations. The menu stopped
       being a list of places and became a place itself, on the smallest screen
       the product has; and the fold's own prose is caption ink, so the one row
       that had grown was also the one row reading quieter than its neighbours.

       The instructions already exist, written out properly, in the cabinet's
       install row — `#app-install`. So this is a crossing like every other row
       around it: same weight, same ink, same stroke, and the explaining happens
       on a page with room for it. */
    return (
      <Link
        href={`${cabinetHref}#app-install`}
        {...INK_ROW}
        onClick={() => {
          onSelect();
        }}
      >
        <InkMenuLabel>{INSTALL_LABEL}</InkMenuLabel>
      </Link>
    );
  }

  return null;
}

/** The account's own name, when the provider gave one. */
function displayNameOf(session: Session | null) {
  const name = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name;
  return typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
}

function getUserInitial(session: Session | null) {
  const name = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email;
  return typeof name === "string" && name.length > 0 ? name.charAt(0).toUpperCase() : "?";
}

export function InkMenuLabel({ children, active = false }: { children: string; active?: boolean }) {
  // `tab`, not `menu`, since 2026-09-10: a menu row is chosen one-at-a-time and
  // the mark is the only thing saying which one, so it takes the rounded ink
  // edge the tabs took. The stroke stays where a box would be wrong — a link
  // inside running copy, and a checkbox row whose box already says «chosen».
  return (
    <InteractionInkLabel variant="tab" active={active}>
      {children}
    </InteractionInkLabel>
  );
}

/**
 * WHOSE ACCOUNT THIS IS, ON ITS OWN.
 *
 * The block used to exist only inside the rows below, which put it halfway down
 * the phone drawer — under the five public destinations, where it read as a
 * caption on the apps beneath it rather than as the header of the sheet. On a
 * phone the first thing a menu should answer is «whose session am I in», so the
 * drawer hoists this to its top and asks the rows to skip it
 * (`showIdentity={false}`). The desktop popover keeps it inline: there the menu
 * hangs off the avatar, which has already answered the question.
 */
export function PlatformAccountIdentity() {
  const session = usePlatformSession();
  const accountName = displayNameOf(session);
  const accountEmail = session?.user?.email ?? null;
  if (!session?.user || (!accountName && !accountEmail)) return null;
  return (
    <div className={styles.menuIdentity} data-placement="hoisted" data-cw-rule="chrome">
      {accountName ? <p className={styles.menuIdentityName}>{accountName}</p> : null}
      {accountEmail ? <p className={styles.menuIdentityMail}>{accountEmail}</p> : null}
    </div>
  );
}

export function PlatformAccountMenu({
  variant = "menu",
  compact = false,
  exclude,
  onNavigate,
  showIdentity = true,
}: {
  variant?: "menu" | "inline";
  compact?: boolean;
  /* NO `routes` SLOT ANY MORE (2026-09-06). For one day the islands folded the
     surface's route map into this sheet, on the argument that two floating
     pills have nowhere to show a map. The admin panel showed what that costs:
     its seven rail sections arrived above «Вийти», with «Аналітика» and
     «Адмінка» both marked current in one column — a rail inside an account
     control. The map has its own island now (`PlatformRouteMenu`), which is
     what the bar always did: burger for where, avatar for who. */
  /** False where the surrounding surface has hoisted the identity block itself. */
  showIdentity?: boolean;
  /**
   * Applications the surrounding surface already lists, so they are not offered
   * twice. The burger sheet names the shelf in its own nav — the account block
   * under it repeating the row would read as two different destinations with
   * one label.
   */
  exclude?: PlatformAppKey[];
  onNavigate?: () => void;
}) {
  const session = usePlatformSession();
  const identity = usePlatformIdentity(session);
  const pathname = usePathname();
  /* THE SHEET IS SHARED (2026-09-06) — see `useChromeSheet`. The measuring,
     the portal, the tone and the three forms used to live in this file, which
     was fine while the account was the only control in the chrome that opened
     anything. The phone has two now: this one, and the burger beside it. */
  const { open, toggle, close, form, anchor, tone, attachWrap, attachTrigger, attachMenu } = useChromeSheet();

  const isAuthEnabled = isAuthConfigured();
  const signedIn = Boolean(session?.user);

  /* The host comes from the SERVER, through the shell's provider. Read from
     `window` it is unknown during SSR, so every cross-origin entry rendered as
     a same-origin path and only became absolute after hydration — a link that
     is wrong in the markup for as long as the JS takes to arrive. */
  const host = useSurfaceHost();
  /* The signed-out entry is a plain link to the cabinet, and the cabinet stayed
     on `www` — so from the personal host it has to name its origin like every
     other crossing. */
  const surfaceHref = useSurfaceHref();
  const cabinetHref = surfaceHref("/profile");
  /* THE DOOR REMEMBERS THE PAGE IT WAS OPENED FROM (2026-09-20).
     The signed-out row leads to the cabinet, and the cabinet is where the
     sign-in ends — so pressing «Увійти» while reading a programme, the
     diagnostic or the catalogue signed you in and put you on your dashboard,
     with the page you were reading gone and the browser's back button the only
     way to it. The wall in front of `/learn` and `/profile` never had this
     problem: it renders IN PLACE of the page asked for. This is that same
     promise for the one entry that is a link rather than a wall —
     `lib/auth/signInReturn` says what may be carried, `useSignInReturn` spends
     it on arrival. */
  const signInHref = useSignInHref(cabinetHref);
  /* THE WAY BACK TO THE PUBLIC SITE.
     `my` serves the cabinet, the shelf and the player, and nothing on it leads
     back to the public site: its own root IS the shelf, so a reader who wanted
     the catalogue, the programs or the offer they came from had the browser's
     back button and nothing else. The admin panel had the same hole and closed
     it with a first row out; this is that row, on the other shells.

     WHERE it is offered is `leadsBackToPublicSite` below. The label is
     Ukrainian here and translated in the panel because the platform ships one
     language and the panel ships two; what the two shells share is the
     destination, not the string. */
  const platformHref = surfaceHref("/");
  const allApps = appsFor({ signedIn, role: identity.role, authorsCourses: identity.authorsCourses });
  const apps = exclude?.length ? allApps.filter((app) => !exclude.includes(app.key)) : allApps;
  const here = currentAppKey(host, pathname);
  /* The rule, with its history, is `leadsBackToPublicSite` in apps.ts — it sits
     beside `currentAppKey`, whose answer it reads, and is tested there. */
  const showHomeRow = leadsBackToPublicSite(here);

  /* No close-on-pathname effect. Every row in the menu closes it in its own
     handler, and anything outside the menu is an outside pointerdown, which the
     listener above already catches — a synchronous setState in an effect would
     buy a cascading render for a case that cannot arise. */

  const signOut = async () => {
    await supabaseClient.auth.signOut();
    /* A hard navigation, not a router push. Sign-out invalidates data every
       shell already has in memory — the role cache, the shelf, an open course —
       and the root of the current origin is the one destination that exists on
       all three.

       NO `eslint-disable` HERE ANY MORE (2026-09-20). One sat on this line
       naming `@next/next/no-location-assign-relative-destination`, a rule the
       installed plugin (16.1.5) does not define — and ESLint treats a disable
       for an unknown rule as an error, so `npm run lint` had been failing on
       this one line since 2026-09-13. The line it silenced is deliberate and
       is explained above; nothing warns about it today. */
    if (typeof window !== "undefined") window.location.assign("/");
  };

  /* SIGNED OUT: a link to the door, not a shortcut past it (2026-09-09).
     `/profile` already resolves `cabinetGate()`, which offers email-first —
     Google below it — for exactly the reason `SignInOptions`' own comment
     gives: entitlement is linked by VERIFIED email, so a buyer who paid with
     anything but a Google address needs the code form, not a redirect that
     skips straight past it. This control used to `preventDefault()` and call
     Google directly, from before that form existed — the two-door pattern
     reached every other gate in the app (`CabinetGate`, `BuilderShell`) and
     missed the one in the header, so the fastest way in
     was quietly the one door that did not fit everyone.

     THE CONTROL IS NOW A POPOVER, LIKE THE SIGNED-IN ONE — not a bare link,
     and not only on desktop. Below 901px this same component is the mobile
     chrome (`PlatformOrgans` in `PlatformLayout`/`BuilderShell`/the admin
     layout all mount `<PlatformAccountMenu compact />`, `variant="menu"`);
     the phone never reaches the `inline` branch this file used to carry the
     setting in alone, so a bare link left a signed-out phone with no way to
     `Вигляд` at all short of scrolling to the footer. One shape now serves
     both auth states: the trigger opens a sheet, the sheet's first row is the
     setting, and what sits below it is either the account or the door in. */
  if (!signedIn) {
    const label = isAuthEnabled ? "Увійти" : "Кабінет";

    const guestRows = (
      <>
        <div className={styles.menuSetting} role="none">
          <span className={styles.menuSettingLabel}>Вигляд</span>
          <PlatformThemeControl />
        </div>
        <Link
          href={signInHref}
          {...INK_ROW}
          onClick={() => {
            close();
            onNavigate?.();
          }}
        >
          <InkMenuLabel>{label}</InkMenuLabel>
        </Link>
      </>
    );

    if (variant === "inline") {
      return <div className={styles.profileWrapMobile}>{guestRows}</div>;
    }

    return (
      <div className={styles.profileWrap} ref={attachWrap}>
        <button
          ref={attachTrigger}
          className={`${styles.profileEntry} ${compact ? styles.profileEntryCompact : ""}`}
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={label}
          data-auth-state={isAuthEnabled ? "guest" : "fallback"}
        >
          {compact ? <span className={styles.profileGlyph} aria-hidden="true" /> : null}
          {compact ? null : <span className={styles.profileLabel}>{label}</span>}
        </button>
        <ChromeSheetPanel
          open={open}
          anchor={anchor}
          form={form}
          tone={tone}
          close={close}
          attachMenu={attachMenu}
          label="увійти"
        >
          {guestRows}
        </ChromeSheetPanel>
      </div>
    );
  }

  const avatarUrl = session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || null;
  const accountName = displayNameOf(session);
  const accountEmail = session?.user?.email ?? null;

  const rows = (
    <>
      {/* WHOSE MENU THIS IS, BEFORE WHAT IT CAN DO. The address alone was cut
          once as a line that answered nothing — and it did read that way,
          because an address on its own is a field, not an identity. The name
          above it is what makes the block an account header: on a shared
          machine, or with two of these signed in, «which of me is this» is a
          real question and it has to be answered before «Вийти» is pressed.

          A caption block, not two rows: neither line is a place to go, so
          neither takes the row's height, weight or mark. */}
      {/* `data-cw-rule="chrome"` — THE SAME DECLARATION THE HOISTED TWIN HAS
          CARRIED SINCE IT WAS WRITTEN (2026-09-10). `.menuIdentity` is ruled
          off with `--cw-rule-fade-x`, and without naming its surface the ink
          defaults to `--cw-platform-border`: the page's hairline, drawn on a
          plate whose tone flips independently of the theme. On the light theme
          over a dark hero that is a bright white line across the top of the
          menu, while the divider below it recedes correctly. The scope is
          tone-aware in globals.css for exactly this portalled case. */}
      {showIdentity && (accountName || accountEmail) ? (
        <div className={styles.menuIdentity} data-cw-rule="chrome">
          {accountName ? <p className={styles.menuIdentityName}>{accountName}</p> : null}
          {accountEmail ? <p className={styles.menuIdentityMail}>{accountEmail}</p> : null}
        </div>
      ) : null}
      {/* THE WAY BACK TO THE PUBLIC SITE, first — the same place the panel puts
          it. Absent on the storefront itself, where the main navigation already
          carries «Головна» and this would be the second door to one room.

          A plain anchor, like every other crossing in this menu: `next/link`
          would prefetch a route this origin does not own and still full-load on
          click. */}
      {showHomeRow ? (
        <a
          href={platformHref}
          {...INK_ROW}
          onClick={() => {
            close();
            onNavigate?.();
          }}
        >
          <InkMenuLabel>На головну</InkMenuLabel>
        </a>
      ) : null}
      {apps.map((app) => {
        const href = appHref(app, host);
        const offOrigin = appIsOffOrigin(app, host);
        const current = app.key === here;
        const shared = {
          ...INK_ROW,
          onClick: () => {
            close();
            onNavigate?.();
          },
          "aria-current": current ? ("page" as const) : undefined,
          "data-current": current || undefined,
        };

        /* An off-origin destination is a plain anchor. `next/link` would
           prefetch a route this app does not own and still full-load on click —
           the builder lives on its own host today. */
        return offOrigin ? (
          <a key={app.key} href={href} {...shared}>
            <InkMenuLabel active={current}>{app.label}</InkMenuLabel>
          </a>
        ) : (
          <Link key={app.key} href={href} {...shared}>
            <InkMenuLabel active={current}>{app.label}</InkMenuLabel>
          </Link>
        );
      })}
      {/* THE MENU HAS THREE REGISTERS, AND THE THEME BELONGS TO THE THIRD.
          Above the rule: who this is, and everywhere they can go. Below it:
          THIS DEVICE — put the app on its home screen, and choose how it
          looks. Then the way out.

          The icons had been dropped between "Додати на екран" and "Вийти" with
          nothing around them, so they read as two destinations someone forgot
          to name. What was missing was not a label on the control but a place
          for it: a setting is not a row you travel to, so it takes the shape a
          setting takes — its name at the left, its state at the right — and it
          joins the group whose other member is also about this machine rather
          than about the product.

          `role="none"` on the wrapper because the three buttons are ONE
          control; a menu whose items are two thirds of a segmented switch is a
          menu that cannot be arrowed through. */}
      <div className={styles.profileMenuDivider} role="none" />
      <InstallEntry
        cabinetHref={cabinetHref}
        onSelect={() => {
          close();
          onNavigate?.();
        }}
      />
      <div className={styles.menuSetting} role="none">
        <span className={styles.menuSettingLabel}>Вигляд</span>
        <PlatformThemeControl />
      </div>
      <button type="button" {...INK_ROW} onClick={() => void signOut()}>
        <InkMenuLabel>Вийти</InkMenuLabel>
      </button>
    </>
  );

  if (variant === "inline") {
    return <div className={styles.profileWrapMobile}>{rows}</div>;
  }

  return (
    <div className={styles.profileWrap} ref={attachWrap}>
      <button
        ref={attachTrigger}
        className={`${styles.profileEntry} ${compact ? styles.profileEntryCompact : ""}`}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Обліковий запис"
        data-auth-state="user"
      >
        <span className={styles.profileAvatar} aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            getUserInitial(session)
          )}
        </span>
        <HandGraphic className={styles.profileInkRing} name="ink-ring" size={48} />
        {compact ? null : <span className={styles.profileLabel}>Кабінет</span>}
      </button>
      <ChromeSheetPanel
        open={open}
        anchor={anchor}
        form={form}
        tone={tone}
        close={close}
        attachMenu={attachMenu}
        label="меню акаунта"
      >
        {rows}
      </ChromeSheetPanel>
    </div>
  );
}
