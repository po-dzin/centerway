"use client";

/** Every course format has one commercial editor in «Ціни й доступ».
 * Saving terms preserves its sale and review state; approval and sale switches
 * are separate decisions. Course formats never appear in the product editor.
 */

import { useMemo, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { authorizedJson as authFetch } from "@/components/auth/authorizedFetch";
import { Icon } from "@/components/Icon";
import { ACCESS_TERM_PRESETS } from "@/lib/admin/catalogTypes";
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
 * `baseCode` is the program's own offer (`course:<slug>`): its price, term
 * and sale switch live here with the others. It is listed
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
  /** Open on arrival. Unset: open, so commercial terms are visible on arrival. */
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
  const [open, setOpen] = useState(defaultOpen ?? true);

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
          <Icon
            className={open ? controls.disclosureChevronOpen : controls.disclosureChevron}
            name="chevron-down"
            size={16}
          />
        </span>
      </button>
      {open && shown.length > 0 ? (
        <ul className={css.formats}>
          {shown.map((row) => (
            <FormatRow
              key={`${row.code}:${row.amount}:${row.listAmount}:${row.proposedAmount}:${row.mode}:${row.accessDays}:${row.accessLifetime}:${row.active}:${row.reviewStatus}`}
              row={row}
              canEdit={canEdit}
              errorText={errorText}
              onChanged={onChanged}
            />
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
  const [listAmount, setListAmount] = useState(row.listAmount != null ? String(row.listAmount) : "");
  const [mode, setMode] = useState(row.mode);
  const [term, setTerm] = useState(
    row.accessLifetime
      ? "lifetime"
      : row.accessDays != null
        ? String(row.accessDays)
        : row.mode === "lead"
          ? "agreed"
          : "",
  );

  const approved = row.reviewStatus === "approved";
  const pendingPrice = approved && row.proposedAmount !== null;
  const deciding = waitsForDecision(row);

  const act = async (action: "save" | "approve" | "decline" | "withdraw" | "resume") => {
    setBusy(true);
    try {
      await authFetch("/api/admin/offer-formats", {
        method: "PATCH",
        body: JSON.stringify({
          code: row.code,
          courseSlug: row.courseSlug,
          action,
          mode,
          accessDays: term === "lifetime" || term === "agreed" ? null : Number(term),
          accessLifetime: term === "lifetime",
          amount: amount.trim() === "" ? null : Number(amount),
          listAmount: listAmount.trim() === "" ? null : Number(listAmount),
        }),
      });
      toast.success(
        t(
          action === "save"
            ? "catalog_offer_saved"
            : action === "approve"
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
    row.accessLifetime
      ? t("catalog_term_lifetime")
      : row.accessDays != null
        ? `${row.accessDays} ${t("catalog_term_days")}`
        : row.mode === "lead"
          ? t("catalog_term_agreed")
          : t("catalog_term_unset"),
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
        <code>{row.code}</code>
        {meta.length ? ` · ${meta.join(" · ")}` : ""}
      </p>
      {row.summary ? <p className={css.formatSummary}>{row.summary}</p> : null}

      {canEdit ? (
        <div className={`${controls.priceForm} ${css.priceForm}`}>
          <label className={controls.field}>
            <span className={controls.fieldCaption}>
              {row.proposedAmount != null
                ? t("formats_proposed_price")
                : t(mode === "lead" ? "products_amount" : deciding ? "formats_final_amount" : "catalog_amount")}
            </span>
            <input
              type="number"
              min={deciding || mode === "lead" ? 1 : 0}
              step={1}
              inputMode="numeric"
              placeholder={mode === "lead" ? t("products_price_on_request") : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
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
              disabled={busy}
              className={controls.input}
            />
          </label>
          {!deciding ? (
            <>
              <label className={controls.field}>
                <span className={controls.fieldCaption}>{t("products_kind")}</span>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as typeof mode)}
                  className={controls.select}
                  disabled={busy}
                >
                  <option value="checkout">{t("products_kind_checkout")}</option>
                  <option value="lead">{t("products_kind_lead")}</option>
                </select>
              </label>
              <label className={controls.field}>
                <span className={controls.fieldCaption}>{t("catalog_term")}</span>
                <select
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  className={controls.select}
                  disabled={busy}
                >
                  <option value="">{t("catalog_term_unset")}</option>
                  {mode === "lead" ? <option value="agreed">{t("catalog_term_agreed")}</option> : null}
                  {row.accessDays != null && !ACCESS_TERM_PRESETS.some((days) => days === row.accessDays) ? (
                    <option value={String(row.accessDays)}>
                      {row.accessDays} {t("catalog_term_days")}
                    </option>
                  ) : null}
                  {ACCESS_TERM_PRESETS.map((days) => (
                    <option key={days} value={String(days)}>
                      {days} {t("catalog_term_days")}
                    </option>
                  ))}
                  <option value="lifetime">{t("catalog_term_lifetime")}</option>
                </select>
              </label>
            </>
          ) : null}
          <div className={controls.priceActions}>
            <button
              type="button"
              onClick={() => void act(deciding ? "approve" : "save")}
              disabled={
                busy || (!deciding && (!term || (mode === "checkout" && (!amount.trim() || term === "agreed"))))
              }
              className={`${controls.action} cw-surface-2`}
            >
              {t(deciding ? "formats_approve" : "catalog_save_offer")}
            </button>
            {deciding && row.reviewStatus !== "draft" ? (
              <button
                type="button"
                onClick={() => void act("decline")}
                disabled={busy}
                className={`${controls.action} cw-btn-muted`}
              >
                {t(pendingPrice ? "formats_decline_price" : "formats_decline")}
              </button>
            ) : null}
            {!deciding ? (
              <button
                type="button"
                onClick={() => void act(row.active ? "withdraw" : "resume")}
                disabled={busy}
                className={`${controls.action} cw-btn-muted`}
              >
                {t(row.active ? "products_withdraw" : "products_resume")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
