"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

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

interface ProfileData {
    customer: Customer;
    orders: any[];
    events: any[];
    timeline: TimelineItem[];
}

const typeColors: Record<string, string> = {
    order: "bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900",
    event: "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900",
};

const typeIcons: Record<string, ReactNode> = {
    order: <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    event: <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
};

function Avatar({ name, url, size = 12 }: { name?: string | null; url?: string | null; size?: number }) {
    const initial = (name ?? "?").charAt(0).toUpperCase();
    return url ? (
        <img src={url} alt={name ?? "avatar"} className={`w-${size} h-${size} rounded-2xl object-cover`} referrerPolicy="no-referrer" />
    ) : (
        <div className={`w-${size} h-${size} rounded-2xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-xl font-bold text-neutral-600 dark:text-neutral-300 shrink-0`}>
            {initial}
        </div>
    );
}

const orderStatusColor: Record<string, string> = {
    paid: "text-green-600 dark:text-green-400",
    pending: "text-yellow-600 dark:text-yellow-400",
    created: "text-neutral-500",
    refunded: "text-red-600 dark:text-red-400",
};

function ContactRow({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 uppercase tracking-wide shrink-0">
                {label}
            </span>
            <p className="text-xs font-medium text-neutral-900 dark:text-white truncate flex-1">{value}</p>
            {badge && (
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            )}
        </div>
    );
}

export default function CustomerProfilePage() {
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
            } catch (e: any) {
                setError(e.message);
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
        return <div className="p-6 text-sm text-red-600 dark:text-red-400">Ошибка: {error ?? "Клиент не найден"}</div>;
    }

    const { customer, orders, timeline } = profile;
    const displayName = customer.display_name ?? customer.email ?? customer.phone ?? "Без имени";

    // Check if we have any contacts to show
    const hasContacts = customer.email || customer.phone || customer.tg_id || customer.google_id || customer.auth_user_id;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-600">
                <Link href="/admin/customers" className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
                    Клиенты
                </Link>
                <span>/</span>
                <span className="text-neutral-600 dark:text-neutral-400 truncate max-w-[240px]">{displayName}</span>
            </nav>

            {/* Profile card */}
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50">
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
                            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 italic">{customer.notes}</p>
                        )}
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-xs text-neutral-400">Создан</p>
                        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mt-0.5">
                            {new Date(customer.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-neutral-400 mt-2">{orders.length} заказ{orders.length === 1 ? "" : orders.length < 5 ? "а" : "ов"}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sidebar: customer links + orders summary */}
                <div className="lg:col-span-1 space-y-5">
                    {/* Contacts */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Контакты и каналы</h3>
                        {!hasContacts ? (
                            <p className="text-xs text-neutral-400">Нет сохраненных контактов</p>
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
                            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Заказы</h3>
                            {orders.map((o) => (
                                <div key={o.id} className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40">
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
                <div className="lg:col-span-2 space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        Timeline <span className="font-normal text-neutral-400">({timeline.length})</span>
                    </h3>

                    {timeline.length === 0 ? (
                        <p className="text-xs text-neutral-400 py-4">Нет событий</p>
                    ) : (
                        <div className="relative space-y-1">
                            <div className="absolute left-[18px] top-2 bottom-2 w-px bg-neutral-200 dark:bg-neutral-800" />
                            {timeline.map((item, i) => (
                                <div key={`${item.id}-${i}`} className="flex items-start gap-3">
                                    <div className={`relative z-10 shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center mt-0.5 ${typeColors[item.type]}`}>
                                        {typeIcons[item.type]}
                                    </div>
                                    <div className="flex-1 min-w-0 py-1.5">
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white leading-tight">{item.label}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {item.sub && <span className="text-xs text-neutral-500 dark:text-neutral-400">{item.sub}</span>}
                                            <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
                                                {new Date(item.ts).toLocaleString("ru-RU", {
                                                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
