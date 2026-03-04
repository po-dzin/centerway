"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/components/I18nProvider";
import { supabaseClient } from "@/lib/supabaseClient";
import { getErrorMessage } from "@/lib/errors";

interface Identity {
    id: string;
    display_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    tags: string[];
    created_at: string;
    matched_link?: { type: string; value: string };
}

const LOCALE_BY_LANG = {
    ru: "ru-RU",
    en: "en-US",
} as const;

function Avatar({ name, url }: { name?: string | null; url?: string | null }) {
    const initial = name?.charAt(0)?.toUpperCase() ?? "?";
    return url ? (
        <Image
            src={url}
            alt={name ?? "avatar"}
            width={36}
            height={36}
            unoptimized
            className="w-9 h-9 rounded-full object-cover"
            referrerPolicy="no-referrer"
        />
    ) : (
        <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-sm font-semibold text-neutral-600 dark:text-neutral-300">
            {initial}
        </div>
    );
}

export default function CustomersPage() {
    const { lang, t } = useI18n();
    const isRu = lang === "ru";
    const locale = LOCALE_BY_LANG[lang];
    const [q, setQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [data, setData] = useState<Identity[]>([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(0);
    const LIMIT = 50;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Debounce search query
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedQ(q);
            setPage(0); // Reset page on query search
        }, 350);
        return () => clearTimeout(t);
    }, [q]);

    const fetchCustomers = useCallback(async (query: string, pageIndex: number) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query) params.set("q", query);
            params.set("limit", String(LIMIT));
            params.set("offset", String(pageIndex * LIMIT));

            const url = `/api/admin/customers?${params}`;
            const { data: { session } } = await supabaseClient.auth.getSession();
            const res = await fetch(url, {
                headers: session ? { "Authorization": `Bearer ${session.access_token}` } : {}
            });
            if (!res.ok) throw new Error(`${res.status}`);
            const json = await res.json();
            setData(json.data ?? []);
            setCount(json.count ?? 0);
        } catch (e: unknown) {
            setError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [LIMIT]);

    useEffect(() => {
        fetchCustomers(debouncedQ, page);
    }, [debouncedQ, page, fetchCustomers]);

    const getResultsLabel = (value: number) => {
        if (value === 0) return t("customers_results_none");
        if (!isRu) return `${value} ${value === 1 ? t("customers_results_record_one") : t("customers_results_record_many")}`;
        const mod10 = value % 10;
        const mod100 = value % 100;
        if (mod10 === 1 && mod100 !== 11) return `${value} ${t("customers_results_record_one")}`;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} ${t("customers_results_record_few")}`;
        return `${value} ${t("customers_results_record_many")}`;
    };
    const querySuffix = (() => {
        if (!debouncedQ) return "";
        if (isRu) return ` ${t("customers_results_query_prefix")}«${debouncedQ}»`;
        return ` ${t("customers_results_query_prefix_en")}"${debouncedQ}"`;
    })();

    const totalPages = Math.ceil(count / LIMIT);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="cw-page-title mb-1">
                    {t("customers_title")}
                </h2>
                <p className="cw-page-subtitle">
                    {t("customers_subtitle")}
                </p>
            </div>

            {/* Search bar */}
            <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-neutral-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </div>
                <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("customers_search_placeholder")}
                    className="cw-input pl-10 pr-4 py-2.5 text-sm focus:outline-none transition-all"
                />
                {q && (
                    <button
                        onClick={() => setQ("")}
                        className="absolute inset-y-0 right-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Results header */}
            {!loading && (
                <p className="text-xs text-neutral-400 dark:text-neutral-600">
                    {getResultsLabel(count)}
                    {querySuffix}
                </p>
            )}

            {/* State: loading */}
            {loading && (
                <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 animate-pulse" />
                    ))}
                </div>
            )}

            {/* State: error */}
            {error && !loading && (
                <div className="p-4 rounded-xl text-sm cw-alert-failed">
                    {t("customers_loading_error")}: {error}
                </div>
            )}

            {/* State: empty */}
            {!loading && !error && data.length === 0 && (
                <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                            className="text-neutral-400">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                        {debouncedQ ? t("customers_not_found") : t("customers_empty")}
                    </p>
                </div>
            )}

            {/* Customer list */}
            {!loading && !error && data.length > 0 && (
                <div className="space-y-1.5">
                    {data.map((identity) => (
                        <Link
                            key={identity.id}
                            href={`/admin/customers/${identity.id}`}
                            className="cw-list-item flex items-center gap-4 p-4 group"
                        >
                            <Avatar name={identity.display_name ?? identity.email ?? identity.phone} url={identity.avatar_url} />

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                                    {identity.display_name ?? identity.email ?? identity.phone ?? <span className="text-neutral-400 italic">{t("customers_no_name")}</span>}
                                </p>
                                {identity.matched_link ? (
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                        <span className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded text-[10px] mr-1">
                                            {identity.matched_link.type}
                                        </span>
                                        {identity.matched_link.value}
                                    </p>
                                ) : (
                                    <p className="text-xs text-neutral-400 dark:text-neutral-500">
                                        {new Date(identity.created_at).toLocaleDateString(locale, {
                                            day: "2-digit", month: "short", year: "numeric"
                                        })}
                                    </p>
                                )}
                            </div>

                            {identity.tags?.length > 0 && (
                                <div className="hidden sm:flex gap-1 flex-wrap justify-end max-w-[200px]">
                                    {identity.tags.slice(0, 3).map((tag) => (
                                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                className="text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-500 dark:group-hover:text-neutral-500 transition-colors flex-shrink-0">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {!loading && !error && count > 0 && totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                        title={t("common_prev")}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>

                    <div className="cw-page-subtitle">
                        {t("common_page")} <span className="font-medium text-neutral-900 dark:text-white">{page + 1}</span> {t("common_of")} <span className="font-medium text-neutral-900 dark:text-white">{totalPages}</span>
                    </div>

                    <button
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                        title={t("common_next")}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
