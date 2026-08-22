"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

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
  const cabinetHref = useSurfaceHref()("/profile");
  const allApps = appsFor({ signedIn, role: identity.role, authorsCourses: identity.authorsCourses });
  const apps = exclude?.length ? allApps.filter((app) => !exclude.includes(app.key)) : allApps;
  const here = currentAppKey(host, pathname);

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
    const rect = trigger.getBoundingClientRect();
    setAnchor({
      top: `${Math.round(rect.bottom + 8)}px`,
      right: `${Math.round(Math.max(8, window.innerWidth - rect.right))}px`,
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
    return () => {
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
            {app.label}
          </a>
        ) : (
          <Link key={app.key} href={href} {...shared}>
            {app.label}
          </Link>
        );
      })}
      <button type="button" onClick={() => void signOut()}>
        Вийти
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
        {compact ? null : <span className={styles.profileLabel}>Профіль</span>}
      </button>
      {open && anchor && typeof document !== "undefined"
        ? createPortal(
            <div className={styles.profileMenu} style={anchor} role="menu" ref={menuRef}>
              {rows}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
