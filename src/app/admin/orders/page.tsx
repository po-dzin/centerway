"use client";

import { useState, useEffect, useCallback } from "react";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";

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

const STATUS_TABS = [
    { key: "", label: "Все" },
    { key: "paid", label: "Оплачено" },
    { key: "created", label: "Ожидают" },
    { key: "refunded", label: "Возврат" },
];

const statusBadge: Record<string, string> = {
    paid: "bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400",
    created: "bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-400",
    pending: "bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-400",
    refunded: "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400",
};

const statusLabel: Record<string, string> = {
    paid: "Оплачен", created: "Создан", pending: "В обработке", refunded: "Возврат",
};

// Reconcile modal
function ReconcileModal({
    order,
    onClose,
    onDone,
}: {
    order: Order;
    onClose: () => void;
    onDone: () => void;
}) {
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handle = async (newStatus: string) => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const res = await fetch("/api/admin/orders", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(session ? { "Authorization": `Bearer ${session.access_token}` } : {})
                },
                body: JSON.stringify({ order_ref: order.order_ref, status: newStatus, note }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            onDone();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">Ручная сверка</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                    Заказ <span className="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">{order.order_ref}</span>
                </p>

                <div className="space-y-3 mb-4">
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 text-sm">
                        <div className="flex justify-between">
                            <span className="text-neutral-500">Продукт</span>
                            <span className="font-medium text-neutral-900 dark:text-white">{order.product_code}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-neutral-500">Сумма</span>
                            <span className="font-medium text-neutral-900 dark:text-white">{order.amount} {order.currency}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-neutral-500">Статус</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[order.status] ?? "bg-neutral-100 text-neutral-500"}`}>
                                {statusLabel[order.status] ?? order.status}
                            </span>
                        </div>
                    </div>

                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Комментарий (необязательно)"
                        rows={2}
                        className="w-full text-sm px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 resize-none"
                    />
                </div>

                {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

                <div className="flex gap-2">
                    <button
                        onClick={() => handle("paid")}
                        disabled={loading || order.status === "paid"}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                    >
                        ✓ Подтвердить оплату
                    </button>
                    <button
                        onClick={() => handle("refunded")}
                        disabled={loading}
                        className="py-2.5 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm transition-colors"
                    >
                        Возврат
                    </button>
                    <button
                        onClick={onClose}
                        className="py-2.5 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm transition-colors"
                    >
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    );
}

function ResendAccessButton({ orderRef }: { orderRef: string }) {
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
                alert("Ошибка генерации: " + (data.error || "unknown"));
            }
        } catch (e: any) {
            alert("Ошибка сети");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handle}
            title={copied ? "Ссылка скопирована!" : "Сгенерировать и скопировать ссылку доступа"}
            className="shrink-0 p-2 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors opacity-0 group-hover:opacity-100"
        >
            {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
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
        } catch (e: any) {
            setError(e.message);
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

    const totalPages = Math.ceil(count / LIMIT);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-1">Заказы</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Управление оплатами и ручная сверка</p>
                </div>
                {!loading && data.length > 0 && activeStatus !== "created" && (
                    <div className="text-right">
                        <p className="text-xs text-neutral-400">Сумма (оплачено)</p>
                        <p className="text-xl font-bold text-neutral-900 dark:text-white mt-0.5">
                            {totalPaid.toLocaleString("ru-RU")} <span className="text-sm font-normal text-neutral-500">UAH</span>
                        </p>
                    </div>
                )}
            </div>

            {/* Status tabs */}
            <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
                {STATUS_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleStatusChange(tab.key)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeStatus === tab.key
                            ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                            : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-neutral-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </div>
                <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Поиск по order_ref или продукту..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 transition-all"
                />
            </div>

            {/* Count */}
            {!loading && (
                <p className="text-xs text-neutral-400">
                    {count === 0 ? "Нет заказов" : `${count} заказ${count === 1 ? "" : count < 5 ? "а" : "ов"}`}
                </p>
            )}

            {/* Loading skeletons */}
            {loading && (
                <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-[72px] rounded-xl bg-neutral-100 dark:bg-neutral-800/50 animate-pulse" />
                    ))}
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-sm text-red-600 dark:text-red-400">
                    Ошибка: {error}
                </div>
            )}

            {/* Empty */}
            {!loading && !error && data.length === 0 && (
                <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                            <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                            <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                    </div>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm">Заказов нет</p>
                </div>
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
                                className="flex items-center gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors group"
                            >
                                {/* Status dot */}
                                <div className={`shrink-0 w-2 h-2 rounded-full mt-0.5 ${order.status === "paid" ? "bg-green-500" :
                                    order.status === "refunded" ? "bg-red-500" : "bg-yellow-400"
                                    }`} />

                                {/* Main info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-mono font-medium text-neutral-900 dark:text-white">
                                            {order.order_ref}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusBadge[order.status] ?? "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"}`}>
                                            {statusLabel[order.status] ?? order.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-xs text-neutral-400">{order.product_code}</span>
                                        {customerLabel && (
                                            <>
                                                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                                                {order.customer_id ? (
                                                    <Link href={`/admin/customers/${order.customer_id}`}
                                                        className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors truncate max-w-[180px]">
                                                        {customerLabel}
                                                    </Link>
                                                ) : (
                                                    <span className="text-xs text-neutral-400 truncate max-w-[180px]">{customerLabel}</span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="text-right shrink-0">
                                    {order.amount != null && (
                                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                                            {order.amount.toLocaleString("ru-RU")} <span className="text-xs font-normal text-neutral-400">{order.currency}</span>
                                        </p>
                                    )}
                                    <p className="text-[10px] text-neutral-400 mt-0.5">
                                        {new Date(order.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>

                                {/* Actions */}
                                {order.status !== "paid" ? (
                                    <button
                                        onClick={() => setReconcileOrder(order)}
                                        title="Ручная сверка"
                                        className="shrink-0 p-2 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </button>
                                ) : (
                                    <ResendAccessButton orderRef={order.order_ref} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {!loading && !error && count > 0 && totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                        title="Предыдущая"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>

                    <div className="text-sm text-neutral-500 dark:text-neutral-400">
                        Страница <span className="font-medium text-neutral-900 dark:text-white">{page + 1}</span> из <span className="font-medium text-neutral-900 dark:text-white">{totalPages}</span>
                    </div>

                    <button
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                        title="Следующая"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Reconcile modal */}
            {reconcileOrder && (
                <ReconcileModal
                    order={reconcileOrder}
                    onClose={() => setReconcileOrder(null)}
                    onDone={() => {
                        setReconcileOrder(null);
                        fetchOrders(debouncedQ, activeStatus, page);
                    }}
                />
            )}
        </div>
    );
}
