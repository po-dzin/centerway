"use client";

import Link from "next/link";
import { ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { I18nProvider, useI18n } from "@/components/I18nProvider";
import { PlatformAccountMenu } from "@/components/platform/layout/PlatformAccountMenu";
import { InteractionInkIcon, InteractionInkLabel } from "@/components/platform/InteractionInk";
import { ToastProvider } from "@/components/ToastProvider";
import { supabaseClient } from "@/lib/supabaseClient";
import { ADMIN_ROLE_CACHE_KEY, ADMIN_ROLE_CACHE_TTL_MS, isAdminRole } from "@/lib/platform/adminRole";
import { AuthChangeEvent, Session } from "@supabase/supabase-js";

/* THE PRODUCT'S OWN HAND (2026-08-28). These were a borrowed outline set —
   nine inline feather-style SVGs at stroke 1.8 on a 24 grid, drawn by nobody
   here — sitting in the one route that had also kept its own palette and its
   own theme class. The sprite is the system's answer: baked geometry with the
   wobble already in it, one stroke weight, `currentColor`, no filter pass.

   Two of the nine had no glyph to move to and both were resolved rather than
   approximated: `chart` was added to `icon-glyphs.mjs` for analytics (the
   dashboard is the one screen whose subject IS measurement), and background
   jobs took `clock` — a queue is a thing that has not happened yet, which the
   gear it used to wear did not say. `settings` stays with the system tab,
   where a gear means what a gear means. */
const NAV_GLYPH = {
    analytics: "chart",
    orders: "price",
    customers: "user",
    jobs: "clock",
    access: "lock",
    catalog: "document",
    system: "settings",
} as const satisfies Record<string, CwIconName>;


function AdminShell({ children }: { children: ReactNode }) {
    const { t } = useI18n();
    const pathname = usePathname();
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [authInitialized, setAuthInitialized] = useState(false);
    const [roleInitialized, setRoleInitialized] = useState(false);
    const roleFetchRef = useRef<{ token: string; at: number; inFlight: boolean }>({
        token: "",
        at: 0,
        inFlight: false,
    });

    const loadRole = useCallback(async (accessToken: string) => {
        /* The key and the TTL come from the shared module, not from a literal
           here: the platform header reads the same entry, and when this file
           kept its own copy of the name a bump on one side simply stopped the
           other side from ever hitting the cache. */
        const cacheKey = ADMIN_ROLE_CACHE_KEY;
        try {
            const cachedRaw = sessionStorage.getItem(cacheKey);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw) as {
                    role?: string;
                    authorsCourses?: boolean;
                    tokenTail?: string;
                    at?: number;
                };
                const tokenTail = accessToken.slice(-16);
                const fresh = typeof cached.at === "number" && Date.now() - cached.at < ADMIN_ROLE_CACHE_TTL_MS;
                if (fresh && cached.tokenTail === tokenTail && typeof cached.role === "string") {
                    setRole(cached.role);
                    setRoleInitialized(true);
                    return;
                }
            }
        } catch {
            // ignore storage read errors
        }

        const now = Date.now();
        const recentSameToken =
            roleFetchRef.current.token === accessToken && now - roleFetchRef.current.at < 60_000;
        if (roleFetchRef.current.inFlight || recentSameToken) {
            return;
        }
        roleFetchRef.current.inFlight = true;
        roleFetchRef.current.token = accessToken;
        setRoleInitialized(false);
        try {
            const res = await fetch("/api/admin/bootstrap-role", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (!res.ok) {
                if (res.status >= 500) return;
                setRole(null);
                return;
            }
            const payload = (await res.json().catch(() => ({}))) as {
                role?: string;
                authorsCourses?: boolean;
            };
            const nextRole = typeof payload.role === "string" ? payload.role : null;
            const nextAuthors = payload.authorsCourses === true;
            setRole(nextRole);
            if (nextRole) {
                try {
                    sessionStorage.setItem(
                        cacheKey,
                        JSON.stringify({
                            role: nextRole,
                            authorsCourses: nextAuthors,
                            tokenTail: accessToken.slice(-16),
                            at: Date.now(),
                        })
                    );
                } catch {
                    // ignore storage write errors
                }
            }
        } catch {
            // keep previous role on transient network errors
        } finally {
            roleFetchRef.current.at = Date.now();
            roleFetchRef.current.inFlight = false;
            setRoleInitialized(true);
        }
    }, []);

    useEffect(() => {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.access_token) {
                void loadRole(session.access_token);
            } else {
                setRole(null);
                setRoleInitialized(true);
            }
            setAuthInitialized(true);
        });

        const {
            data: { subscription },
        } = supabaseClient.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
            setSession(session);
            if (event === "SIGNED_OUT") {
                setRole(null);
                setRoleInitialized(true);
            } else if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.access_token) {
                void loadRole(session.access_token);
            } else {
                setRoleInitialized(true);
            }
            setAuthInitialized(true);
        });

        return () => subscription.unsubscribe();
    }, [loadRole]);

    useEffect(() => {
        if (!authInitialized || !roleInitialized) return;
        if (!pathname?.startsWith("/admin")) return;
        if (pathname === "/admin") return;
        if (!session || !isAdminRole(role)) {
            router.replace("/admin");
        }
    }, [authInitialized, roleInitialized, pathname, session, role, router]);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!session?.access_token) return;
        if (!pathname?.startsWith("/admin")) return;

        const now = Date.now();
        const JOBS_PULSE_MS = 60 * 1000;
        // Materialized analytics refresh is deliberately infrequent because
        // the dashboard API now carries its own short server-side cache.
        const ANALYTICS_PULSE_MS = 30 * 60 * 1000;
        const jobsKey = "cw_admin_jobs_pulse_at";
        const analyticsKey = "cw_admin_analytics_pulse_at";

        const getLastTs = (key: string) => {
            try {
                return Number(sessionStorage.getItem(key) || "0");
            } catch {
                return 0;
            }
        };

        const setLastTs = (key: string, value: number) => {
            try {
                sessionStorage.setItem(key, String(value));
            } catch {
                // ignore storage write errors
            }
        };

        const shouldRefreshAnalytics = pathname.startsWith("/admin/analytics");
        const jobsDue = now - getLastTs(jobsKey) >= JOBS_PULSE_MS;
        const analyticsDue = shouldRefreshAnalytics && (now - getLastTs(analyticsKey) >= ANALYTICS_PULSE_MS);

        if (!jobsDue && !analyticsDue) return;

        const query = new URLSearchParams();
        if (analyticsDue) query.set("refreshAnalytics", "1");
        if (analyticsDue) query.set("refreshMeta", "1");
        const url = `/api/admin/system/pulse${query.toString() ? `?${query.toString()}` : ""}`;
        fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {
            // best-effort background pulse
        });

        if (jobsDue) setLastTs(jobsKey, now);
        if (analyticsDue) setLastTs(analyticsKey, now);
    }, [pathname, session?.access_token]);

    const navItems = [
        { key: "nav_analytics" as const, href: "/admin/analytics", icon: NAV_GLYPH.analytics, active: true },
        { key: "nav_orders" as const, href: "/admin/orders", icon: NAV_GLYPH.orders, active: true },
        { key: "nav_customers" as const, href: "/admin/customers", icon: NAV_GLYPH.customers, active: true },
        { key: "nav_operations" as const, href: "/admin/jobs", icon: NAV_GLYPH.jobs, active: true },
        { key: "nav_access" as const, href: "/admin/access", icon: NAV_GLYPH.access, active: true },
        { key: "nav_catalog" as const, href: "/admin/catalog", icon: NAV_GLYPH.catalog, active: true },
        { key: "nav_system" as const, href: "/admin/system", icon: NAV_GLYPH.system, active: true },
    ];
    const isSelectedNav = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href));

    return (
        <div className="cw-admin-theme flex h-dvh md:h-screen overflow-hidden font-sans transition-colors duration-300">
            {/* Sidebar — THE BAR'S MATERIAL TURNED ON ITS SIDE. It painted
                `cw-surface-2`, the sunk paper, which is the one thing the
                topbar stopped being: two chrome surfaces meeting at a right
                angle in two different colours. Same `data-cw-material="chrome"`
                as the bar above it, and no rule between them — the rail is
                bounded by its own material, not by a drawn line. */}
            <aside
                data-cw-material="chrome"
                className={`${expanded ? "w-56" : "w-16"} hidden md:flex shrink-0 h-full flex-col min-h-0 transition-all duration-300 ease-in-out overflow-hidden`}
            >
                {/* Logo + Toggle */}
                <div className="h-[3.25rem] md:h-14 flex items-center justify-between px-3 border-b cw-border shrink-0">
                    {expanded && (
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold cw-text whitespace-nowrap">{t("sidebar_title")}</p>
                            <p className="text-[9px] cw-muted uppercase font-semibold tracking-widest whitespace-nowrap">{t("sidebar_subtitle")}</p>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setExpanded(v => !v)}
                        title={expanded ? t("common_collapse") : t("common_expand")}
                        aria-expanded={expanded}
                        className={`${expanded ? "" : "mx-auto"} cw-icon-btn shrink-0`}
                    >
                        {/* Points AT the edge it will move: left to close, right to open. */}
                        <InteractionInkIcon>
                            <Icon
                                name="chevron-right"
                                size={16}
                                className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                            />
                        </InteractionInkIcon>
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex flex-col gap-0.5 p-2 mt-1 flex-1 min-h-0 overflow-y-auto">
                    {navItems.map(({ key, href, icon, active }) => {
                        const isSelected = isSelectedNav(href);

                        return (
                            <Link
                                key={key}
                                href={href}
                                prefetch={false}
                                title={t(key)}
                                aria-current={active && isSelected ? "page" : undefined}
                                className={`cw-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm group relative
                                    ${active
                                        ? isSelected
                                            ? "cw-nav-link-active"
                                            : ""
                                        : "cw-muted opacity-40 cursor-not-allowed pointer-events-none"
                                    }
                                    ${!expanded ? "justify-center" : ""}
                                `}
                            >
                                <InteractionInkIcon><Icon name={icon} size={20} /></InteractionInkIcon>
                                {expanded && (
                                    <InteractionInkLabel>{t(key)}</InteractionInkLabel>
                                )}
                                {/* Tooltip when collapsed */}
                                {!expanded && (
                                    <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-md cw-surface border cw-border cw-text text-xs font-medium px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 cw-shadow">
                                        {t(key)}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col min-w-0 min-h-0">
                {/* THE PLATFORM'S BAR, NOT A SECOND ONE. This was `border-b cw-border
                    cw-surface-2` — an opaque sunk panel with a hairline — while
                    every other topbar in the product is chrome glass with a
                    soft shadow and a curved lower edge. `data-cw-material` is
                    where that material is named; see the "chrome" note in
                    globals.css. */}
                <header
                    data-cw-material="chrome"
                    className="h-[3.25rem] md:h-14 shrink-0 flex items-center justify-between sm:justify-end px-3 sm:px-4 md:px-8 sticky top-0 z-20 transition-colors duration-300"
                >
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(true)}
                        className="md:hidden cw-icon-btn"
                        title={t("common_expand")}
                        aria-label={t("common_expand")}
                        aria-expanded={mobileMenuOpen}
                    >
                        <InteractionInkIcon><Icon name="menu" size={18} /></InteractionInkIcon>
                    </button>
                    <div className="flex items-center gap-2 md:gap-4">
                        <LanguageSwitcher />
                        {/* THE SAME CONTROL AS EVERY OTHER SHELL (2026-08-29). Used
                            to be a bespoke Tailwind dropdown whose one row was
                            `signOut()`, then grew a second, ad hoc hover
                            (`hover:bg-[var(--cw-surface-2)]`) that matched nothing
                            else in the panel. `apps.ts` already made the two menus
                            agree on WHERE an account may go; this makes them the
                            same control, so they cannot drift on how a row answers
                            a pointer again. `exclude` drops the admin row — a menu
                            opened from inside `/admin` pointing back at `/admin` is
                            a way to the room already standing in it. Theme lives
                            inside this menu now (`PlatformThemeControl`), which is
                            why the bar's own `ThemeSwitcher` button is gone. */}
                        <PlatformAccountMenu compact exclude={["admin"]} />
                    </div>
                </header>
                <div data-admin-scroll className="custom-scrollbar flex-1 px-3 py-3 sm:px-4 sm:py-4 md:p-8 overflow-y-auto overflow-x-hidden w-full min-h-0 pb-4 md:pb-8">
                    {/* One content column for every tab, on the platform's own
                        guide — see `.cw-admin-content`. The scroll viewport stays
                        the outer element: AdminPagination scrolls it by
                        `[data-admin-scroll]`. */}
                    <div className="cw-admin-content">{children}</div>
                </div>
                {mobileMenuOpen ? (
                    <div className="md:hidden fixed inset-0 z-40">
                        {/* The product's one shield — see `data-cw-scrim` in
                            globals.css. It was `bg-black/45`, a raw dim: the
                            only place in the platform that darkened a page with
                            ink rather than continuing the bar's material over
                            it, and the reason this drawer read brown against
                            the chrome above it. */}
                        <button
                            type="button"
                            data-cw-scrim="chrome"
                            className="absolute inset-0"
                            onClick={() => setMobileMenuOpen(false)}
                            aria-label={t("common_close")}
                        />
                        <aside
                            data-cw-material="chrome"
                            className="absolute left-0 top-0 h-full w-72 max-w-[85vw] p-3 flex flex-col"
                        >
                            <div className="flex items-center justify-between pb-3 border-b cw-border">
                                <div>
                                    <p className="text-sm font-bold cw-text">{t("sidebar_title")}</p>
                                    <p className="text-[9px] cw-muted uppercase font-semibold tracking-widest">{t("sidebar_subtitle")}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="cw-icon-btn"
                                    title={t("common_close")}
                                    aria-label={t("common_close")}
                                >
                                    <InteractionInkIcon><Icon name="close" size={16} /></InteractionInkIcon>
                                </button>
                            </div>
                            <nav className="mt-3 flex flex-col gap-1 overflow-y-auto">
                                {navItems.map(({ key, href, icon, active }) => {
                                    const isSelected = isSelectedNav(href);
                                    return (
                                        <Link
                                            key={key}
                                            href={href}
                                            prefetch={false}
                                            title={t(key)}
                                            aria-current={active && isSelected ? "page" : undefined}
                                            className={`cw-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                                                ${active
                                                    ? isSelected
                                                        ? "cw-nav-link-active"
                                                        : ""
                                                    : "cw-muted opacity-40 cursor-not-allowed pointer-events-none"
                                                }`}
                                        >
                                            <InteractionInkIcon><Icon name={icon} size={20} /></InteractionInkIcon>
                                            <InteractionInkLabel>{t(key)}</InteractionInkLabel>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </aside>
                    </div>
                ) : null}
            </main>
        </div>
    );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <I18nProvider>
            <ToastProvider>
                <AdminShell>{children}</AdminShell>
            </ToastProvider>
        </I18nProvider>
    );
}
