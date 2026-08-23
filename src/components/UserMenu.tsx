"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { appHref, appsFor, currentAppKey } from "@/lib/platform/apps";
import { useSurfaceHost } from "@/components/platform/layout/SurfaceHost";

/**
 * The panel's account control.
 *
 * IT USED TO HOLD ONE ITEM: sign out. That made leaving `/admin` and leaving
 * the ACCOUNT the same act — the panel had no other link out of itself, so an
 * operator who opened it was stuck in it. The applications listed here are the
 * same ones the platform's own `PlatformAccountMenu` shows, computed by
 * `src/lib/platform/apps.ts`, so the two cannot disagree about where this
 * account may go.
 *
 * The MARKUP stays Tailwind and grey. The panel runs its own skin
 * (`cw-admin-theme`) and pulling `--ds-*` into it is exactly the cross-layer
 * consumption `guard:ds-contract` bans, so what is shared here is the data, not
 * the component. The day the panel moves onto the design system, this becomes
 * one more caller of the shared control.
 */
interface UserMenuProps {
    email?: string | null;
    role?: string | null;
    /** Whether this account owns a course row — decides the builder entry. */
    authorsCourses?: boolean;
    initial?: string;
    avatarUrl?: string | null;
}

export function UserMenu({ email, role, authorsCourses = false, initial = "?", avatarUrl }: UserMenuProps) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleSignOut = async () => {
        setOpen(false);
        await supabaseClient.auth.signOut();
    };

    const host = useSurfaceHost();
    const pathname = typeof window === "undefined" ? "" : window.location.pathname;
    /* Signed in by construction: this control only renders inside the panel,
       which the shell already gates on a session and an admin role.

       ADMIN ITSELF IS DROPPED FROM THE LIST. This menu only ever opens from
       inside `/admin`, so the row would point at the page already open behind
       it — every other row here is a way OUT, and a way to the room you are
       standing in is not one. */
    const apps = appsFor({ signedIn: true, role: role ?? null, authorsCourses }).filter(
        (app) => app.key !== "admin",
    );
    const here = currentAppKey(host, pathname);

    return (
        // NOT `relative` — the panel used to be. Anchored to this element's own
        // box, the dropdown's `top-full` measured from the BUTTON's bottom edge,
        // and the button sits centered inside a taller header row: the panel's
        // top edge landed partway up the topbar's own background rather than
        // below it. Leaving this div unpositioned lets the anchor fall through
        // to the header itself (now `relative`, see admin/layout.tsx), so
        // `top-full` on the panel below resolves against the whole bar.
        <div ref={ref}>
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-8 h-8 cw-surface-2 cw-text rounded-full flex items-center justify-center text-xs font-bold ring-1 ring-[var(--cw-border)] hover:ring-2 hover:ring-[var(--cw-border)] transition-all overflow-hidden"
                title={email ?? ""}
            >
                {avatarUrl ? (
                    <Image
                        src={avatarUrl}
                        alt={email ?? "User avatar"}
                        width={32}
                        height={32}
                        unoptimized
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    initial
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-52 cw-surface-solid border cw-border rounded-xl cw-shadow overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {email && (
                        <div className="px-4 py-3 border-b cw-border space-y-1">
                            <p className="text-xs cw-muted truncate">{email}</p>
                            {role ? (
                                <p className="text-[11px] cw-text font-medium">
                                    {t("menu_profile_role")}: <span className="capitalize">{role}</span>
                                </p>
                            ) : null}
                        </div>
                    )}
                    <div className="py-1 border-b cw-border">
                        {/* The panel's own root can only ever lead deeper into the
                            panel — nothing in it leaves the admin surface, which is
                            exactly what made `signOut()` the sole way out before this
                            menu existed. This row is that exit: the public home, first,
                            above the account's other applications. */}
                        <Link
                            href="/"
                            onClick={() => setOpen(false)}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm cw-text hover:bg-[var(--cw-surface-2)] transition-colors"
                        >
                            {t("menu_platform_home")}
                        </Link>
                    </div>
                    {apps.length > 0 ? (
                        <div className="py-1 border-b cw-border">
                            {apps.map((app) => {
                                const href = appHref(app, host);
                                const current = app.key === here;
                                return (
                                    <a
                                        key={app.key}
                                        href={href}
                                        onClick={() => setOpen(false)}
                                        aria-current={current ? "page" : undefined}
                                        className={`w-full flex items-center gap-2 px-4 py-3 text-sm cw-text hover:bg-[var(--cw-surface-2)] transition-colors ${current ? "font-semibold" : ""}`}
                                    >
                                        {app.label}
                                    </a>
                                );
                            })}
                        </div>
                    ) : null}
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm cw-text hover:bg-[var(--cw-surface-2)] transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        {t("menu_signout")}
                    </button>
                </div>
            )}
        </div>
    );
}
