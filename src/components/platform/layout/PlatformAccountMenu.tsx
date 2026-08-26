"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import { HandGraphic } from "@/components/Icon";
import { supabaseClient } from "@/lib/supabaseClient";
import styles from "@/components/platform/PlatformShellStyles";
import {
  appHref,
  appIsOffOrigin,
  appsFor,
  currentAppKey,
  type PlatformAppKey,
} from "@/lib/platform/apps";
import { usePlatformIdentity } from "./usePlatformIdentity";
import { isAuthConfigured, usePlatformSession } from "./usePlatformSession";
import { useSurfaceHost, useSurfaceHref } from "./SurfaceHost";

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

function getUserInitial(session: Session | null) {
  const name =
    session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email;
  return typeof name === "string" && name.length > 0 ? name.charAt(0).toUpperCase() : "?";
}

function InkMenuLabel({ children }: { children: string }) {
  return (
    <span className={styles.menuInkLabel}>
      {children}
      <HandGraphic className={styles.menuInkMark} name="ink-stroke" size={36} />
    </span>
  );
}

export function PlatformAccountMenu({
  variant = "menu",
  compact = false,
  exclude,
  onNavigate,
}: {
  variant?: "menu" | "inline";
  compact?: boolean;
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
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<CSSProperties | null>(null);
  /* The popover is portalled to `document.body`, so it does NOT inherit the
     bar's tone scope — and the bar has one: `headerTone` flips the topbar to
     the night material whenever it floats over a dark hero. The menu was left
     behind on the light side of that flip, which on a graded photo meant a
     30% cream tint with near-black ink on it: a light-tone panel and no dark
     one. It carries the bar's tone across the portal instead. */
  const [tone, setTone] = useState<"light" | "dark">("light");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

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
  /* THE WAY BACK TO THE PUBLIC SITE.
     `my` serves the shelf, the player and the builder, and nothing on it leads
     back to the public site: its own root IS the shelf, so a reader who wanted
     the catalogue, the programs or the offer they came from had the browser's
     back button and nothing else. The admin panel had the same hole and closed
     it with a first row out; this is that row, on the other shell.

     NOT an entry in `apps.ts`. That list answers "which applications may this
     account enter", and every row in it is marked when you are standing in it.
     The public site is not an application of the account — it is where the
     account is not needed — and a row labelled «На платформу» marked as the
     current page on `www` would read as an instruction to go where you already
     are. The label is Ukrainian here and translated in the panel because the
     platform ships one language and the panel ships two; what the two shells
     share is the destination, not the string. */
  const platformHref = surfaceHref("/");
  const allApps = appsFor({ signedIn, role: identity.role, authorsCourses: identity.authorsCourses });
  const apps = exclude?.length ? allApps.filter((app) => !exclude.includes(app.key)) : allApps;
  const here = currentAppKey(host, pathname);
  /* WHICH APPLICATION, not which host. Keying the exit off `isPersonalHost`
     was the obvious version and hid the row exactly where it is most needed
     while building: the subdomain only ever points at production, so on
     localhost and on a preview `my` does not exist and the shelf and the
     builder are reached by path. Asking where the reader IS answers for both —
     the personal host, where everything is one of these two, and every other
     environment, where they are paths on one origin.

     `cabinet` is deliberately not in the list: /profile is on the public site,
     so its reader is already on the platform. */
  const inPersonalApp = here === "learn" || here === "builder";

  const close = useCallback(() => setOpen(false), []);

  /* THE POPOVER IS PORTALLED, and this is why: the header is `overflow: clip`
     — it is a rounded frosted plate and the nav sheet slides inside it — so a
     menu absolutely positioned against the avatar laid out correctly under the
     bar and was then clipped away in full. Measured: 315px of menu, every pixel
     of it past the header's bottom edge, nothing painted.

     Anchoring by measured rect rather than by CSS, because a fixed element
     inside the header would be clipped too: the bar's `backdrop-filter` makes
     it a containing block for fixed descendants. */
  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    /* Anchored to the BAR, not to the avatar. The avatar sits inside the
       header's own inline padding, so aligning to it hung the menu a centimetre
       short of the plate above it — two right edges a few pixels apart, which
       reads as a misplaced popover rather than as a panel belonging to the bar.
       Falls back to the trigger where there is no bar to belong to. */
    const bar = trigger.closest("header");
    const rect = (bar ?? trigger).getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    setAnchor({
      top: `${Math.round(Math.max(rect.bottom, triggerRect.bottom) + 8)}px`,
      right: `${Math.round(Math.max(8, window.innerWidth - rect.right))}px`,
      maxHeight: `${Math.max(192, Math.round(window.innerHeight - Math.max(rect.bottom, triggerRect.bottom) - 16))}px`,
    });
  }, []);

  /* Escape and outside-click, both required: the popover sits over the bar on
     every surface, and on a phone in learning mode it is the only thing between
     the reader and the lesson. */
  useEffect(() => {
    if (!open) return;

    /* The bar is sticky, so scrolling usually does not move the trigger — but
       a short page and a zoomed viewport both can, and a menu that drifts off
       its avatar reads as a bug in the bar rather than in the popover. */
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    /* WATCHED, not sampled once at open. The bar decides its tone from what it
       measures behind it, and that verdict lands a frame or more after the
       click that opened this menu — reading the attribute in `measure` alone
       left the panel dark over a light page for the whole time it stayed open.
       The observer keeps the two in step for as long as the menu exists. */
    const bar = triggerRef.current?.closest("header") ?? null;
    const syncTone = () => setTone(bar?.dataset.cwHeaderTone === "dark" ? "dark" : "light");
    const observer = bar ? new MutationObserver(syncTone) : null;
    observer?.observe(bar as HTMLElement, { attributeFilter: ["data-cw-header-tone"] });
    syncTone();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: PointerEvent) => {
      const wrap = wrapRef.current;
      const menu = menuRef.current;
      const target = event.target as Node;
      /* Both, because the menu is no longer a descendant of the wrapper: it
         lives on `document.body`. Testing the wrapper alone would close the
         menu on the first click INSIDE it. */
      if (wrap?.contains(target) || menu?.contains(target)) return;
      close();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  /* No close-on-pathname effect. Every row in the menu closes it in its own
     handler, and anything outside the menu is an outside pointerdown, which the
     listener above already catches — a synchronous setState in an effect would
     buy a cascading render for a case that cannot arise. */

  const signInWithGoogle = async () => {
    const redirectTo = typeof window !== "undefined" ? window.location.href : undefined;
    await supabaseClient.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  };

  const signOut = async () => {
    await supabaseClient.auth.signOut();
    /* A hard navigation, not a router push. Sign-out invalidates data every
       shell already has in memory — the role cache, the shelf, an open course —
       and the root of the current origin is the one destination that exists on
       all three. */
    if (typeof window !== "undefined") window.location.assign("/");
  };

  /* SIGNED OUT: unchanged from the link this replaced. There is no account, so
     there is nothing to switch between, and the control is the way in. */
  if (!signedIn) {
    const label = isAuthEnabled ? "Увійти" : "Профіль";
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isAuthEnabled) {
        onNavigate?.();
        return;
      }
      event.preventDefault();
      onNavigate?.();
      void signInWithGoogle();
    };

    return (
      <Link
        className={`${styles.profileEntry} ${variant === "inline" ? styles.profileEntryMobile : ""} ${
          compact ? styles.profileEntryCompact : ""
        }`}
        href={cabinetHref}
        onClick={handleClick}
        aria-label={label}
        data-auth-state={isAuthEnabled ? "guest" : "fallback"}
      >
        {compact ? <span className={styles.profileGlyph} aria-hidden="true" /> : null}
        {compact ? null : <span className={styles.profileLabel}>{label}</span>}
      </Link>
    );
  }

  const email = session?.user?.email ?? null;
  const avatarUrl =
    session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || null;

  const rows = (
    <>
      {email ? <p>{email}</p> : null}
      {/* First, above the account's own applications — the same place the panel
          puts it. Rendered only inside the shelf or the builder: on the public
          site it would point at the family of pages the reader is already in.

          A plain anchor, like every other crossing in this menu: `next/link`
          would prefetch a route this origin does not own and still full-load on
          click. */}
      {inPersonalApp ? (
        <a
          href={platformHref}
          onClick={() => {
            close();
            onNavigate?.();
          }}
        >
          <InkMenuLabel>На платформу</InkMenuLabel>
        </a>
      ) : null}
      {apps.map((app) => {
        const href = appHref(app, host);
        const offOrigin = appIsOffOrigin(app, host);
        const current = app.key === here;
        const shared = {
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
            <InkMenuLabel>{app.label}</InkMenuLabel>
          </a>
        ) : (
          <Link key={app.key} href={href} {...shared}>
            <InkMenuLabel>{app.label}</InkMenuLabel>
          </Link>
        );
      })}
      <button type="button" onClick={() => void signOut()}>
        <InkMenuLabel>Вийти</InkMenuLabel>
      </button>
    </>
  );

  if (variant === "inline") {
    return <div className={styles.profileWrapMobile}>{rows}</div>;
  }

  return (
    <div className={styles.profileWrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        className={`${styles.profileEntry} ${compact ? styles.profileEntryCompact : ""}`}
        type="button"
        onClick={() => {
          measure();
          setOpen((value) => !value);
        }}
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
        {compact ? null : <span className={styles.profileLabel}>Профіль</span>}
      </button>
      {open && anchor && typeof document !== "undefined"
        ? createPortal(
            <div className={styles.profileMenu} style={anchor} role="menu" ref={menuRef} data-cw-glass="shell" data-cw-header-tone={tone}>
              {rows}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
