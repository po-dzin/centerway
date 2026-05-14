"use client";

import Link from "next/link";
import { ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { I18nProvider, useI18n } from "@/components/I18nProvider";
import { UserMenu } from "@/components/UserMenu";
import { ToastProvider } from "@/components/ToastProvider";
import { supabaseClient } from "@/lib/supabaseClient";
import { AuthChangeEvent, Session } from "@supabase/supabase-js";

const icons = {
    dashboard: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
    audit: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    customers: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    orders: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
    analytics: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
    jobs: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>,
    system: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" /></svg>,
};

function isAdminRole(role: string | null): boolean {
    return role === "admin" || role === "support" || role === "Admin" || role === "Support";
}

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
        const cacheKey = "cw_admin_role_cache_v1";
        try {
            const cachedRaw = sessionStorage.getItem(cacheKey);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw) as { role?: string; tokenTail?: string; at?: number };
                const tokenTail = accessToken.slice(-16);
                const fresh = typeof cached.at === "number" && Date.now() - cached.at < 5 * 60_000;
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
            const payload = (await res.json().catch(() => ({}))) as { role?: string };
            const nextRole = typeof payload.role === "string" ? payload.role : null;
            setRole(nextRole);
            if (nextRole) {
                try {
                    sessionStorage.setItem(
                        cacheKey,
                        JSON.stringify({ role: nextRole, tokenTail: accessToken.slice(-16), at: Date.now() })
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
        const ANALYTICS_PULSE_MS = 15 * 60 * 1000;
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
        { key: "nav_analytics" as const, href: "/admin/analytics", icon: icons.analytics, active: true },
        { key: "nav_orders" as const, href: "/admin/orders", icon: icons.orders, active: true },
        { key: "nav_customers" as const, href: "/admin/customers", icon: icons.customers, active: true },
        { key: "nav_operations" as const, href: "/admin/jobs", icon: icons.jobs, active: true },
        { key: "nav_system" as const, href: "/admin/system", icon: icons.system, active: true },
    ];
    const isSelectedNav = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href));

    return (
        <div className="cw-admin-theme flex h-dvh md:h-screen overflow-hidden font-sans transition-colors duration-300">
            {/* Sidebar */}
            <aside
                className={`${expanded ? "w-56" : "w-16"} hidden md:flex shrink-0 h-full border-r cw-border cw-surface-2 flex-col min-h-0 transition-all duration-300 ease-in-out overflow-hidden`}
            >
                {/* Logo + Toggle */}
                <div className="h-16 flex items-center justify-between px-3 border-b cw-border shrink-0">
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
                        className={`${expanded ? "" : "mx-auto"} cw-icon-btn shrink-0`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                            className={`transition-transform duration-300 ${expanded ? "" : "rotate-180"}`}>
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
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
                                <span className="shrink-0">{icon}</span>
                                {expanded && (
                                    <span className="truncate whitespace-nowrap text-sm">{t(key)}</span>
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
                <header className="h-14 md:h-16 shrink-0 border-b cw-border cw-surface-2 flex items-center justify-between sm:justify-end px-3 sm:px-4 md:px-8 sticky top-0 z-20 transition-colors duration-300">
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(true)}
                        className="md:hidden cw-icon-btn"
                        title={t("common_expand")}
                        aria-label={t("common_expand")}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-2 md:gap-4">
                        <LanguageSwitcher />
                        <ThemeSwitcher />
                        <UserMenu
                            email={session?.user?.email}
                            role={role}
                            initial={session?.user?.email ? session.user.email.charAt(0).toUpperCase() : "?"}
                            avatarUrl={session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture}
                        />
                    </div>
                </header>
                <div data-admin-scroll className="custom-scrollbar flex-1 px-3 py-3 sm:px-4 sm:py-4 md:p-8 overflow-y-auto overflow-x-hidden w-full min-h-0 pb-4 md:pb-8">
                    {children}
                </div>
                {mobileMenuOpen ? (
                    <div className="md:hidden fixed inset-0 z-40">
                        <button
                            type="button"
                            className="absolute inset-0 bg-black/45"
                            onClick={() => setMobileMenuOpen(false)}
                            aria-label={t("common_close")}
                        />
                        <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] cw-surface-solid border-r cw-border p-3 flex flex-col">
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
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
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
                                            className={`cw-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                                                ${active
                                                    ? isSelected
                                                        ? "cw-nav-link-active"
                                                        : ""
                                                    : "cw-muted opacity-40 cursor-not-allowed pointer-events-none"
                                                }`}
                                        >
                                            <span className="shrink-0">{icon}</span>
                                            <span className="truncate">{t(key)}</span>
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
