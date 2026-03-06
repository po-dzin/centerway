"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/components/I18nProvider";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { supabaseClient } from "@/lib/supabaseClient";
import { getErrorMessage } from "@/lib/errors";
import { getAdminLocale } from "@/lib/adminLocale";

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
        <div className="w-9 h-9 rounded-full cw-surface-2 flex items-center justify-center text-sm font-semibold cw-muted">
            {initial}
        </div>
    );
}

export default function CustomersPage() {
    const { lang, t } = useI18n();
    const isRu = lang === "ru";
    const locale = getAdminLocale(lang);
    const [q, setQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [data, setData] = useState<Identity[]>([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(0);
    const LIMIT = 50;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestSeq = useRef(0);
    const abortRef = useRef<AbortController | null>(null);

    // Debounce search query
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedQ(q);
            setPage(0); // Reset page on query search
        }, 350);
        return () => clearTimeout(t);
    }, [q]);

    const fetchCustomers = useCallback(async (query: string, pageIndex: number) => {
        requestSeq.current += 1;
        const reqId = requestSeq.current;
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        setLoading(true);
        setError(null);
        setData([]);
        try {
            const params = new URLSearchParams();
            if (query) params.set("q", query);
            params.set("limit", String(LIMIT));
            params.set("offset", String(pageIndex * LIMIT));

            const url = `/api/admin/customers?${params}`;
            const { data: { session } } = await supabaseClient.auth.getSession();
            const res = await fetch(url, {
                signal: ctrl.signal,
                headers: session ? { "Authorization": `Bearer ${session.access_token}` } : {}
            });
            if (!res.ok) throw new Error(`${res.status}`);
            const json = await res.json();
            if (reqId !== requestSeq.current) return;
            setData(json.data ?? []);
            setCount(json.count ?? 0);
        } catch (e: unknown) {
            if (ctrl.signal.aborted) return;
            if (reqId !== requestSeq.current) return;
            setError(getErrorMessage(e));
        } finally {
            if (reqId !== requestSeq.current) return;
            setLoading(false);
        }
    }, [LIMIT]);

    useEffect(() => {
        fetchCustomers(debouncedQ, page);
    }, [debouncedQ, page, fetchCustomers]);

    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

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
        return ` ${t("customers_results_query_prefix")}"${debouncedQ}"`;
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
            <AdminSearchInput
                value={q}
                onChange={setQ}
                placeholder={t("customers_search_placeholder")}
                onClear={q ? () => setQ("") : undefined}
            />

            {/* Results header */}
            {!loading && (
                <p className="text-xs cw-muted">
                    {getResultsLabel(count)}
                    {querySuffix}
                </p>
            )}

            {/* State: loading */}
            {loading && (
                <AdminLoadingState variant="skeleton" rows={5} rowClassName="h-16" />
            )}

            {/* State: error */}
            {error && !loading && (
                <div className="p-4 rounded-xl text-sm cw-alert-failed">
                    {t("customers_loading_error")}: {error}
                </div>
            )}

            {/* State: empty */}
            {!loading && !error && data.length === 0 && (
                <AdminEmptyState
                    className="py-16"
                    icon={(
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                            className="cw-muted">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    )}
                    description={debouncedQ ? t("customers_not_found") : t("customers_empty")}
                />
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
                                <p className="text-sm font-medium cw-text truncate">
                                    {identity.display_name ?? identity.email ?? identity.phone ?? <span className="cw-muted italic">{t("customers_no_name")}</span>}
                                </p>
                                {identity.matched_link ? (
                                    <p className="text-xs cw-muted truncate">
                                        <span className="font-mono cw-surface-2 px-1 py-0.5 rounded text-[10px] mr-1">
                                            {identity.matched_link.type}
                                        </span>
                                        {identity.matched_link.value}
                                    </p>
                                ) : (
                                    <p className="text-xs cw-muted">
                                        {new Date(identity.created_at).toLocaleDateString(locale, {
                                            day: "2-digit", month: "short", year: "numeric"
                                        })}
                                    </p>
                                )}
                            </div>

                            {identity.tags?.length > 0 && (
                                <div className="hidden sm:flex gap-1 flex-wrap justify-end max-w-[200px]">
                                    {identity.tags.slice(0, 3).map((tag) => (
                                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full cw-surface-2 cw-muted">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                className="cw-muted group-hover:text-[var(--cw-text)] transition-colors flex-shrink-0">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {!loading && !error && count > 0 && (
                <AdminPagination
                    page={page}
                    totalPages={totalPages}
                    onPrev={() => setPage((p) => Math.max(0, p - 1))}
                    onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                />
            )}
        </div>
    );
}
