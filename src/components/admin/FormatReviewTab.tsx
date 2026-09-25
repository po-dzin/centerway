"use client";

/**
 * The owner's side of the format constructor (2026-09-25).
 *
 * ONE CARD PER PROGRAM, its formats as rows inside it. A format is a way
 * through one program — «Шлях 21» on your own, in a cohort, with a guide — so
 * the three are read together, priced against each other, and listed under the
 * program they belong to rather than as three unrelated products.
 *
 * Nothing is on sale until the owner approves it here. Approving sets the LIVE
 * price; the author's proposal is prefilled as a starting point, not a
 * decision. A draft the owner set up (Природне тіло's group and guided formats)
 * is priced and approved the same way. A live format shows the decision form
 * only while a new price waits beside the current one.
 */

import { useMemo, useState } from "react";

import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { authorizedJson as authFetch } from "@/components/auth/authorizedFetch";
import { Icon } from "@/components/Icon";
import { getErrorMessage } from "@/lib/errors";
import type { FormatReviewRow } from "@/lib/admin/formatReviewTypes";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";
import css from "./FormatReviewTab.module.css";

const REVIEW_KEY = {
  draft: "formats_review_draft",
  proposed: "formats_review_proposed",
  approved: "formats_review_approved",
  declined: "formats_review_declined",
} as const;

const ORDER = { self: 0, group: 1, individual: 2 } as const;

function EmptyIcon() {
  return <Icon className="cw-muted" name="price" size={20} />;
}

function waitsForDecision(row: FormatReviewRow): boolean {
  return row.reviewStatus !== "approved" || row.proposedAmount !== null;
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

  /* Programs with something waiting come first; inside a program the formats
     keep one order everywhere — self, group, guided — the order the page
     shows them in. */
  const programs = useMemo(() => {
    const byCourse = new Map<string, { slug: string; title: string; formats: FormatReviewRow[] }>();
    for (const row of formats) {
      const entry = byCourse.get(row.courseSlug) ?? { slug: row.courseSlug, title: row.courseTitle, formats: [] };
      entry.formats.push(row);
      byCourse.set(row.courseSlug, entry);
    }
    return [...byCourse.values()]
      .map((entry) => ({
        ...entry,
        formats: [...entry.formats].sort((a, b) => ORDER[a.format] - ORDER[b.format] || a.code.localeCompare(b.code)),
        waiting: entry.formats.filter(waitsForDecision).length,
      }))
      .sort((a, b) => Number(b.waiting > 0) - Number(a.waiting > 0) || a.title.localeCompare(b.title, "uk"));
  }, [formats]);

  if (formats.length === 0) return <AdminEmptyState icon={<EmptyIcon />} description={t("formats_empty")} />;

  return (
    <div>
      <p className={css.intro}>{t("formats_intro")}</p>
      <div className={css.programs}>
        {programs.map((program) => (
          <section key={program.slug} className={lists.item} aria-labelledby={`formats-${program.slug}`}>
            <div className={css.programHead}>
              <h3 className={css.programTitle} id={`formats-${program.slug}`}>
                {program.title}
              </h3>
              <p className={css.programCount}>
                {t("formats_count")}: {program.formats.length}
                {program.waiting > 0 ? (
                  <>
                    {" · "}
                    <strong>
                      {t("formats_waiting")}: {program.waiting}
                    </strong>
                  </>
                ) : null}
              </p>
            </div>
            <ul className={css.formats}>
              {program.formats.map((row) => (
                <FormatRow key={row.code} row={row} canEdit={canEdit} errorText={errorText} onChanged={onChanged} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function FormatRow({
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
  const deciding = waitsForDecision(row);

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

  const state = approved && !row.active ? t("formats_withdrawn") : t(REVIEW_KEY[row.reviewStatus]);
  const meta = [
    row.mode === "lead" ? t("formats_mode_lead") : null,
    row.cohortStartsOn ? `${t("formats_cohort")}: ${row.cohortStartsOn}` : null,
    row.includes.length > 0
      ? `${t("formats_includes")}: ${row.includes.map((program) => program.title).join(" · ")}`
      : null,
  ].filter(Boolean);

  return (
    <li className={css.format}>
      <div className={css.formatHead}>
        <p className={css.formatName}>
          {row.label}{" "}
          <span
            className={
              deciding ? "cw-status-pending-text" : approved && !row.active ? "cw-status-failed-text" : "cw-muted"
            }
          >
            · {state}
          </span>
        </p>
        <p className={css.formatPrice}>
          {row.amount != null ? `${row.amount} ${row.currency}` : t("products_price_on_request")}
          {row.proposedAmount != null ? ` → ${row.proposedAmount} ${row.currency}` : ""}
        </p>
      </div>
      <p className={css.formatMeta}>
        <code>{row.code}</code> · {meta.join(" · ")}
      </p>
      {row.summary ? <p className={css.formatSummary}>{row.summary}</p> : null}

      {canEdit ? (
        deciding ? (
          <div className={css.decision}>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>
                {row.proposedAmount != null ? t("formats_proposed_price") : t("formats_final_amount")}
              </span>
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder={row.mode === "lead" ? t("products_price_on_request") : undefined}
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
            <div className={css.actions}>
              <button
                type="button"
                onClick={() => void act("approve")}
                disabled={busy}
                className={`${controls.action} cw-surface-2`}
              >
                {t("formats_approve")}
              </button>
              {row.reviewStatus !== "draft" ? (
                <button
                  type="button"
                  onClick={() => void act("decline")}
                  disabled={busy}
                  className={`${controls.action} cw-btn-muted`}
                >
                  {t(pendingPrice ? "formats_decline_price" : "formats_decline")}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={css.actions}>
            <button
              type="button"
              onClick={() => void act(row.active ? "withdraw" : "resume")}
              disabled={busy}
              className={`${controls.action} cw-btn-muted`}
            >
              {t(row.active ? "products_withdraw" : "products_resume")}
            </button>
          </div>
        )
      ) : null}
    </li>
  );
}
