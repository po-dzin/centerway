"use client";

import { useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import { ORDER_STATUS_BADGE_CLASS } from "@/lib/admin/adminStatusStyles";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import { AdminModal } from "@/components/admin/AdminModal";
import controls from "@/components/admin/AdminControls.module.css";

interface Order {
  order_ref: string;
  product_code: string;
  amount: number | null;
  currency: string | null;
  status: string;
}

/**
 * Marking an order paid or refunded by hand.
 *
 * IT BUILT ITS OWN DIALOG until 2026-09-12, and `AdminModal`'s own note had
 * already written down what that cost: Escape bound to the overlay, so it only
 * fired once focus was already inside; nothing moving focus into the box, so a
 * keyboard user opened it and stayed outside; Tab walking the page behind; and
 * the page under the scrim still scrolling. None of that was visible, which is
 * why it survived two passes over this file.
 */
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
      const res = await authorizedFetch("/api/admin/orders", {
        method: "PATCH",
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
    <AdminModal
      title={labels.title}
      description={`${labels.order} ${order.order_ref}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${controls.action} cw-btn-muted`}>
            {labels.cancel}
          </button>
          <button
            type="button"
            onClick={() => handle("refunded")}
            disabled={loading}
            className={`${controls.action} cw-btn-muted`}
          >
            {labels.refund}
          </button>
          <button
            type="button"
            onClick={() => handle("paid")}
            disabled={loading || order.status === "paid"}
            className={`${controls.actionPrimary} cw-btn-status-success`}
          >
            {labels.confirmPaid}
          </button>
        </>
      }
    >
      <div className={controls.facts}>
        <div className={controls.factRow}>
          <span className={controls.factLabel}>{labels.product}</span>
          <span className={controls.factValue}>{order.product_code}</span>
        </div>
        <div className={controls.factRow}>
          <span className={controls.factLabel}>{labels.amount}</span>
          <span className={controls.factValue}>
            {order.amount} {order.currency}
          </span>
        </div>
        <div className={controls.factRow}>
          <span className={controls.factLabel}>{labels.status}</span>
          <span className={ORDER_STATUS_BADGE_CLASS[order.status] ?? "cw-surface-2 cw-muted"}>
            {statusLabels[order.status] ?? order.status}
          </span>
        </div>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={labels.notePlaceholder}
        rows={2}
        className={controls.note}
      />

      {error ? <p className={controls.dialogError}>{error}</p> : null}
    </AdminModal>
  );
}
