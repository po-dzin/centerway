"use client";

import { useEffect, useState } from "react";
import { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabaseClient } from "../../lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";

export default function AdminDashboardPage() {
    const { t } = useI18n();
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                checkRole(session.user.id);
            } else {
                setLoading(false);
            }
        });

        const {
            data: { subscription },
        } = supabaseClient.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
            setSession(session);
            if (session?.user) {
                checkRole(session.user.id);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkRole = async (userId: string) => {
        try {
            // First attempt to get role directly (relies on RLS)
            const { data, error } = await supabaseClient
                .from("user_roles")
                .select("role")
                .eq("user_id", userId)
                .single();

            if (!error && data) {
                setRole(data.role);
            }
        } catch (err) {
            console.error("checkRole error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSignIn = async () => {
        await supabaseClient.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/admin`,
            },
        });
    };

    if (loading) {
        return <div className="p-8 cw-muted animate-pulse">{t("loading")}</div>;
    }

    if (!session) {
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
                            className="w-full cw-surface-2 border cw-border cw-text font-semibold py-3 px-4 rounded-xl hover:bg-[var(--cw-accent-soft)] transition-colors flex items-center justify-center gap-3"
                        >
                            {/* Google Logo */}
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

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="cw-page-title mb-2">{t("dashboard_title")}</h2>
                    <p className="cw-page-subtitle">{t("dashboard_subtitle")}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-5 cw-panel transition-colors duration-300">
                    <h3 className="cw-muted text-sm font-medium mb-1">{t("dashboard_role_label")}</h3>
                    <div className="text-2xl font-semibold cw-text capitalize">{role || (t("dashboard_role_unknown") as string)}</div>
                </div>
                <div className="p-5 cw-panel transition-colors duration-300">
                    <h3 className="cw-muted text-sm font-medium mb-1">{t("dashboard_email_label")}</h3>
                    <div className="text-lg font-semibold cw-text truncate" title={session.user.email}>{session.user.email}</div>
                </div>
                <div className="p-5 cw-panel transition-colors duration-300">
                    <h3 className="cw-muted text-sm font-medium mb-1">{t("dashboard_audit_label")}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-2 h-2 rounded-full cw-status-success-dot"></div>
                        <span className="cw-text text-sm font-medium">{t("dashboard_audit_status")}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
