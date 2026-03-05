"use client";

import Link from "next/link";
import { ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { I18nProvider, useI18n } from "@/components/I18nProvider";
import { UserMenu } from "@/components/UserMenu";
import { ToastProvider } from "@/components/ToastProvider";
import { supabaseClient } from "@/lib/supabaseClient";
import { Session } from "@supabase/supabase-js";

const icons = {
    dashboard: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
    audit: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    customers: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    orders: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
    analytics: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
    jobs: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>,
};

function AdminShell({ children }: { children: ReactNode }) {
    const { t } = useI18n();
    const pathname = usePathname();
    const [expanded, setExpanded] = useState(false);
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabaseClient.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

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

        const url = `/api/admin/system/pulse${analyticsDue ? "?refreshAnalytics=1" : ""}`;
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
        { key: "nav_dashboard" as const, href: "/admin", icon: icons.dashboard, active: true },
        { key: "nav_audit" as const, href: "/admin/audit", icon: icons.audit, active: true },
        { key: "nav_customers" as const, href: "/admin/customers", icon: icons.customers, active: true },
        { key: "nav_orders" as const, href: "/admin/orders", icon: icons.orders, active: true },
        { key: "nav_analytics" as const, href: "/admin/analytics", icon: icons.analytics, active: true },
        { key: "nav_jobs" as const, href: "/admin/jobs", icon: icons.jobs, active: true },
    ];

    return (
        <div className="cw-admin-theme flex h-screen overflow-hidden font-sans transition-colors duration-300">
            {/* Sidebar */}
            <aside
                className={`${expanded ? "w-56" : "w-16"} shrink-0 h-full border-r cw-border cw-surface-2 flex flex-col min-h-0 transition-all duration-300 ease-in-out overflow-hidden`}
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
                        onClick={() => setExpanded(v => !v)}
                        title={expanded ? t("common_collapse") : t("common_expand")}
                        className={`${expanded ? "" : "mx-auto"} p-2 rounded-lg hover:bg-[var(--cw-accent-soft)] cw-muted transition-colors shrink-0`}
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
                        const isSelected = href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href);

                        return (
                            <Link
                                key={key}
                                href={href}
                                title={t(key)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group relative
                                    ${active
                                        ? isSelected
                                            ? "cw-text cw-surface-2"
                                            : "cw-muted hover:text-[var(--cw-text)] hover:bg-[var(--cw-surface-2)]"
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
                <header className="h-16 shrink-0 border-b cw-border cw-surface-2 flex items-center justify-end px-8 sticky top-0 z-10 transition-colors duration-300">
                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        <ThemeSwitcher />
                        <UserMenu
                            email={session?.user?.email}
                            initial={session?.user?.email ? session.user.email.charAt(0).toUpperCase() : "?"}
                            avatarUrl={session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture}
                        />
                    </div>
                </header>
                <div className="flex-1 p-8 overflow-y-auto w-full min-h-0">
                    {children}
                </div>
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
