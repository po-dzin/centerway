"use client";

/**
 * The gift-to-a-list dialog: one course and one cohort date for a pasted list
 * of addresses (`POST /api/admin/access/learners/bulk`).
 *
 * A SEPARATE DIALOG, not a mode of the grant form. That form is a sale — name,
 * money, a role — and every one of those is per person; a list is none of
 * them. Folding both into one dialog would leave half its fields meaning
 * nothing in one of its modes, and the payment field is the one an operator
 * would least want to wonder about.
 *
 * The addresses are parsed here with the same `parseEmailList` the route
 * uses, so a typo is shown under the field before anything is sent — field
 * validation stays contextual — and the count on the button is the count the
 * server will act on. The result replaces the form in the same dialog, as a
 * table with one row per address, because "which ones did not happen" is the
 * question the operator has afterwards and a toast cannot answer it.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { AdminDateField } from "@/components/admin/AdminDateField";
import { AdminModal } from "@/components/admin/AdminModal";
import { StateBadge } from "@/components/platform/StateBadge";
import { authorizedJson as authFetch } from "@/components/auth/authorizedFetch";
import { getErrorMessage } from "@/lib/errors";
import {
  BULK_GRANT_LIMIT,
  GRANT_SOURCES,
  parseEmailList,
  type BulkGrantResult,
  type CourseRow,
  type GrantSource,
} from "@/lib/admin/accessTypes";
import access from "@/components/admin/AdminAccess.module.css";
import controls from "@/components/admin/AdminControls.module.css";
import surfaces from "@/components/admin/AdminSurfaces.module.css";

type BulkResponse = {
  summary: { total: number; created: number; already: number; failed: number; accountsCreated: number };
  results: BulkGrantResult[];
};

const SOURCE_LABEL_KEY = {
  manual: "access_source_manual",
  bonus: "access_source_bonus",
  promotion: "access_source_promotion",
} as const satisfies Record<GrantSource, string>;

const OUTCOME = {
  created: { key: "access_bulk_outcome_created", tone: "success" },
  already: { key: "access_bulk_outcome_already", tone: "neutral" },
  error: { key: "access_bulk_outcome_error", tone: "failed" },
} as const;

export function AccessBulkGrant({
  courses,
  initialCourse,
  locale,
  dateLabels,
  errorText,
  onClose,
  onGranted,
}: {
  courses: CourseRow[];
  initialCourse: string;
  locale: string;
  dateLabels: { open: string; clear: string; today: string; placeholder: string };
  errorText: (message: string) => string;
  onClose: () => void;
  /** Called after a list ran with at least one seat granted, so the page can reload what it shows. */
  onGranted: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();

  const [raw, setRaw] = useState("");
  const [course, setCourse] = useState(initialCourse || courses[0]?.slug || "");
  // `bonus` by default: a list carries no money, so what it hands out is a
  // gift, and the reason column should say so a year from now.
  const [source, setSource] = useState<GrantSource>("bonus");
  const [cohort, setCohort] = useState("");
  const [ref, setRef] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResponse | null>(null);

  const parsed = useMemo(() => parseEmailList(raw), [raw]);
  const tooMany = parsed.emails.length > BULK_GRANT_LIMIT;
  const ready = parsed.emails.length > 0 && parsed.invalid.length === 0 && !tooMany && Boolean(course);

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const payload = await authFetch<BulkResponse>("/api/admin/access/learners/bulk", {
        method: "POST",
        body: JSON.stringify({
          emails: parsed.emails,
          course,
          source,
          // Absent, not blank — the same rule as the single grant: a blank
          // cohort would pull an already-seated person out of their flow.
          cohortStartsOn: cohort || undefined,
          ref: ref.trim() || undefined,
          createAccount,
        }),
      });
      setResult(payload);
      toast[payload.summary.failed > 0 ? "info" : "success"](t("access_bulk_done"));
      if (payload.summary.created > 0 || payload.summary.accountsCreated > 0) onGranted();
    } catch (e) {
      // Only a refusal of the whole list lands here (the course, a date, the
      // session); per-address failures come back inside the result.
      toast.error(errorText(getErrorMessage(e)));
    } finally {
      setBusy(false);
    }
  };

  /** A new list keeps the course, reason and cohort: the next paste is usually the same flow. */
  const again = () => {
    setResult(null);
    setRaw("");
  };

  return (
    <AdminModal
      title={t("access_bulk_title")}
      description={t("access_bulk_hint")}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={controls.action}>
            {t("common_close")}
          </button>
          {result ? (
            <button type="button" onClick={again} className={`${controls.actionPrimary} cw-surface-2`}>
              {t("access_bulk_again")}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={busy || !ready}
              className={`${controls.actionPrimary} cw-surface-2`}
            >
              {t("access_bulk_submit")}
              {parsed.emails.length > 0 ? ` (${parsed.emails.length})` : ""}
            </button>
          )}
        </>
      }
    >
      {result ? (
        <BulkResult result={result} errorText={errorText} />
      ) : (
        <>
          <label className={controls.field}>
            <span className={controls.fieldCaption}>{t("access_bulk_emails")}</span>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={t("access_bulk_emails_placeholder")}
              autoCapitalize="none"
              spellCheck={false}
              className={controls.textarea}
            />
          </label>
          <p className={controls.hint}>
            {t("access_bulk_emails_hint")} {t("access_bulk_count")}: {parsed.emails.length}
            {parsed.duplicates > 0 ? `, ${t("access_bulk_duplicates")}: ${parsed.duplicates}` : ""}
          </p>
          {parsed.invalid.length > 0 ? (
            <p className={controls.hint} role="alert">
              {t("access_bulk_invalid")}: {parsed.invalid.join(", ")}
            </p>
          ) : null}
          {tooMany ? (
            <p className={controls.hint} role="alert">
              {t("access_bulk_too_many")} {BULK_GRANT_LIMIT}.
            </p>
          ) : null}

          <div className={access.grantMore}>
            <label className={`${controls.field} ${access.spanFull} ${access.spanCourse}`}>
              <span className={controls.fieldCaption}>{t("access_grant_course")}</span>
              <select value={course} onChange={(e) => setCourse(e.target.value)} className={controls.select}>
                {courses.map((row) => (
                  <option key={row.id} value={row.slug}>
                    {row.title}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${controls.field} ${access.spanFull} ${access.spanDeadline}`}>
              <span className={controls.fieldCaption}>{t("access_bulk_source")}</span>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as GrantSource)}
                className={controls.select}
              >
                {GRANT_SOURCES.map((value) => (
                  <option key={value} value={value}>
                    {t(SOURCE_LABEL_KEY[value])}
                  </option>
                ))}
              </select>
            </label>
            <div className={`${controls.field} ${access.spanFull} ${access.spanDeadline}`}>
              <span className={controls.fieldCaption}>{t("access_grant_cohort")}</span>
              <AdminDateField value={cohort} onChange={setCohort} locale={locale} labels={dateLabels} />
            </div>
            <label className={`${controls.field} ${access.spanFull} ${access.spanAmount}`}>
              <span className={controls.fieldCaption}>{t("access_grant_ref")}</span>
              <input
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="olena"
                autoCapitalize="none"
                spellCheck={false}
                className={controls.input}
              />
            </label>
          </div>

          <div className={access.grantFoot}>
            <label className={access.checkLong}>
              <input
                type="checkbox"
                checked={createAccount}
                onChange={(e) => setCreateAccount(e.target.checked)}
                className={access.checkBoxTop}
              />
              <span>{t("access_bulk_create_account")}</span>
            </label>
          </div>
        </>
      )}
    </AdminModal>
  );
}

function BulkResult({ result, errorText }: { result: BulkResponse; errorText: (message: string) => string }) {
  const { t } = useI18n();
  const tiles = [
    { key: "created", label: t("access_bulk_summary_created"), value: result.summary.created },
    { key: "already", label: t("access_bulk_summary_already"), value: result.summary.already },
    { key: "failed", label: t("access_bulk_summary_failed"), value: result.summary.failed },
    { key: "accounts", label: t("access_bulk_summary_accounts"), value: result.summary.accountsCreated },
  ];

  return (
    <>
      <div className={access.summary}>
        {tiles.map((tile) => (
          <div key={tile.key} className={surfaces.tile}>
            <p className={access.summaryLabel}>{tile.label}</p>
            <p className={access.summaryValue}>{tile.value}</p>
          </div>
        ))}
      </div>
      <div className={surfaces.plateFlush}>
        <div className={surfaces.scrollX}>
          <table className={surfaces.table}>
            <thead className={surfaces.tableHead}>
              <tr>
                <th className={surfaces.th}>{t("access_bulk_col_email")}</th>
                <th className={surfaces.th}>{t("access_bulk_col_result")}</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((row) => (
                <tr key={row.email} className={surfaces.row}>
                  <td className={surfaces.tdCode}>{row.email}</td>
                  <td className={surfaces.td}>
                    <StateBadge tone={OUTCOME[row.outcome].tone}>{t(OUTCOME[row.outcome].key)}</StateBadge>
                    {row.accountCreated ? <> · {t("access_bulk_account_created")}</> : null}
                    {row.error ? <> · {errorText(row.error)}</> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
