"use client";

/**
 * THE ONE DIALOG THAT HANDS ACCESS OUT.
 *
 * It replaces two: «Видати доступ» (one person, with money and a role) and
 * «Подарувати списку» (many people, none of it), plus a cohort date typed into
 * either. They were one act asked two ways — who, which program, until when,
 * and why — and a list is only a table with more than one line, so the dialog
 * is a table of people and the rest of the form is asked once for all of them.
 *
 * WHAT DEPENDS ON HOW MANY PEOPLE. A payment outside the provider is one sum
 * for one person (the bulk route refuses it for exactly that reason), and a
 * role is an admin act per person; both exist only while the table has one
 * line. One line goes through the single-grant route, which carries them; two
 * or more go through the bulk route, which grants line by line and never lets
 * one address stop the rest.
 *
 * THE FOUR REASONS (`Підстава`) are what `lms_enrollments.source` records, so
 * the answer to «why does this person have this?» survives a year:
 * payment → `manual` (with the order), gift → `bonus`, staff → `service`.
 * The fourth, promo, grants nothing: it makes a personal link to the program at
 * a discount, for each person, and exists today for IREM only
 * (`personal_offer_tokens`). It is offered to admins only — the issuing route
 * refuses `support` — and the tab is shown dimmed, with its reason, wherever it
 * is not available, rather than hidden, so nobody wonders where it went.
 *
 * Selection grammar (docs/design-system.md): the reason, the term and the format
 * are `ink` — `AdminTabs`, the panel's existing pressed-state strip with
 * `InteractionInkLabel`; the account tick is `essential` (a checkbox). Nothing
 * here draws its own selection.
 *
 * The table's addresses are parsed with the same `parsePeople` the route uses,
 * so a typo is shown before anything is sent and the count on the button is the
 * count the server will act on. The result replaces the form in the same
 * dialog, because «which ones did not happen» is the question afterwards.
 */

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { AdminDateField } from "@/components/admin/AdminDateField";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { StateBadge } from "@/components/platform/StateBadge";
import { authorizedJson as authFetch } from "@/components/auth/authorizedFetch";
import { getErrorMessage } from "@/lib/errors";
import {
  BULK_GRANT_LIMIT,
  GRANTABLE_ROLES,
  PAYMENT_CURRENCIES,
  PROMO_COURSE_SLUGS,
  grantDeadlineValue,
  parsePeople,
  parsePeopleText,
  type BulkGrantResult,
  type CourseFormatRow,
  type CourseRow,
  type GrantSource,
} from "@/lib/admin/accessTypes";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";
import access from "@/components/admin/AdminAccess.module.css";
import controls from "@/components/admin/AdminControls.module.css";
import surfaces from "@/components/admin/AdminSurfaces.module.css";

type Basis = "payment" | "gift" | "promo" | "service";
type Term = "offer" | "period";
type Row = { id: number; email: string; name: string };

type BulkResponse = {
  summary: { total: number; created: number; already: number; failed: number; accountsCreated: number };
  results: BulkGrantResult[];
};
type SingleResponse = { created: boolean; accountCreated: boolean; orderRef: string | null; role: string | null };
type PromoOffer = { offerToken: string; recipientKey: string; landingUrl: string };
type PromoResponse = { offers: PromoOffer[]; dedupedRecipientKeys?: string[] };

type ResultRow = {
  email: string;
  tone: "success" | "neutral" | "failed";
  /** An i18n key for the outcome badge. */
  outcome: string;
  accountCreated: boolean;
  error: string | null;
  link: string | null;
};
type Result = { tiles: { key: string; label: string; value: number }[]; rows: ResultRow[]; links: boolean };

/** `Підстава` → the value `lms_enrollments.source` takes. Promo has none: it grants nothing. */
const SOURCE_OF: Record<Exclude<Basis, "promo">, GrantSource> = {
  payment: "manual",
  gift: "bonus",
  service: "service",
};

const FORMAT_LABEL_KEY = {
  self: "access_format_self",
  group: "access_format_group",
  individual: "access_format_individual",
} as const satisfies Record<CourseFormatRow["format"], string>;

const OUTCOME = {
  created: { key: "access_bulk_outcome_created", tone: "success" },
  already: { key: "access_bulk_outcome_already", tone: "neutral" },
  error: { key: "access_bulk_outcome_error", tone: "failed" },
} as const;

export function AccessGrantModal({
  courses,
  initialCourse,
  canGrantRoles,
  locale,
  dateLabels,
  errorText,
  onClose,
  onGranted,
}: {
  courses: CourseRow[];
  initialCourse: string;
  /** Admin-only. Roles and promo links are refused for `support` by their routes, so the controls are not offered. */
  canGrantRoles: boolean;
  locale: string;
  dateLabels: { open: string; clear: string; today: string; placeholder: string };
  errorText: (message: string) => string;
  onClose: () => void;
  /** Called after a run that changed something, so the page can reload what it shows. */
  onGranted: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();

  const nextId = useRef(1);
  const blankRow = (): Row => ({ id: nextId.current++, email: "", name: "" });
  const [rows, setRows] = useState<Row[]>(() => [blankRow()]);
  const fileInput = useRef<HTMLInputElement>(null);

  // The choice, not the value: the list may arrive after the dialog is open
  // (the page loads it on its own), and a value frozen at the first render
  // would stay empty and keep «Видати» dead while the select shows a program.
  const [courseChoice, setCourseChoice] = useState(initialCourse);
  const course = courseChoice || courses[0]?.slug || "";
  const [formatChoice, setFormatChoice] = useState("");
  const [term, setTerm] = useState<Term>("offer");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Unticked in "offer" (nothing is sent and the offer fills the term in) and
  // ticked by default in "period": a period with no end typed is, almost
  // always, an open one, and saying so beats a field that looks forgotten.
  const [openEnd, setOpenEnd] = useState(true);
  const [basisChoice, setBasisChoice] = useState<Basis>("gift");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(PAYMENT_CURRENCIES[0]);
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState("");
  const [campaign, setCampaign] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [ref, setRef] = useState("");
  const [role, setRole] = useState<string>("user");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const selected = courses.find((row) => row.slug === course);
  const formats = useMemo(() => selected?.formats ?? [], [selected]);
  const format = formats.find((row) => row.format === formatChoice) ?? formats[0] ?? null;
  const promoCourse = (PROMO_COURSE_SLUGS as readonly string[]).includes(course);
  const promoAvailable = canGrantRoles && promoCourse;
  // A promo picked for IREM does not follow the operator to a program that
  // has none: it falls back to a gift, shown as one, rather than staying
  // "promo" underneath and being sent as a plain grant.
  const basis: Basis = basisChoice === "promo" && !promoAvailable ? "gift" : basisChoice;
  const promo = basis === "promo";
  // A group's days are the group's: its start is the stream's date and the
  // operator does not get to move it from here.
  const group = !promo && format?.format === "group";

  const parsed = useMemo(() => parsePeople(rows), [rows]);
  const count = parsed.people.length;
  const single = count === 1;
  const tooMany = count > BULK_GRANT_LIMIT;
  const amountValue = Number(amount);
  const paymentOk = basis !== "payment" || (single && Number.isFinite(amountValue) && amountValue > 0);
  const ready = count > 0 && parsed.invalid.length === 0 && !tooMany && Boolean(course) && paymentOk;

  const paymentTooMany = basis === "payment" && count > 1;
  const link = `${PLATFORM_ORIGIN}/go/${selected?.programSlug ?? course}`;

  const setRow = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  /* A pasted table or a file ADDS to the table. An address already on a line
     is not added again, but a name the paste knows and the line does not is
     filled in — typing the first address and then pasting the sheet it came
     from should not cost the name. */
  const takeText = (text: string) => {
    const incoming = parsePeopleText(text);
    if (incoming.length === 0) return;
    setRows((prev) => {
      const merged = prev.filter((row) => row.email.trim() || row.name.trim()).map((row) => ({ ...row }));
      const byEmail = new Map(merged.map((row) => [row.email.trim().toLowerCase(), row]));
      for (const person of incoming) {
        const key = person.email.trim().toLowerCase();
        const same = byEmail.get(key);
        if (same) {
          if (!same.name.trim() && person.name) same.name = person.name;
          continue;
        }
        const fresh = { id: nextId.current++, email: person.email, name: person.name };
        merged.push(fresh);
        byEmail.set(key, fresh);
      }
      return merged;
    });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("access_grant_copied"));
    } catch {
      // Clipboard refused (an insecure context, a denied permission): the
      // address is on screen to select by hand, so say nothing is copied.
      toast.error(t("access_error_grant_failed"));
    }
  };

  const termFields = () => {
    // «Як в оффері» is said out loud, so it is asked for: without money a grant
    // would otherwise have no deadline at all (`provisionAccess.termFromOffer`).
    if (group)
      return { cohortStartsOn: format?.cohortStartsOn ?? undefined, expiresAt: undefined, termFromOffer: true };
    if (term === "offer") return { cohortStartsOn: undefined, expiresAt: undefined, termFromOffer: true };
    return { cohortStartsOn: from || undefined, expiresAt: grantDeadlineValue(openEnd, to), termFromOffer: undefined };
  };

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      if (promo) {
        const payload = await authFetch<PromoResponse>("/api/admin/landing-offers", {
          method: "POST",
          body: JSON.stringify({
            product: "irem",
            entries: parsed.people.map((person) => ({
              recipient_key: `email:${person.email}`,
              channel: channel.trim() || undefined,
              campaign: campaign.trim() || undefined,
              note: person.name || undefined,
            })),
          }),
        });
        const byKey = new Map(payload.offers.map((offer) => [offer.recipientKey, offer]));
        const resultRows = parsed.people.map<ResultRow>((person) => {
          const offer = byKey.get(`email:${person.email}`);
          return {
            email: person.email,
            tone: offer ? "success" : "neutral",
            outcome: offer ? "access_promo_outcome_issued" : "access_promo_outcome_deduped",
            accountCreated: false,
            error: null,
            link: offer?.landingUrl ?? null,
          };
        });
        const issued = resultRows.filter((row) => row.link).length;
        setResult({
          tiles: [
            { key: "issued", label: t("access_promo_summary_issued"), value: issued },
            { key: "deduped", label: t("access_promo_summary_deduped"), value: resultRows.length - issued },
          ],
          rows: resultRows,
          links: true,
        });
        toast.success(t("access_promo_done"));
        return;
      }

      const common = {
        course,
        source: SOURCE_OF[basis],
        createAccount,
        ref: ref.trim() || undefined,
        ...termFields(),
      };

      if (single) {
        const [person] = parsed.people;
        if (!person) return;
        const payload = await authFetch<SingleResponse>("/api/admin/access/learners", {
          method: "POST",
          body: JSON.stringify({
            ...common,
            email: person.email,
            fullName: person.name || null,
            // Omitted rather than sent as "user": absence means "leave the role
            // alone", which is what an operator who never touched it meant.
            role: canGrantRoles && role !== "user" ? role : undefined,
            payment: basis === "payment" ? { amount: amountValue, currency, note: note.trim() || null } : null,
          }),
        });
        const outcome = payload.created ? OUTCOME.created : OUTCOME.already;
        setResult({
          tiles: [
            { key: "created", label: t("access_bulk_summary_created"), value: payload.created ? 1 : 0 },
            { key: "already", label: t("access_bulk_summary_already"), value: payload.created ? 0 : 1 },
            { key: "failed", label: t("access_bulk_summary_failed"), value: 0 },
            { key: "accounts", label: t("access_bulk_summary_accounts"), value: payload.accountCreated ? 1 : 0 },
          ],
          rows: [
            {
              email: person.email,
              tone: outcome.tone,
              outcome: outcome.key,
              accountCreated: payload.accountCreated,
              error: null,
              link: null,
            },
          ],
          links: false,
        });
        // Money is the part the operator cannot check by looking at the list.
        toast[payload.created ? "success" : "info"](
          payload.orderRef
            ? t("access_granted_with_payment")
            : payload.created
              ? t("access_granted")
              : t("access_already_enrolled"),
        );
        if (payload.role) toast.info(`${t("access_role_set")}: ${payload.role}`);
        if (payload.created || payload.accountCreated || payload.orderRef) onGranted();
        return;
      }

      const payload = await authFetch<BulkResponse>("/api/admin/access/learners/bulk", {
        method: "POST",
        body: JSON.stringify({ ...common, people: parsed.people }),
      });
      setResult({
        tiles: [
          { key: "created", label: t("access_bulk_summary_created"), value: payload.summary.created },
          { key: "already", label: t("access_bulk_summary_already"), value: payload.summary.already },
          { key: "failed", label: t("access_bulk_summary_failed"), value: payload.summary.failed },
          { key: "accounts", label: t("access_bulk_summary_accounts"), value: payload.summary.accountsCreated },
        ],
        rows: payload.results.map((row) => ({
          email: row.email,
          tone: OUTCOME[row.outcome].tone,
          outcome: OUTCOME[row.outcome].key,
          accountCreated: row.accountCreated,
          error: row.error,
          link: null,
        })),
        links: false,
      });
      toast[payload.summary.failed > 0 ? "info" : "success"](t("access_bulk_done"));
      if (payload.summary.created > 0 || payload.summary.accountsCreated > 0) onGranted();
    } catch (e) {
      // Only a refusal of the whole request lands here (the course, a date, the
      // session); per-address failures come back inside the result.
      toast.error(errorText(getErrorMessage(e)));
    } finally {
      setBusy(false);
    }
  };

  /** Another round keeps the program, term and reason: the next paste is usually the same flow. */
  const again = () => {
    setResult(null);
    setRows([blankRow()]);
  };

  const submitLabel = promo ? t("access_grant_submit_promo") : t("access_grant_submit");

  return (
    <AdminModal
      title={t("access_grant_title")}
      description={t("access_grant_hint")}
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
              {submitLabel}
              {count > 1 ? ` (${count})` : ""}
            </button>
          )}
        </>
      }
    >
      {result ? (
        <GrantResult result={result} errorText={errorText} onCopy={copy} />
      ) : (
        <div className={access.stack}>
          <div className={access.stack}>
            <span className={access.cap}>{t("access_grant_who")}</span>
            <div className={access.peopleHead} aria-hidden="true">
              <span>{t("access_grant_col_email")}</span>
              <span>{t("access_grant_name")}</span>
              <span />
            </div>
            <div className={access.peopleList}>
              {rows.map((row) => (
                <div key={row.id} className={access.personRow}>
                  <input
                    type="email"
                    value={row.email}
                    onChange={(e) => setRow(row.id, { email: e.target.value })}
                    // A column or a table pasted into any email field lays itself
                    // out as lines; a single address pastes as itself.
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (/[\r\n]/.test(text.trim())) {
                        e.preventDefault();
                        takeText(text);
                      }
                    }}
                    placeholder={t("access_grant_email")}
                    aria-label={t("access_grant_col_email")}
                    autoCapitalize="none"
                    spellCheck={false}
                    className={controls.input}
                  />
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => setRow(row.id, { name: e.target.value })}
                    placeholder={t("access_grant_name")}
                    aria-label={t("access_grant_name")}
                    className={controls.input}
                  />
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((one) => one.id !== row.id))}
                    disabled={rows.length < 2}
                    aria-label={t("access_grant_remove_person")}
                    title={t("access_grant_remove_person")}
                    className={access.personRemove}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className={access.addRow}>
              <button
                type="button"
                onClick={() => setRows((prev) => [...prev, blankRow()])}
                className={`${controls.action} cw-surface-2`}
              >
                <Icon name="plus" size={16} />
                {t("access_grant_add_person")}
              </button>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className={`${controls.action} cw-surface-2`}
              >
                <Icon name="import" size={16} />
                {t("access_grant_from_file")}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.txt,.tsv"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => takeText(String(reader.result ?? ""));
                  reader.readAsText(file);
                }}
              />
              <span className={controls.hint}>
                {t("access_bulk_count")}: {count}
                {parsed.duplicates > 0 ? `, ${t("access_bulk_duplicates")}: ${parsed.duplicates}` : ""}
              </span>
            </div>
            <p className={controls.hint}>{t("access_grant_people_hint")}</p>
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
            {!promo ? (
              <label className={access.checkLong}>
                <input
                  type="checkbox"
                  checked={createAccount}
                  onChange={(e) => setCreateAccount(e.target.checked)}
                  className={access.checkBoxTop}
                />
                <span>{t("access_bulk_create_account")}</span>
              </label>
            ) : null}
          </div>

          <div className={access.stack}>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{t("access_grant_program")}</span>
              <select
                value={course}
                onChange={(e) => {
                  setCourseChoice(e.target.value);
                  setFormatChoice("");
                }}
                className={controls.select}
              >
                {courses.map((row) => (
                  <option key={row.id} value={row.slug}>
                    {row.title}
                  </option>
                ))}
              </select>
            </label>
            {/* A format is a choice only for a program that has several on sale.
                One format is no choice, and a program with none is taken on its own. */}
            {formats.length > 1 ? (
              <div className={access.stack}>
                <span className={controls.hint}>{t("access_grant_format")}</span>
                <AdminTabs
                  items={formats.map((row) => ({
                    key: row.format,
                    label: row.label || t(FORMAT_LABEL_KEY[row.format]),
                  }))}
                  activeKey={format?.format ?? ""}
                  onChange={setFormatChoice}
                />
              </div>
            ) : null}
          </div>

          <div className={access.stack}>
            <span className={access.cap}>{t("access_grant_term")}</span>
            {group ? (
              <>
                <label className={controls.field}>
                  <span className={controls.fieldCaption}>{t("access_grant_from")}</span>
                  <AdminDateField
                    value={format?.cohortStartsOn ?? ""}
                    onChange={() => {}}
                    disabled
                    locale={locale}
                    labels={dateLabels}
                  />
                </label>
                <p className={controls.hint}>{t("access_grant_group_hint")}</p>
              </>
            ) : (
              <>
                {/* A promo link carries a price and a 48-hour timer, not a term: what
                    the buyer gets afterwards is the program's own offer, so the
                    period is not offered there (and not hidden — the choice is
                    shown dimmed with its reason). */}
                <AdminTabs
                  items={[
                    { key: "offer", label: t("access_grant_term_offer") },
                    { key: "period", label: t("access_grant_term_period"), disabled: promo },
                  ]}
                  activeKey={promo ? "offer" : term}
                  onChange={(key) => setTerm(key as Term)}
                />
                {promo || term === "offer" ? (
                  <p className={controls.hint}>
                    {promo ? t("access_promo_term_hint") : t("access_grant_term_offer_hint")}
                  </p>
                ) : (
                  <>
                    <div className={access.grantMore}>
                      <div className={`${controls.field} ${access.spanFull} ${access.spanCourse}`}>
                        <span className={controls.fieldCaption}>{t("access_grant_from")}</span>
                        <AdminDateField value={from} onChange={setFrom} locale={locale} labels={dateLabels} />
                      </div>
                      <div className={`${controls.field} ${access.spanFull} ${access.spanCourse}`}>
                        <span className={controls.fieldCaption}>{t("access_grant_deadline")}</span>
                        <AdminDateField
                          value={openEnd ? "" : to}
                          onChange={setTo}
                          disabled={openEnd}
                          locale={locale}
                          labels={dateLabels}
                        />
                      </div>
                    </div>
                    {/* A label of its own, not wrapped around the date: a <label>
                        binds to its first labelable descendant, so nesting the tick
                        under the date's label would focus the date instead of
                        ticking the box. */}
                    <label className={access.check}>
                      <input
                        type="checkbox"
                        checked={openEnd}
                        onChange={(e) => setOpenEnd(e.target.checked)}
                        className={access.checkBox}
                      />
                      {t("access_grant_open_end")}
                    </label>
                  </>
                )}
              </>
            )}
          </div>

          <div className={access.stack}>
            <span className={access.cap}>{t("access_grant_basis")}</span>
            <AdminTabs
              items={[
                { key: "payment", label: t("access_basis_payment") },
                { key: "gift", label: t("access_basis_gift") },
                { key: "promo", label: t("access_basis_promo"), disabled: !promoAvailable },
                { key: "service", label: t("access_basis_service") },
              ]}
              activeKey={basis}
              onChange={(key) => setBasisChoice(key as Basis)}
            />
            {!promoAvailable ? <p className={controls.hint}>{t("access_basis_promo_unavailable")}</p> : null}
            {basis === "payment" ? (
              <>
                <div className={access.grantMore}>
                  <label className={`${controls.field} ${access.spanAmount}`}>
                    <span className={controls.fieldCaption}>{t("access_grant_amount")}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={controls.input}
                    />
                  </label>
                  <label className={`${controls.field} ${access.spanCurrency}`}>
                    <span className={controls.fieldCaption}>{t("access_grant_currency")}</span>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={controls.select}>
                      {PAYMENT_CURRENCIES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={`${controls.field} ${access.spanFull} ${access.spanNote}`}>
                    <span className={controls.fieldCaption}>{t("access_grant_note")}</span>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className={controls.input}
                    />
                  </label>
                </div>
                <p className={controls.hint}>{t("access_basis_payment_hint")}</p>
                {paymentTooMany ? (
                  <p className={controls.hint} role="alert">
                    {t("access_basis_payment_single")}
                  </p>
                ) : null}
              </>
            ) : null}
            {promo ? (
              <>
                <div className={access.grantMore}>
                  <label className={`${controls.field} ${access.spanFull} ${access.spanCourse}`}>
                    <span className={controls.fieldCaption}>{t("access_grant_promo_channel")}</span>
                    <input
                      type="text"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                      placeholder="telegram"
                      autoCapitalize="none"
                      spellCheck={false}
                      className={controls.input}
                    />
                  </label>
                  <label className={`${controls.field} ${access.spanFull} ${access.spanCourse}`}>
                    <span className={controls.fieldCaption}>{t("access_grant_promo_campaign")}</span>
                    <input
                      type="text"
                      value={campaign}
                      onChange={(e) => setCampaign(e.target.value)}
                      placeholder="launch"
                      autoCapitalize="none"
                      spellCheck={false}
                      className={controls.input}
                    />
                  </label>
                </div>
                <p className={controls.hint}>{t("access_basis_promo_hint")}</p>
              </>
            ) : null}
          </div>

          {!promo ? (
            <div className={access.grantMore}>
              <label className={`${controls.field} ${access.spanFull} ${access.spanCourse}`}>
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
              {/* One person, one role: an admin act that must not ride along on a paste. */}
              {canGrantRoles && single ? (
                <label className={`${controls.field} ${access.spanFull} ${access.spanCourse}`}>
                  <span className={controls.fieldCaption}>{t("access_grant_role")}</span>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className={controls.select}>
                    {GRANTABLE_ROLES.map((value) => (
                      <option key={value} value={value}>
                        {value === "user" ? t("access_grant_role_none") : value}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {/* The link a person follows into the course. A promo has its own, per
              person, in the result; the course's plain one would send them past
              the discount. */}
          {!promo ? (
            <div className={access.stack}>
              <span className={access.cap}>{t("access_grant_links")}</span>
              <div className={access.linkRow}>
                <span className={access.linkText}>
                  <b>{t("access_grant_link_course")}</b>
                  <span className={access.linkAddress}>{link}</span>
                </span>
                <button type="button" onClick={() => copy(link)} className={`${controls.action} cw-surface-2`}>
                  <Icon name="copy" size={16} />
                  {t("access_grant_copy")}
                </button>
              </div>
              <p className={controls.hint}>{t("access_grant_link_hint")}</p>
            </div>
          ) : null}
        </div>
      )}
    </AdminModal>
  );
}

function GrantResult({
  result,
  errorText,
  onCopy,
}: {
  result: Result;
  errorText: (message: string) => string;
  onCopy: (text: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className={access.stack}>
      <div className={access.summary}>
        {result.tiles.map((tile) => (
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
                {result.links ? <th className={surfaces.th}>{t("access_promo_col_link")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.email} className={surfaces.row}>
                  <td className={surfaces.tdCode}>{row.email}</td>
                  <td className={surfaces.td}>
                    <StateBadge tone={row.tone}>{t(row.outcome as Parameters<typeof t>[0])}</StateBadge>
                    {row.accountCreated ? <> · {t("access_bulk_account_created")}</> : null}
                    {row.error ? <> · {errorText(row.error)}</> : null}
                  </td>
                  {result.links ? (
                    <td className={surfaces.td}>
                      {row.link ? (
                        <button
                          type="button"
                          onClick={() => onCopy(row.link ?? "")}
                          className={`${controls.action} cw-surface-2`}
                        >
                          <Icon name="copy" size={16} />
                          {t("access_grant_copy")}
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {result.links ? <p className={controls.hint}>{t("access_promo_expiry")}</p> : null}
    </div>
  );
}
