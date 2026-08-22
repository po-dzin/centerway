"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
       which the shell already gates on a session and an admin role. */
    const apps = appsFor({ signedIn: true, role: role ?? null, authorsCourses });
    const here = currentAppKey(host, pathname);

    return (
        <div className="relative" ref={ref}>
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
                <div className="absolute right-0 mt-2 w-52 cw-surface-solid border cw-border rounded-xl cw-shadow overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
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
