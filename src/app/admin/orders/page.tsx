"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { ReconcileModal } from "@/components/admin/modals/ReconcileModal";
import { getErrorMessage } from "@/lib/errors";
import { getAdminLocale } from "@/lib/adminLocale";
import { ORDER_STATUS_BADGE_CLASS } from "@/lib/adminStatusStyles";

interface Order {
    id: string;
    order_ref: string;
    product_code: string;
    amount: number | null;
    currency: string | null;
    status: string;
    customer_id: string | null;
    created_at: string;
    customers: {
        id: string;
        email: string | null;
        phone: string | null;
        display_name: string | null;
    } | null;
}

function ResendAccessButton({ orderRef, labels }: {
    orderRef: string;
    labels: { copied: string; copyLink: string; createError: string; networkError: string; unknown: string; };
}) {
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handle = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const res = await fetch("/api/tokens/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order_ref: orderRef }),
            });
            const data = await res.json();
            if (data.ok && data.token) {
                // Return a full URL if possible, assuming /pay/return?token=... or something similar.
                // For now, we craft a generic access link.
                const baseUrl = window.location.origin;
                const link = `${baseUrl}/pay/return?token=${data.token}`;
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } else {
                alert(labels.createError + ": " + (data.error || labels.unknown));
            }
        } catch {
            alert(labels.networkError);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handle}
            title={copied ? labels.copied : labels.copyLink}
            className="shrink-0 cw-icon-btn opacity-0 group-hover:opacity-100"
        >
            {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cw-status-success-text">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
            )}
        </button>
    );
}

export default function OrdersPage() {
    const { lang, t } = useI18n();
    const isRu = lang === "ru";
    const locale = getAdminLocale(lang);
    const statusLabel: Record<string, string> = {
        paid: t("orders_status_paid"),
        created: t("orders_status_created"),
        pending: t("orders_status_pending"),
        refunded: t("orders_status_refunded"),
    };
    const STATUS_TABS = [
        { key: "", label: t("orders_tab_all") },
        { key: "paid", label: t("orders_tab_paid") },
        { key: "created", label: t("orders_tab_waiting") },
        { key: "refunded", label: t("orders_tab_refunds") },
    ];

    const copyLabels = {
        copied: t("orders_copy_copied"),
        copyLink: t("orders_copy_link"),
        createError: t("orders_copy_error"),
        networkError: t("orders_network_error"),
        unknown: t("common_unknown"),
    };

    const reconcileLabels = {
        title: t("orders_reconcile_title"),
        order: t("orders_reconcile_order"),
        product: t("orders_reconcile_product"),
        amount: t("orders_reconcile_amount"),
        status: t("orders_reconcile_status"),
        notePlaceholder: t("orders_reconcile_note"),
        confirmPaid: t("orders_reconcile_confirm_paid"),
        refund: t("orders_reconcile_refund"),
        cancel: t("orders_reconcile_cancel"),
    };

    const [q, setQ] = useState("");
    const [debouncedQ, setDQ] = useState("");
    const [activeStatus, setStatus] = useState("");
    const [data, setData] = useState<Order[]>([]);
    const [count, setCount] = useState(0);
    const [totalPaid, setTotalPaid] = useState(0);
    const [page, setPage] = useState(0);
    const LIMIT = 50;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reconcileOrder, setReconcileOrder] = useState<Order | null>(null);

    useEffect(() => {
        const t = setTimeout(() => {
            setDQ(q);
            setPage(0); // Reset page on query search
        }, 350);
        return () => clearTimeout(t);
    }, [q]);

    const fetchOrders = useCallback(async (query: string, status: string, pageIndex: number) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query) params.set("q", query);
            if (status) params.set("status", status);
            params.set("limit", String(LIMIT));
            params.set("offset", String(pageIndex * LIMIT));

            const { data: { session } } = await supabaseClient.auth.getSession();
            const res = await fetch(`/api/admin/orders?${params}`, {
                headers: session ? { "Authorization": `Bearer ${session.access_token}` } : {}
            });
            if (!res.ok) throw new Error(`${res.status}`);
            const json = await res.json();

            setData(json.data ?? []);
            setCount(json.count ?? 0);
            setTotalPaid(json.totalPaid ?? 0);
        } catch (e: unknown) {
            setError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [LIMIT]);

    useEffect(() => {
        fetchOrders(debouncedQ, activeStatus, page);
    }, [debouncedQ, activeStatus, page, fetchOrders]);

    const handleStatusChange = (status: string) => {
        setStatus(status);
        setPage(0);
    };

    const getOrdersCountLabel = (value: number) => {
        if (value === 0) return t("orders_count_zero");
        if (!isRu) return `${value} ${t("orders_count_en")}`;
        const mod10 = value % 10;
        const mod100 = value % 100;
        if (mod10 === 1 && mod100 !== 11) return `${value} ${t("orders_count_one")}`;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} ${t("orders_count_few")}`;
        return `${value} ${t("orders_count_many")}`;
    };

    const totalPages = Math.ceil(count / LIMIT);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="cw-page-title mb-1">{t("orders_title")}</h2>
                    <p className="cw-page-subtitle">{t("orders_subtitle")}</p>
                </div>
                {!loading && data.length > 0 && activeStatus !== "created" && (
                    <div className="text-right">
                        <p className="text-xs cw-muted">{t("orders_total_paid")}</p>
                        <p className="text-xl font-bold cw-text mt-0.5">
                            {totalPaid.toLocaleString(locale)} <span className="text-sm font-normal cw-muted">{t("common_currency_uah")}</span>
                        </p>
                    </div>
                )}
            </div>

            {/* Status tabs */}
            <AdminTabs items={STATUS_TABS} activeKey={activeStatus} onChange={handleStatusChange} />

            {/* Search */}
            <AdminSearchInput
                value={q}
                onChange={setQ}
                placeholder={t("orders_search_placeholder")}
                onClear={q ? () => setQ("") : undefined}
            />

            {/* Count */}
            {!loading && (
                <p className="text-xs cw-muted">
                    {getOrdersCountLabel(count)}
                </p>
            )}

            {/* Loading skeletons */}
            {loading && (
                <AdminLoadingState variant="skeleton" rows={6} rowClassName="h-[72px]" />
            )}

            {/* Error */}
            {error && !loading && (
                <div className="p-4 rounded-xl text-sm cw-alert-failed">
                    {t("common_error")}: {error}
                </div>
            )}

            {/* Empty */}
            {!loading && !error && data.length === 0 && (
                <AdminEmptyState
                    className="py-16"
                    icon={(
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="cw-muted">
                            <rect x="1" y="3" width="15" height="13" />
                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                            <circle cx="5.5" cy="18.5" r="2.5" />
                            <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                    )}
                    description={t("orders_empty")}
                />
            )}

            {/* Orders table */}
            {!loading && !error && data.length > 0 && (
                <div className="space-y-1.5">
                    {data.map((order) => {
                        const customer = order.customers;
                        const customerLabel = customer?.display_name ?? customer?.email ?? customer?.phone ?? null;

                        return (
                            <div
                                key={order.id}
                                className="cw-list-item flex items-center gap-4 p-4 group"
                            >
                                {/* Status dot */}
                                <div className={`shrink-0 w-2 h-2 rounded-full mt-0.5 ${order.status === "paid" ? "cw-status-success-dot" :
                                    order.status === "refunded" ? "cw-status-failed-dot" : "cw-status-pending-dot"
                                    }`} />

                                {/* Main info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-mono font-medium cw-text">
                                            {order.order_ref}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_BADGE_CLASS[order.status] ?? "cw-surface-2 cw-muted"}`}>
                                            {statusLabel[order.status] ?? order.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-xs cw-muted">{order.product_code}</span>
                                        {customerLabel && (
                                            <>
                                                <span className="cw-muted">·</span>
                                                {order.customer_id ? (
                                                    <Link href={`/admin/customers/${order.customer_id}`}
                                                        className="text-xs cw-muted hover:text-[var(--cw-text)] transition-colors truncate max-w-[180px]">
                                                        {customerLabel}
                                                    </Link>
                                                ) : (
                                                    <span className="text-xs cw-muted truncate max-w-[180px]">{customerLabel}</span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="text-right shrink-0">
                                    {order.amount != null && (
                                        <p className="text-sm font-semibold cw-text">
                                            {order.amount.toLocaleString(locale)} <span className="text-xs font-normal cw-muted">{order.currency}</span>
                                        </p>
                                    )}
                                    <p className="text-[10px] cw-muted mt-0.5">
                                        {new Date(order.created_at).toLocaleDateString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>

                                {/* Actions */}
                                {order.status !== "paid" ? (
                                    <button
                                        onClick={() => setReconcileOrder(order)}
                                        title={t("orders_manual_reconcile")}
                                        className="shrink-0 cw-icon-btn opacity-0 group-hover:opacity-100"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </button>
                                ) : (
                                        <ResendAccessButton orderRef={order.order_ref} labels={copyLabels} />
                                )}
                            </div>
                        );
                    })}
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

            {/* Reconcile modal */}
            {reconcileOrder && (
                <ReconcileModal
                    order={reconcileOrder}
                    onClose={() => setReconcileOrder(null)}
                    labels={reconcileLabels}
                    statusLabels={statusLabel}
                    onDone={() => {
                        setReconcileOrder(null);
                        fetchOrders(debouncedQ, activeStatus, page);
                    }}
                />
            )}
        </div>
    );
}
