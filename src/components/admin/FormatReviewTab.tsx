"use client";

/**
 * The owner's side of the format constructor (2026-09-25).
 *
 * A format is a way through one program — «Шлях 21» on your own, in a cohort,
 * with a guide — so the three are read together and priced against each other.
 *
 * INSIDE THE PROGRAM'S PRICE ROW, NOT A TAB OF ITS OWN (G, 2026-10-03). The
 * catalogue had «Ціни й доступ» with one price per program and «Формати» with
 * the formats' prices, and the program's own price is one of those formats —
 * `course:<slug>` is the self-paced one. Two tabs, one number in both. The
 * formats now open under their program's row, behind a chevron that says how
 * many there are and whether one waits for a decision; it opens by itself when
 * one does.
 *
 * ONE SALE SWITCH PER FORMAT (G, 2026-10-03). The row carried «Зняти з
 * продажу» for the base offer and every format below carried its own, under
 * the same words — two buttons that read as one action twice. Where a program
 * has formats, every one of them, base included, is listed here with its own
 * switch beside its name, and the row above keeps only price and term. A
 * program sold as one offer keeps the switch in the row.
 *
 * Nothing is on sale until the owner approves it. Approving sets the LIVE
 * price; the author's proposal is prefilled as a starting point, not a
 * decision. A live format shows the decision form only while a new price waits
 * beside the current one.
 */

import { useMemo, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { authorizedJson as authFetch } from "@/components/auth/authorizedFetch";
import { Icon } from "@/components/Icon";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
import { getErrorMessage } from "@/lib/errors";
import type { FormatReviewRow } from "@/lib/admin/formatReviewTypes";
import controls from "@/components/admin/AdminControls.module.css";
import css from "./FormatReviewTab.module.css";

const REVIEW_KEY = {
  draft: "formats_review_draft",
  proposed: "formats_review_proposed",
  approved: "formats_review_approved",
  declined: "formats_review_declined",
} as const;

const ORDER = { self: 0, group: 1, individual: 2 } as const;

function waitsForDecision(row: FormatReviewRow): boolean {
  return row.reviewStatus !== "approved" || row.proposedAmount !== null;
}

/**
 * Whether the program is sold through formats rather than as its one base
 * offer — the case where the sale switches live in the format list and not in
 * the price row.
 */
export function hasFormatLadder(formats: FormatReviewRow[], baseCode: string): boolean {
  return formats.length >= 2 || formats.some((row) => row.code !== baseCode || waitsForDecision(row));
}

/**
 * One program's formats, folded under its price row.
 *
 * `baseCode` is the program's own offer (`course:<slug>`): its price is edited
 * in the row above, its sale switch lives here with the others. It is listed
 * first. The head names every format with its price, so the whole ladder
 * reads without opening anything.
 */
export function ProgramFormats({
  formats,
  baseCode,
  canEdit,
  defaultOpen,
  errorText,
  onChanged,
}: {
  formats: FormatReviewRow[];
  baseCode: string;
  canEdit: boolean;
  /** Open on arrival. Unset: open when something waits for a decision. */
  defaultOpen?: boolean;
  errorText: (message: string) => string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const sorted = useMemo(
    () => [...formats].sort((a, b) => ORDER[a.format] - ORDER[b.format] || a.code.localeCompare(b.code)),
    [formats],
  );
  const waiting = sorted.filter(waitsForDecision).length;
  const shown = [...sorted.filter((row) => row.code === baseCode), ...sorted.filter((row) => row.code !== baseCode)];
  const [open, setOpen] = useState(defaultOpen ?? waiting > 0);

  if (!hasFormatLadder(formats, baseCode)) return null;

  const ladder = sorted
    .map(
      (row) =>
        `${row.label} ${row.amount != null ? `${row.amount} ${row.currency}` : t("products_price_on_request")}${
          row.mode === "lead" ? ` (${t("formats_mode_lead")})` : ""
        }`,
    )
    .join(" · ");

  return (
    <div className={css.program}>
      <button
        type="button"
        className={controls.disclosureHead}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <div>
          <p className={controls.disclosureTitle}>
            {t("formats_count")}: {sorted.length}
            {waiting > 0 ? (
              <>
                {" · "}
                <strong className={css.waiting}>
                  {t("formats_waiting")}: {waiting}
                </strong>
              </>
            ) : null}
          </p>
          <p className={controls.disclosureNote}>{ladder}</p>
        </div>
        <span className={controls.disclosureMark} aria-hidden="true">
          <InteractionInkIcon>
            <Icon
              className={open ? controls.disclosureChevronOpen : controls.disclosureChevron}
              name="chevron-down"
              size={16}
            />
          </InteractionInkIcon>
        </span>
      </button>
      {open && shown.length > 0 ? (
        <ul className={css.formats}>
          {shown.map((row) => (
            <FormatRow key={row.code} row={row} canEdit={canEdit} errorText={errorText} onChanged={onChanged} />
          ))}
        </ul>
      ) : null}
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
