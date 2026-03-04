"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { getErrorMessage } from "@/lib/errors";

interface Customer {
    id: string;
    email: string | null;
    phone: string | null;
    display_name: string | null;
    avatar_url: string | null;
    tags: string[];
    notes: string | null;
    tg_id: string | null;
    google_id: string | null;
    auth_user_id: string | null;
    created_at: string;
    updated_at: string;
}

interface TimelineItem {
    ts: string;
    type: "order" | "event";
    label: string;
    sub: string | null;
    id: string;
    ref?: string;
}

interface CustomerOrder {
    id: string;
    order_ref: string;
    product_code: string | null;
    amount: number | null;
    currency: string | null;
    status: string;
    created_at: string;
}

interface CustomerEvent {
    id: string;
    type: string;
    order_ref: string | null;
    payload: unknown;
    created_at: string;
}

interface ProfileData {
    customer: Customer;
    orders: CustomerOrder[];
    events: CustomerEvent[];
    timeline: TimelineItem[];
}

const LOCALE_BY_LANG = {
    ru: "ru-RU",
    en: "en-US",
} as const;

const typeColors: Record<string, string> = {
    order: "cw-status-success-badge",
    event: "cw-status-running-badge",
};

const typeIcons: Record<string, ReactNode> = {
    order: <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    event: <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
};

function Avatar({ name, url, size = 12 }: { name?: string | null; url?: string | null; size?: number }) {
    const initial = (name ?? "?").charAt(0).toUpperCase();
    const pixelSize = size * 4;
    return url ? (
        <Image
            src={url}
            alt={name ?? "avatar"}
            width={pixelSize}
            height={pixelSize}
            unoptimized
            className="rounded-2xl object-cover shrink-0"
            style={{ width: pixelSize, height: pixelSize }}
            referrerPolicy="no-referrer"
        />
    ) : (
        <div
            className="rounded-2xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-xl font-bold text-neutral-600 dark:text-neutral-300 shrink-0"
            style={{ width: pixelSize, height: pixelSize }}
        >
            {initial}
        </div>
    );
}

const orderStatusColor: Record<string, string> = {
    paid: "cw-status-success-text",
    pending: "cw-status-pending-text",
    created: "text-neutral-500",
    refunded: "cw-status-failed-text",
};

function ContactRow({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl cw-panel">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 uppercase tracking-wide shrink-0">
                {label}
            </span>
            <p className="text-xs font-medium text-neutral-900 dark:text-white truncate flex-1">{value}</p>
            {badge && (
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cw-status-success-text shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            )}
        </div>
    );
}

export default function CustomerProfilePage() {
    const { lang, t } = useI18n();
    const isRu = lang === "ru";
    const locale = LOCALE_BY_LANG[lang];
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        (async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                const res = await fetch(`/api/admin/customers/${id}`, {
                    headers: session ? { "Authorization": `Bearer ${session.access_token}` } : {}
                });
                if (res.status === 404) { router.replace("/admin/customers"); return; }
                if (!res.ok) throw new Error(`${res.status}`);
                setProfile(await res.json());
            } catch (e: unknown) {
                setError(getErrorMessage(e));
            } finally {
                setLoading(false);
            }
        })();
    }, [id, router]);

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-5 w-36 bg-neutral-100 dark:bg-neutral-800 rounded" />
                <div className="h-32 bg-neutral-100 dark:bg-neutral-800 rounded-2xl" />
                <div className="h-72 bg-neutral-100 dark:bg-neutral-800 rounded-2xl" />
            </div>
        );
    }

    if (error || !profile) {
        return <div className="p-6 text-sm cw-status-failed-text">{t("common_error")}: {error ?? t("customers_not_found")}</div>;
    }

    const { customer, orders, timeline } = profile;
    const displayName = customer.display_name ?? customer.email ?? customer.phone ?? t("customers_no_name");
    const ordersCountLabel = (() => {
        const value = orders.length;
        if (!isRu) return `${value} ${t("orders_count_en")}`;
        const mod10 = value % 10;
        const mod100 = value % 100;
        if (mod10 === 1 && mod100 !== 11) return `${value} ${t("orders_count_one")}`;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} ${t("orders_count_few")}`;
        return `${value} ${t("orders_count_many")}`;
    })();

    // Check if we have any contacts to show
    const hasContacts = customer.email || customer.phone || customer.tg_id || customer.google_id || customer.auth_user_id;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-600">
                <Link href="/admin/customers" className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
                    {t("customers_title")}
                </Link>
                <span>/</span>
                <span className="text-neutral-600 dark:text-neutral-400 truncate max-w-[240px]">{displayName}</span>
            </nav>

            {/* Profile card */}
            <div className="p-6 cw-panel">
                <div className="flex items-start gap-5">
                    <Avatar name={displayName} url={customer.avatar_url} size={14} />
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white truncate">{displayName}</h2>
                        <p className="text-xs text-neutral-400 mt-0.5 font-mono">{customer.id}</p>

                        {customer.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {customer.tags.map((tag) => (
                                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                        {customer.notes && (
                            <p className="mt-3 text-sm cw-page-subtitle italic">{customer.notes}</p>
                        )}
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-xs text-neutral-400">{t("customers_profile_created")}</p>
                        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mt-0.5">
                            {new Date(customer.created_at).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-neutral-400 mt-2">
                            {ordersCountLabel}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sidebar: customer links + orders summary */}
                <div className="lg:col-span-1 space-y-5">
                    {/* Contacts */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{t("customers_profile_contacts")}</h3>
                        {!hasContacts ? (
                            <p className="text-xs text-neutral-400">{t("customers_profile_contacts_empty")}</p>
                        ) : (
                            <div className="space-y-2">
                                {customer.email && <ContactRow label="Email" value={customer.email} badge={true} />}
                                {customer.phone && <ContactRow label="Phone" value={customer.phone} badge={true} />}
                                {customer.tg_id && <ContactRow label="Telegram" value={customer.tg_id} />}
                                {customer.google_id && <ContactRow label="Google" value={customer.google_id} />}
                                {customer.auth_user_id && <ContactRow label="Auth User" value={customer.auth_user_id} />}
                            </div>
                        )}
                    </div>

                    {/* Orders summary */}
                    {orders.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{t("orders_title")}</h3>
                            {orders.map((o) => (
                                <div key={o.id} className="p-3 rounded-xl cw-panel">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 truncate">{o.order_ref}</span>
                                        <span className={`text-xs font-semibold ${orderStatusColor[o.status] ?? "text-neutral-500"}`}>{o.status}</span>
                                    </div>
                                    {o.amount && (
                                        <p className="text-sm font-bold text-neutral-900 dark:text-white mt-1">
                                            {o.amount} <span className="text-xs font-normal text-neutral-500">{o.currency}</span>
                                        </p>
                                    )}
                                    <p className="text-[10px] text-neutral-400 mt-1">{o.product_code}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Timeline */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        {t("customers_profile_timeline")} <span className="font-normal text-neutral-400">({timeline.length})</span>
                    </h3>

                    {timeline.length === 0 ? (
                        <p className="text-xs text-neutral-400 py-4">{t("customers_profile_no_events")}</p>
                    ) : (
                        <div className="space-y-3">
                            {timeline.map((item, i) => (
                                <div key={`${item.id}-${i}`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`relative z-10 shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center ${typeColors[item.type]}`}>
                                            {typeIcons[item.type]}
                                        </div>
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <p className="text-sm font-medium text-neutral-900 dark:text-white leading-tight">{item.label}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {item.sub && <span className="text-xs text-neutral-500 dark:text-neutral-400">{item.sub}</span>}
                                                <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
                                                    {new Date(item.ts).toLocaleString(locale, {
                                                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {i < timeline.length - 1 && (
                                        <div className="ml-[18px] mt-1 h-3 w-px bg-neutral-200 dark:bg-neutral-800" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
