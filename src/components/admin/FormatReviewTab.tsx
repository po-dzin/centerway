"use client";

/**
 * The owner's side of the format constructor (2026-09-25).
 *
 * An author composes a format in the builder and proposes a price; nothing is
 * on sale until it is approved here. Approving sets the LIVE price — the
 * author's figure is prefilled as a starting point, not a decision — and a
 * change of price on a format already on sale waits here beside the current
 * one until the owner takes it or keeps the old one.
 *
 * Proposals come first, then what is on sale, then drafts the author has not
 * sent yet — which are shown so the owner can see what is coming, not acted on.
 */

import { useState } from "react";

import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminRow } from "@/components/admin/AdminRow";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { authorizedJson as authFetch } from "@/components/auth/authorizedFetch";
import { Icon } from "@/components/Icon";
import { getErrorMessage } from "@/lib/errors";
import type { FormatReviewRow } from "@/lib/admin/formatReviewTypes";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";

const KIND_KEY = {
  self: "formats_kind_self",
  group: "formats_kind_group",
  individual: "formats_kind_individual",
} as const;

const REVIEW_KEY = {
  draft: "formats_review_draft",
  proposed: "formats_review_proposed",
  approved: "formats_review_approved",
  declined: "formats_review_declined",
} as const;

function EmptyIcon() {
  return <Icon className="cw-muted" name="price" size={20} />;
}

export function FormatReviewTab({
  formats,
  canEdit,
  errorText,
  onChanged,
}: {
  formats: FormatReviewRow[];
  canEdit: boolean;
  errorText: (message: string) => string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  if (formats.length === 0) return <AdminEmptyState icon={<EmptyIcon />} description={t("formats_empty")} />;
  return (
    <div className={lists.list}>
      {formats.map((row) => (
        <FormatReviewItem key={row.code} row={row} canEdit={canEdit} errorText={errorText} onChanged={onChanged} />
      ))}
    </div>
  );
}

function FormatReviewItem({
  row,
  canEdit,
  errorText,
  onChanged,
}: {
  row: FormatReviewRow;
  canEdit: boolean;
  errorText: (message: string) => string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(() => {
    const start = row.proposedAmount ?? row.amount;
    return start != null ? String(start) : "";
  });
  const [listAmount, setListAmount] = useState("");

  const approved = row.reviewStatus === "approved";
  const pendingPrice = approved && row.proposedAmount !== null;
  const actionable = row.reviewStatus === "proposed" || pendingPrice;

  const act = async (action: "approve" | "decline" | "withdraw" | "resume") => {
    setBusy(true);
    try {
      await authFetch("/api/admin/offer-formats", {
        method: "PATCH",
        body: JSON.stringify({
          code: row.code,
          courseSlug: row.courseSlug,
          action,
          amount: amount.trim() === "" ? null : Number(amount),
          listAmount: listAmount.trim() === "" ? null : Number(listAmount),
        }),
      });
      toast.success(
        t(
          action === "approve"
            ? "formats_approved"
            : action === "decline"
              ? "formats_declined"
              : action === "resume"
                ? "products_resumed"
                : "products_withdrawn",
        ),
      );
      await onChanged();
    } catch (e) {
      toast.error(errorText(getErrorMessage(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminRow
      title={`${row.courseTitle} — ${row.label}`}
      meta={
        <>
          <span className={lists.itemCode}>{row.code}</span>
          <span>{t(KIND_KEY[row.format])}</span>
          <span className={row.reviewStatus === "proposed" ? "cw-status-pending-text" : undefined}>
            {t(REVIEW_KEY[row.reviewStatus])}
          </span>
          {approved && !row.active ? <span className="cw-status-failed-text">{t("formats_withdrawn")}</span> : null}
          <span>
            {t("formats_live_price")}:{" "}
            {row.amount != null ? `${row.amount} ${row.currency}` : t("products_price_on_request")}
            {row.mode === "lead" ? ` · ${t("formats_mode_lead")}` : ""}
          </span>
          {row.proposedAmount != null ? (
            <strong>
              {t("formats_proposed_price")}: {row.proposedAmount} {row.currency}
            </strong>
          ) : null}
          {row.cohortStartsOn ? (
            <span>
              {t("formats_cohort")}: {row.cohortStartsOn}
            </span>
          ) : null}
          {row.includes.length > 0 ? (
            <span>
              {t("formats_includes")}: {row.includes.map((program) => program.title).join(" · ")}
            </span>
          ) : null}
        </>
      }
      footer={
        canEdit ? (
          <>
            {actionable ? (
              <div className={controls.priceForm}>
                <label className={controls.field}>
                  <span className={controls.fieldCaption}>{t("formats_final_amount")}</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={controls.input}
                  />
                </label>
                <label className={controls.field}>
                  <span className={controls.fieldCaption}>{t("formats_list_amount")}</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={listAmount}
                    onChange={(e) => setListAmount(e.target.value)}
                    className={controls.input}
                  />
                </label>
                <div className={controls.priceActions}>
                  <button
                    type="button"
                    onClick={() => void act("approve")}
                    disabled={busy}
                    className={`${controls.action} cw-surface-2`}
                  >
                    {t("formats_approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void act("decline")}
                    disabled={busy}
                    className={`${controls.action} cw-btn-muted`}
                  >
                    {t(pendingPrice ? "formats_decline_price" : "formats_decline")}
                  </button>
                </div>
              </div>
            ) : null}
            {approved ? (
              <div className={controls.priceActions}>
                <button
                  type="button"
                  onClick={() => void act(row.active ? "withdraw" : "resume")}
                  disabled={busy}
                  className={`${controls.action} cw-btn-muted`}
                >
                  {t(row.active ? "products_withdraw" : "products_resume")}
                </button>
              </div>
            ) : null}
            <p className={controls.hint}>{t("formats_amount_hint")}</p>
          </>
        ) : (
          <p className={controls.hint}>{t("access_role_admin_only")}</p>
        )
      }
      note={row.summary || undefined}
    />
  );
}
