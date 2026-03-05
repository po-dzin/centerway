"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { getErrorMessage } from "@/lib/errors";
import { ORDER_STATUS_BADGE_CLASS } from "@/lib/adminStatusStyles";

interface Order {
    order_ref: string;
    product_code: string;
    amount: number | null;
    currency: string | null;
    status: string;
}

export function ReconcileModal({
    order,
    onClose,
    onDone,
    labels,
    statusLabels,
}: {
    order: Order;
    onClose: () => void;
    onDone: () => void;
    labels: {
        title: string;
        order: string;
        product: string;
        amount: string;
        status: string;
        notePlaceholder: string;
        confirmPaid: string;
        refund: string;
        cancel: string;
    };
    statusLabels: Record<string, string>;
}) {
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handle = async (newStatus: string) => {
        setLoading(true);
        setError(null);
        try {
            const {
                data: { session },
            } = await supabaseClient.auth.getSession();
            const res = await fetch("/api/admin/orders", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({ order_ref: order.order_ref, status: newStatus, note }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            onDone();
        } catch (e: unknown) {
            setError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center cw-overlay" onClick={onClose}>
            <div
                className="cw-surface-solid border cw-border rounded-2xl cw-shadow p-6 w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold cw-text mb-1">{labels.title}</h3>
                <p className="cw-page-subtitle mb-4">
                    {labels.order} <span className="font-mono text-xs cw-surface-2 px-1.5 py-0.5 rounded">{order.order_ref}</span>
                </p>

                <div className="space-y-3 mb-4">
                    <div className="p-3 rounded-xl cw-surface-2 text-sm">
                        <div className="flex justify-between">
                            <span className="cw-muted">{labels.product}</span>
                            <span className="font-medium cw-text">{order.product_code}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="cw-muted">{labels.amount}</span>
                            <span className="font-medium cw-text">{order.amount} {order.currency}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="cw-muted">{labels.status}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_BADGE_CLASS[order.status] ?? "cw-surface-2 cw-muted"}`}>
                                {statusLabels[order.status] ?? order.status}
                            </span>
                        </div>
                    </div>

                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={labels.notePlaceholder}
                        rows={2}
                        className="w-full text-sm px-3 py-2 rounded-xl border cw-border cw-surface cw-text placeholder:text-[var(--cw-muted)] focus:outline-none resize-none"
                    />
                </div>

                {error && <p className="text-xs cw-status-failed-text mb-3">{error}</p>}

                <div className="flex gap-2">
                    <button
                        onClick={() => handle("paid")}
                        disabled={loading || order.status === "paid"}
                        className="flex-1 py-2.5 px-4 rounded-xl cw-btn-status-success disabled:opacity-40 text-sm font-semibold transition-colors"
                    >
                        {labels.confirmPaid}
                    </button>
                    <button
                        onClick={() => handle("refunded")}
                        disabled={loading}
                        className="py-2.5 px-3 rounded-xl border cw-border hover:bg-[var(--cw-accent-soft)] cw-muted text-sm transition-colors"
                    >
                        {labels.refund}
                    </button>
                    <button
                        onClick={onClose}
                        className="py-2.5 px-3 rounded-xl border cw-border hover:bg-[var(--cw-accent-soft)] cw-muted text-sm transition-colors"
                    >
                        {labels.cancel}
                    </button>
                </div>
            </div>
        </div>
    );
}
