"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";

function isAdminRole(role: string | null): boolean {
    return role === "admin" || role === "support" || role === "Admin" || role === "Support";
}

export default function AdminRootPage() {
    const { t } = useI18n();
    const router = useRouter();
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);
    const [roleLoading, setRoleLoading] = useState(false);
    const roleFetchRef = useRef<{ token: string; at: number; inFlight: boolean }>({
        token: "",
        at: 0,
        inFlight: false,
    });

    const loadRole = async (accessToken: string) => {
        const cacheKey = "cw_admin_role_cache_v1";
        try {
            const cachedRaw = sessionStorage.getItem(cacheKey);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw) as { role?: string; tokenTail?: string; at?: number };
                const tokenTail = accessToken.slice(-16);
                const fresh = typeof cached.at === "number" && Date.now() - cached.at < 5 * 60_000;
                if (fresh && cached.tokenTail === tokenTail && typeof cached.role === "string") {
                    setRole(cached.role);
                    setRoleLoading(false);
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
        setRoleLoading(true);
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
            setRoleLoading(false);
        }
    };

    useEffect(() => {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.access_token) {
                void loadRole(session.access_token);
            } else {
                setRole(null);
            }
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabaseClient.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
            setSession(nextSession);
            if ((_event === "INITIAL_SESSION" || _event === "SIGNED_IN") && nextSession?.access_token) {
                void loadRole(nextSession.access_token);
            } else if (_event === "SIGNED_OUT") {
                setRole(null);
            } else {
                // ignore TOKEN_REFRESHED and USER_UPDATED to avoid bootstrap-role spam
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!loading && !roleLoading && session && isAdminRole(role)) {
            router.replace("/admin/analytics");
        }
    }, [loading, roleLoading, session, role, router]);

    const handleSignIn = async () => {
        await supabaseClient.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/admin`,
            },
        });
    };

    if (loading || (session && roleLoading)) {
        return <div className="p-8 cw-muted animate-pulse">{t("loading")}</div>;
    }

    if (session && isAdminRole(role)) {
        return <div className="p-8 cw-muted animate-pulse">{t("loading")}</div>;
    }

    if (session && !isAdminRole(role)) {
        const email = session.user?.email ?? "unknown";
        const signOut = async () => {
            await supabaseClient.auth.signOut();
            setSession(null);
            setRole(null);
        };
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-md mx-auto">
                <div className="w-full cw-surface border cw-border rounded-2xl cw-shadow p-8 text-center space-y-4">
                    <h2 className="cw-page-title">{t("admin_access_denied_title")}</h2>
                    <p className="cw-page-subtitle">{t("admin_access_denied_subtitle")}</p>
                    <p className="text-sm cw-muted">{email}</p>
                    <button
                        onClick={signOut}
                        className="w-full cw-btn cw-surface-2 font-semibold py-3 px-4"
                    >
                        {t("menu_signout")}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-sm mx-auto">
            <div className="w-full text-center mb-8">
                <h2 className="cw-page-title mb-2">{t("login_title")}</h2>
                <p className="cw-page-subtitle">{t("login_subtitle")}</p>
            </div>

            <div className="w-full cw-surface border cw-border rounded-2xl cw-shadow p-8 transition-colors duration-300">
                <div className="space-y-6">
                    <div className="space-y-1">
                        <h3 className="text-lg font-medium cw-text">{t("login_card_title")}</h3>
                        <p className="text-xs cw-muted">{t("login_card_subtitle")}</p>
                    </div>

                    <button
                        onClick={handleSignIn}
                        className="w-full cw-btn cw-surface-2 font-semibold py-3 px-4 flex items-center justify-center gap-3"
                    >
                        <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                        {t("login_btn")}
                    </button>
                </div>
            </div>
        </div>
    );
}
