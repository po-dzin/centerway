"use client";

/**
 * Access — the panel's answer to "who is learning what" and "who may do what".
 *
 * Four tabs, one per store the CLI scripts used to reach:
 *   · Learners — one row per person, their courses folded inside, plus
 *                grant/revoke (revoke is still per course, not per person)
 *   · Accounts — platform_users, everyone who has signed in at all. The other
 *                three tabs each answer a narrower question, so an account that
 *                merely exists used to appear in none of them
 *   · Roles    — user_roles, the one role store
 *   · Builder  — lms_courses.author_id, ownership per row rather than a role
 *
 * Role and authorship writes are admin-only; the API enforces it and this page
 * hides the forms for `support` rather than letting them fail at submit.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminTabPanel, useStickyTab } from "@/components/admin/AdminTabPanel";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { supabaseClient } from "@/lib/supabaseClient";
import { getErrorMessage } from "@/lib/errors";
import { getAdminLocale } from "@/lib/adminLocale";
import type { AccountRow, CourseRow, LearnerAccountRow, LearnerRow, LearnerStatus, RoleRow } from "@/lib/admin/accessTypes";
import { deadlineInputValue, grantDeadlineValue, GRANTABLE_ROLES, PAYMENT_CURRENCIES } from "@/lib/admin/accessTypes";

const LIMIT = 50;

const ACCESS_TABS = ["learners", "accounts", "roles", "builder"] as const;
type AccessTab = (typeof ACCESS_TABS)[number];

const STATUS_KEYS: LearnerStatus[] = ["not_started", "in_progress", "stalled", "completed"];

const STATUS_LABEL_KEY = {
    not_started: "access_status_not_started",
    in_progress: "access_status_in_progress",
    stalled: "access_status_stalled",
    completed: "access_status_completed",
} as const;

const STATUS_DOT: Record<LearnerStatus, string> = {
    not_started: "cw-status-pending-dot",
    in_progress: "cw-status-running-dot",
    stalled: "cw-status-failed-dot",
    completed: "cw-status-success-dot",
};

async function authFetch(input: string, init: RequestInit = {}) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch(input, {
        ...init,
        headers: {
            ...(init.headers ?? {}),
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String((payload as { error?: string }).error ?? res.status));
    return payload;
}

async function fetchCourses(): Promise<{ items: CourseRow[]; canGrant: boolean }> {
    const payload = await authFetch("/api/admin/access/courses") as { items?: CourseRow[]; canGrant?: boolean };
    return { items: payload.items ?? [], canGrant: Boolean(payload.canGrant) };
}

function EmptyIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cw-muted">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`cw-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

export default function AccessPage() {
    const { lang, t } = useI18n();
    const locale = getAdminLocale(lang);
    const toast = useToast();

    const [tab, setTab] = useStickyTab<AccessTab>("access", "learners", ACCESS_TABS);

    // Shared: the course list feeds the grant form, the course filter and the
    // builder tab, so it is fetched once for the page rather than per tab.
    const [courses, setCourses] = useState<CourseRow[]>([]);
    const [canGrantRoles, setCanGrantRoles] = useState(false);

    const errorText = useCallback((message: string) => {
        const known: Record<string, string> = {
            account_not_found: t("access_error_account_not_found"),
            course_not_found: t("access_error_course_not_found"),
            enrollment_not_found: t("access_error_enrollment_not_found"),
            expires_at_invalid: t("access_error_expires_at_invalid"),
            amount_invalid: t("access_error_amount_invalid"),
            currency_invalid: t("access_error_currency_invalid"),
            cannot_change_own_role: t("access_error_cannot_change_own_role"),
            Forbidden: t("access_error_forbidden"),
        };
        return known[message] ?? message;
    }, [t]);

    // Bumping this refetches the course list — a grant or an authorship change
    // in a child tab changes learner counts and author emails shown here.
    const [coursesToken, setCoursesToken] = useState(0);
    const reloadCourses = useCallback(() => setCoursesToken((value) => value + 1), []);

    useEffect(() => {
        let mounted = true;
        fetchCourses()
            .then((payload) => {
                if (!mounted) return;
                setCourses(payload.items);
                setCanGrantRoles(payload.canGrant);
            })
            .catch((e: unknown) => {
                if (mounted) toast.error(errorText(getErrorMessage(e)));
            });
        return () => {
            mounted = false;
        };
    }, [coursesToken, toast, errorText]);

    const TABS = [
        { key: "learners", label: t("access_tab_learners") },
        { key: "accounts", label: t("access_tab_accounts") },
        { key: "roles", label: t("access_tab_roles") },
        { key: "builder", label: t("access_tab_builder") },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="cw-page-title mb-1">{t("access_title")}</h2>
                <p className="cw-page-subtitle">{t("access_subtitle")}</p>
            </div>

            <AdminTabs
                items={TABS}
                activeKey={tab}
                onChange={(key) => setTab(key as AccessTab)}
                className="overflow-x-auto no-scrollbar"
            />

            {/* Panels, not a ternary: a tab you have opened stays mounted, so a
                half-typed grant, a refined search and an opened accordion are
                still there when you come back from checking a role. See
                AdminTabPanel for why this is not a saved-state store. */}
            <AdminTabPanel active={tab === "learners"}>
                <LearnersTab
                    courses={courses}
                    canGrantRoles={canGrantRoles}
                    locale={locale}
                    errorText={errorText}
                    onCoursesChanged={reloadCourses}
                />
            </AdminTabPanel>
            <AdminTabPanel active={tab === "accounts"}>
                <AccountsTab
                    courses={courses}
                    canGrant={canGrantRoles}
                    locale={locale}
                    errorText={errorText}
                    onCoursesChanged={reloadCourses}
                />
            </AdminTabPanel>
            <AdminTabPanel active={tab === "roles"}>
                <RolesTab canGrant={canGrantRoles} locale={locale} errorText={errorText} />
            </AdminTabPanel>
            <AdminTabPanel active={tab === "builder"}>
                <BuilderTab courses={courses} canGrant={canGrantRoles} locale={locale} errorText={errorText} onChanged={reloadCourses} />
            </AdminTabPanel>
        </div>
    );
}

/**
 * Changing one account's role — the only writer, called from both tables.
 *
 * IT WAS TWO. `RolesTab` and `AccountsTab` each had their own copy: same POST,
 * same "user means remove" toast, and same confirmation before demoting an
 * admin. That last one is a safety rule, and a safety rule with two copies is
 * one that will eventually exist in only one of them — the next guard anybody
 * adds (refusing to demote the last admin, say) lands in whichever file they
 * had open and leaves the other hole standing.
 *
 * The busy flag stays with the caller: one table disables a row, the other
 * disables its own control, and that is a rendering decision rather than part
 * of the write.
 *
 * Returns whether anything was written, so a caller can skip its reload.
 */
function useRoleWrite(errorText: (message: string) => string, reload: () => Promise<void> | void) {
    const { t } = useI18n();
    const toast = useToast();

    return useCallback(
        async (input: { email: string | null; current: string | null; next: string }) => {
            // `null` is the ordinary role, not a missing one: `user_roles` holds
            // a row per account and the tables that omit it mean "user".
            const current = input.current ?? "user";
            if (!input.email || input.next === current) return false;
            if (current === "admin" && !window.confirm(t("access_role_demote_confirm"))) return false;

            try {
                await authFetch("/api/admin/access/roles", {
                    method: "POST",
                    body: JSON.stringify({ email: input.email, role: input.next }),
                });
                toast.success(input.next === "user" ? t("access_role_removed") : t("access_role_set"));
                await reload();
                return true;
            } catch (e) {
                toast.error(errorText(getErrorMessage(e)));
                return false;
            }
        },
        [t, toast, errorText, reload]
    );
}

/* ───────────────────────────── Learners ───────────────────────────── */

function LearnersTab({
    courses,
    canGrantRoles,
    locale,
    errorText,
    onCoursesChanged,
}: {
    courses: CourseRow[];
    /** Admin-only. Role writes are refused for `support` by the API, so the control is not offered. */
    canGrantRoles: boolean;
    locale: string;
    errorText: (message: string) => string;
    onCoursesChanged: () => void;
}) {
    const { t } = useI18n();
    const toast = useToast();

    const [q, setQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [courseSlug, setCourseSlug] = useState("");
    const [status, setStatus] = useState<LearnerStatus | "">("");
    const [page, setPage] = useState(0);

    const [items, setItems] = useState<LearnerAccountRow[]>([]);
    const [total, setTotal] = useState(0);
    const [truncated, setTruncated] = useState(false);
    const [summary, setSummary] = useState<Record<LearnerStatus, number> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [grantEmail, setGrantEmail] = useState("");
    const [grantCourse, setGrantCourse] = useState("");
    const [granting, setGranting] = useState(false);

    // The hand-made sale: a person who may not exist yet, money that arrived off
    // the payment provider, and a date the access ends on. All optional except
    // the email and the course — a gift and a paid enrollment take the same form.
    const [grantName, setGrantName] = useState("");
    const [grantCreateAccount, setGrantCreateAccount] = useState(false);
    const [grantExpiresAt, setGrantExpiresAt] = useState("");
    /* Perpetual is the DEFAULT, and stated rather than implied. An empty date
       has always meant "never expires" — the API reads `null` that way and
       `isEnrollmentExpired` agrees — but a blank date field says that to nobody,
       and the one form that sells a course by hand should not make its most
       common outcome the one you have to know a rule to get. Ticked, the date
       goes dim rather than away: hiding it moves the row underneath, and an
       operator who typed a date before ticking should get it back on untick. */
    const [grantForever, setGrantForever] = useState(true);
    const [grantAmount, setGrantAmount] = useState("");
    const [grantCurrency, setGrantCurrency] = useState<string>(PAYMENT_CURRENCIES[0]);
    const [grantNote, setGrantNote] = useState("");
    /* The role, set on the same form that can create the account.
       `user` is "no elevation" and is what an account gets anyway, so the field
       is only sent when it is something else — see `grant`. Assigning a role
       used to require the account to exist first (`setRole` resolves by email
       and 404s otherwise), which put the one form that CREATES accounts and the
       one form that assigns roles on opposite sides of that requirement. */
    const [grantRole, setGrantRole] = useState<string>("user");

    // Deadline edits, keyed by enrollment so two open rows never share a draft.
    const [deadlineDraft, setDeadlineDraft] = useState<Record<string, string>>({});
    const [savingDeadline, setSavingDeadline] = useState<string | null>(null);

    // Which people have their course list open. Keyed by account id rather than
    // by index so a reload or a page change cannot open someone else's row.
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const toggle = (authUserId: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (!next.delete(authUserId)) next.add(authUserId);
            return next;
        });

    const requestSeq = useRef(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQ(q);
            setPage(0);
        }, 350);
        return () => clearTimeout(timer);
    }, [q]);

    useEffect(() => {
        if (!grantCourse && courses.length > 0) setGrantCourse(courses[0].slug);
    }, [courses, grantCourse]);

    const load = useCallback(async () => {
        requestSeq.current += 1;
        const reqId = requestSeq.current;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (debouncedQ) params.set("q", debouncedQ);
            if (courseSlug) params.set("course", courseSlug);
            if (status) params.set("status", status);
            params.set("limit", String(LIMIT));
            params.set("offset", String(page * LIMIT));

            const payload = await authFetch(`/api/admin/access/learners?${params}`) as {
                items: LearnerAccountRow[];
                total: number;
                truncated: boolean;
                summary: Record<LearnerStatus, number>;
            };
            if (reqId !== requestSeq.current) return;
            setItems(payload.items ?? []);
            setTotal(payload.total ?? 0);
            setTruncated(Boolean(payload.truncated));
            setSummary(payload.summary ?? null);
        } catch (e) {
            if (reqId !== requestSeq.current) return;
            setError(errorText(getErrorMessage(e)));
        } finally {
            if (reqId === requestSeq.current) setLoading(false);
        }
    }, [debouncedQ, courseSlug, status, page, errorText]);

    useEffect(() => {
        void load();
    }, [load]);

    const grant = async () => {
        if (!grantEmail.trim() || !grantCourse) return;
        setGranting(true);
        try {
            const payload = await authFetch("/api/admin/access/learners", {
                method: "POST",
                body: JSON.stringify({
                    email: grantEmail.trim(),
                    course: grantCourse,
                    fullName: grantName.trim() || null,
                    createAccount: grantCreateAccount,
                    expiresAt: grantDeadlineValue(grantForever, grantExpiresAt),
                    // Omitted rather than sent as "user": the API treats absence
                    // as "leave the role alone", which is what an operator who
                    // never touched the field meant.
                    role: canGrantRoles && grantRole !== "user" ? grantRole : undefined,
                    payment: grantAmount.trim()
                        ? { amount: Number(grantAmount), currency: grantCurrency, note: grantNote.trim() || null }
                        : null,
                }),
            }) as { created: boolean; accountCreated: boolean; orderRef: string | null; role: string | null };

            // Three things may have happened; the toast names the one the
            // operator is least sure about — money is the part they cannot
            // check by looking at the list underneath.
            toast[payload.created ? "success" : "info"](
                payload.orderRef
                    ? t("access_granted_with_payment")
                    : payload.created
                      ? t("access_granted")
                      : t("access_already_enrolled")
            );
            if (payload.accountCreated) toast.info(t("access_account_created"));
            if (payload.role) toast.info(`${t("access_role_set")}: ${payload.role}`);

            setGrantEmail("");
            setGrantName("");
            setGrantAmount("");
            setGrantNote("");
            setGrantCreateAccount(false);
            setGrantRole("user");
            onCoursesChanged();
            await load();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        } finally {
            setGranting(false);
        }
    };

    // Takes the value explicitly rather than reading the draft map: "clear" sets
    // the draft and saves in the same click, and a state update is not readable
    // yet at that point — it would have saved the value it just replaced.
    const saveDeadline = async (enrollmentId: string, value: string) => {
        setSavingDeadline(enrollmentId);
        try {
            await authFetch("/api/admin/access/learners", {
                method: "PATCH",
                body: JSON.stringify({ enrollmentId, expiresAt: value || null }),
            });
            toast.success(value ? t("access_deadline_saved") : t("access_deadline_cleared"));
            setDeadlineDraft((prev) => {
                const next = { ...prev };
                delete next[enrollmentId];
                return next;
            });
            await load();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        } finally {
            setSavingDeadline(null);
        }
    };

    /**
     * Every change to an existing seat, through one endpoint.
     *
     * They read as one decision to the operator — close it, open it, ban —
     * so they are one call with an `action`, and one place that reloads the
     * table afterwards. The two destructive ones ask first; reactivating and
     * unblocking give access back and need no confirmation.
     */
    const seatAction = async (
        row: LearnerRow,
        action: "revoke" | "reactivate" | "block" | "unblock",
        confirmKey?: "access_revoke_confirm" | "access_block_confirm"
    ) => {
        if (confirmKey && !window.confirm(t(confirmKey))) return;
        try {
            await authFetch("/api/admin/access/learners", {
                method: "PATCH",
                body: JSON.stringify({ enrollmentId: row.enrollmentId, action }),
            });
            toast.success(
                t(
                    action === "revoke"
                        ? "access_revoked"
                        : action === "reactivate"
                          ? "access_reactivated"
                          : action === "block"
                            ? "access_blocked_toast"
                            : "access_unblocked"
                )
            );
            onCoursesChanged();
            await load();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        }
    };

    const statusTabs: { key: LearnerStatus | ""; label: string }[] = [
        { key: "", label: t("access_status_all") },
        { key: "not_started", label: t("access_status_not_started") },
        { key: "in_progress", label: t("access_status_in_progress") },
        { key: "stalled", label: t("access_status_stalled") },
        { key: "completed", label: t("access_status_completed") },
    ];

    const sourceLabel = (source: string) =>
        source === "manual"
            ? t("access_source_manual")
            : source === "bonus"
              ? t("access_source_bonus")
              : source === "promotion"
                ? t("access_source_promotion")
                : source === "token"
                  ? t("access_source_token")
                  : t("access_source_order");

    /* The state of the DOOR, which is not the state of the learner: the dot
       beside the row still reports progress. Both matter and neither answers
       the other's question. */
    const ACCESS_STATE_KEY = {
        active: "access_state_active",
        expired: "access_state_expired",
        revoked: "access_state_revoked",
        blocked: "access_state_blocked",
    } as const;

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="space-y-4">
            {/* Grant — person, access, deadline, and the money if there was any */}
            <div className="cw-panel p-4 space-y-3">
                <div>
                    <p className="text-sm font-semibold cw-text">{t("access_grant_title")}</p>
                    <p className="text-xs cw-muted mt-1">{t("access_grant_hint")}</p>
                </div>

                {/* Who and what, on one line at desktop width. A twelve-column
                    track rather than a row of flex-1 fields: an email needs
                    room, a date does not, and stretching them equally is what
                    made the panel read as a wall. */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                        type="email"
                        value={grantEmail}
                        onChange={(e) => setGrantEmail(e.target.value)}
                        placeholder={t("access_grant_email")}
                        className="cw-input px-3 py-2 text-sm sm:col-span-5"
                    />
                    <input
                        type="text"
                        value={grantName}
                        onChange={(e) => setGrantName(e.target.value)}
                        placeholder={t("access_grant_name")}
                        className="cw-input px-3 py-2 text-sm sm:col-span-3"
                    />
                    <select
                        value={grantCourse}
                        onChange={(e) => setGrantCourse(e.target.value)}
                        aria-label={t("access_grant_course")}
                        className="cw-input cw-select pl-3 py-2 text-sm sm:col-span-4"
                    >
                        {courses.map((course) => (
                            <option key={course.id} value={course.slug}>
                                {course.title}
                            </option>
                        ))}
                    </select>
                </div>

                <p className="text-xs cw-muted">{t("access_grant_payment_hint")}</p>

                {/* Deadline and money — the two optional halves, on one line.
                    A bare date input says nothing about which date it is, so
                    this row keeps its captions; the fields above do not need
                    them, their placeholders say it. */}
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-2">
                    {/* Two labels, not one wrapping both: a <label> binds to its
                        first labelable descendant, so nesting the checkbox under
                        the date's label would make "Безстроково" focus the date
                        field instead of ticking the box, and read the two out as
                        one name. */}
                    <div className="col-span-2 sm:col-span-3 flex flex-col gap-1">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs cw-muted">{t("access_grant_deadline")}</span>
                            <input
                                type="date"
                                value={grantExpiresAt}
                                onChange={(e) => setGrantExpiresAt(e.target.value)}
                                disabled={grantForever}
                                className="cw-input px-3 py-2 text-sm disabled:opacity-40"
                            />
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cw-muted">
                            <input
                                type="checkbox"
                                checked={grantForever}
                                onChange={(e) => setGrantForever(e.target.checked)}
                                className="shrink-0"
                            />
                            {t("access_grant_forever")}
                        </label>
                    </div>
                    <label className="sm:col-span-2 flex flex-col gap-1">
                        <span className="text-xs cw-muted">{t("access_grant_amount")}</span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={grantAmount}
                            onChange={(e) => setGrantAmount(e.target.value)}
                            className="cw-input px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="sm:col-span-2 flex flex-col gap-1">
                        <span className="text-xs cw-muted">{t("access_grant_currency")}</span>
                        <select
                            value={grantCurrency}
                            onChange={(e) => setGrantCurrency(e.target.value)}
                            className="cw-input cw-select pl-3 py-2 text-sm"
                        >
                            {PAYMENT_CURRENCIES.map((currency) => (
                                <option key={currency} value={currency}>{currency}</option>
                            ))}
                        </select>
                    </label>
                    <label className="col-span-2 sm:col-span-5 flex flex-col gap-1">
                        <span className="text-xs cw-muted">{t("access_grant_note")}</span>
                        <input
                            type="text"
                            value={grantNote}
                            onChange={(e) => setGrantNote(e.target.value)}
                            className="cw-input px-3 py-2 text-sm"
                        />
                    </label>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                    <label className="flex items-start gap-2 text-xs cw-muted flex-1">
                        <input
                            type="checkbox"
                            checked={grantCreateAccount}
                            onChange={(e) => setGrantCreateAccount(e.target.checked)}
                            className="mt-0.5 shrink-0"
                        />
                        <span>{t("access_grant_create_account")}</span>
                    </label>

                    {/* Beside "create the account", because that is when it
                        matters: a brand-new coach or author had to be made here,
                        then found again on another tab to be given their role.
                        Admin-only — the roles API refuses `support`, and a
                        control that 403s is worse than no control. */}
                    {canGrantRoles ? (
                        <label className="flex items-center gap-2 text-xs cw-muted shrink-0">
                            <span>{t("access_grant_role")}</span>
                            <select
                                value={grantRole}
                                onChange={(e) => setGrantRole(e.target.value)}
                                className="cw-input cw-select pl-3 py-2 text-sm"
                            >
                                {GRANTABLE_ROLES.map((value) => (
                                    <option key={value} value={value}>
                                        {value === "user" ? t("access_grant_role_none") : value}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                    <button
                        type="button"
                        onClick={grant}
                        disabled={granting || !grantEmail.trim() || !grantCourse}
                        className="px-4 py-2 cw-btn cw-surface-2 text-sm disabled:opacity-50 w-full sm:w-auto shrink-0"
                    >
                        {t("access_grant_submit")}
                    </button>
                </div>
            </div>

            {/* Summary */}
            {summary ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {STATUS_KEYS.map((key) => (
                        <div key={key} className="cw-panel p-3">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[key]}`} />
                                <p className="text-xs cw-muted truncate">{t(STATUS_LABEL_KEY[key])}</p>
                            </div>
                            <p className="text-xl font-semibold cw-text tabular-nums mt-1">{summary[key]}</p>
                        </div>
                    ))}
                </div>
            ) : null}

            <AdminTabs
                items={statusTabs.map((item) => ({ key: item.key, label: item.label }))}
                activeKey={status}
                onChange={(key) => {
                    setStatus(key as LearnerStatus | "");
                    setPage(0);
                }}
                className="overflow-x-auto no-scrollbar"
            />

            <div className="flex flex-col sm:flex-row gap-2">
                <AdminSearchInput
                    value={q}
                    onChange={setQ}
                    placeholder={t("access_search_learners")}
                    onClear={q ? () => setQ("") : undefined}
                    className="flex-1"
                />
                <select
                    value={courseSlug}
                    onChange={(e) => {
                        setCourseSlug(e.target.value);
                        setPage(0);
                    }}
                    className="cw-input cw-select pl-3 py-2 text-sm w-full sm:w-56"
                >
                    <option value="">{t("access_all_courses")}</option>
                    {courses.map((course) => (
                        <option key={course.id} value={course.slug}>{course.title}</option>
                    ))}
                </select>
            </div>

            {truncated ? <p className="text-xs cw-muted">{t("access_truncated")}</p> : null}

            {loading ? (
                <AdminLoadingState variant="spinner" text={t("access_loading")} />
            ) : error ? (
                <AdminErrorState
                    title={t("common_error")}
                    message={error}
                    action={(
                        <button type="button" onClick={() => void load()} className="px-4 py-2 cw-btn cw-surface-2">
                            {t("analytics_retry")}
                        </button>
                    )}
                />
            ) : items.length === 0 ? (
                <AdminEmptyState className="py-16" iconWrapperClassName="w-12 h-12 rounded-full" icon={<EmptyIcon />} description={t("access_empty_learners")} />
            ) : (
                <div className="space-y-1.5">
                    {items.map((account) => {
                        const open = expanded.has(account.authUserId);
                        return (
                            <div key={account.authUserId} className="cw-list-item p-4">
                                <button
                                    type="button"
                                    onClick={() => toggle(account.authUserId)}
                                    aria-expanded={open}
                                    aria-label={t("access_toggle_courses")}
                                    className="w-full flex items-center gap-4 text-left"
                                >
                                    <span
                                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[account.status]}`}
                                        title={t(STATUS_LABEL_KEY[account.status])}
                                    />

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium cw-text truncate">
                                            {account.email ?? account.authUserId}
                                        </p>
                                        <div className="text-xs cw-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                            <span>{t("access_col_courses")}: {account.courses.length}</span>
                                            {account.fullName ? <span className="truncate">{account.fullName}</span> : null}
                                            <span>
                                                {account.lastActivityAt
                                                    ? `${t("access_col_last_activity")}: ${new Date(account.lastActivityAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}`
                                                    : t("access_no_activity")}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0 hidden sm:block">
                                        <p className="text-sm cw-text tabular-nums">
                                            {account.lessonsTotal > 0
                                                ? `${account.lessonsCompleted}/${account.lessonsTotal}`
                                                : t("access_no_lessons")}
                                        </p>
                                    </div>

                                    <ChevronIcon open={open} />
                                </button>

                                {open ? (
                                    <div className="mt-3 pt-3 border-t border-[var(--cw-border)] space-y-2">
                                        {account.courses.map((row) => {
                                            const stored = deadlineInputValue(row.expiresAt);
                                            const draft = deadlineDraft[row.enrollmentId] ?? stored;
                                            const closed = row.access !== "active";

                                            return (
                                                <div key={row.enrollmentId} className="space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <span
                                                            className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[row.status]}`}
                                                            title={t(STATUS_LABEL_KEY[row.status])}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm cw-text truncate">{row.courseTitle}</p>
                                                            <div className="text-xs cw-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                                                <span className="font-mono">{row.courseSlug}</span>
                                                                <span>{sourceLabel(row.source)}</span>
                                                                <span>
                                                                    {t("access_col_started")}: {new Date(row.startedAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                                                                </span>
                                                                {/* A closed door is not a detail — it is why the
                                                                    learner wrote in, so it is said outright, and it
                                                                    says WHICH kind of closed. */}
                                                                {closed ? (
                                                                    <span className="cw-status-failed-text">
                                                                        {t(ACCESS_STATE_KEY[row.access])}
                                                                        {row.blockedReason ? ` — ${row.blockedReason}` : ""}
                                                                    </span>
                                                                ) : row.daysLeft !== null ? (
                                                                    <span>{row.daysLeft} {t("access_days_left")}</span>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <p className="text-sm cw-text tabular-nums shrink-0 hidden sm:block">
                                                            {row.lessonsTotal > 0 ? `${row.lessonsCompleted}/${row.lessonsTotal}` : t("access_no_lessons")}
                                                        </p>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {row.access === "blocked" ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void seatAction(row, "unblock")}
                                                                    className="px-3 py-1.5 cw-btn cw-surface-2 text-xs"
                                                                >
                                                                    {t("access_unblock")}
                                                                </button>
                                                            ) : (
                                                                <>
                                                                    {row.access === "revoked" ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void seatAction(row, "reactivate")}
                                                                            className="px-3 py-1.5 cw-btn cw-surface-2 text-xs"
                                                                        >
                                                                            {t("access_reactivate")}
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void seatAction(row, "revoke", "access_revoke_confirm")}
                                                                            className="px-3 py-1.5 cw-btn cw-btn-muted text-xs"
                                                                        >
                                                                            {t("access_revoke")}
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void seatAction(row, "block", "access_block_confirm")}
                                                                        className="px-3 py-1.5 cw-btn cw-btn-muted text-xs"
                                                                    >
                                                                        {t("access_block")}
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 pl-5">
                                                        <span className="text-xs cw-muted">{t("access_deadline_label")}</span>
                                                        <input
                                                            type="date"
                                                            value={draft}
                                                            onChange={(e) =>
                                                                setDeadlineDraft((prev) => ({ ...prev, [row.enrollmentId]: e.target.value }))
                                                            }
                                                            className="cw-input px-2 py-1 text-xs"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => void saveDeadline(row.enrollmentId, draft)}
                                                            disabled={savingDeadline === row.enrollmentId || draft === stored}
                                                            className="px-3 py-1.5 cw-btn cw-surface-2 text-xs disabled:opacity-50"
                                                        >
                                                            {t("access_deadline_save")}
                                                        </button>
                                                        {stored ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setDeadlineDraft((prev) => ({ ...prev, [row.enrollmentId]: "" }));
                                                                    void saveDeadline(row.enrollmentId, "");
                                                                }}
                                                                disabled={savingDeadline === row.enrollmentId}
                                                                className="px-3 py-1.5 cw-btn cw-btn-muted text-xs disabled:opacity-50"
                                                            >
                                                                {t("access_deadline_clear")}
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs cw-muted">{t("access_deadline_none")}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && !error && total > LIMIT ? (
                <AdminPagination
                    page={page}
                    totalPages={totalPages}
                    onPrev={() => setPage((p) => Math.max(0, p - 1))}
                    onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                />
            ) : null}
        </div>
    );
}

/* ────────────────────────────── Roles ─────────────────────────────── */

function RolesTab({
    canGrant,
    locale,
    errorText,
}: {
    canGrant: boolean;
    locale: string;
    errorText: (message: string) => string;
}) {
    const { t } = useI18n();
    const toast = useToast();

    const [q, setQ] = useState("");
    const [items, setItems] = useState<RoleRow[]>([]);
    const [selfId, setSelfId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [email, setEmail] = useState("");
    const [role, setRole] = useState<string>("coach");
    const [saving, setSaving] = useState(false);
    // The row currently being written, so only its own controls go disabled.
    const [savingId, setSavingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const payload = await authFetch("/api/admin/access/roles") as { items: RoleRow[]; selfId?: string };
            setItems(payload.items ?? []);
            setSelfId(payload.selfId ?? null);
        } catch (e) {
            setError(errorText(getErrorMessage(e)));
        } finally {
            setLoading(false);
        }
    }, [errorText]);

    const writeRole = useRoleWrite(errorText, load);

    useEffect(() => {
        void load();
    }, [load]);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return items;
        return items.filter((row) => `${row.email ?? ""} ${row.fullName ?? ""}`.toLowerCase().includes(needle));
    }, [items, q]);

    const assign = async () => {
        if (!email.trim()) return;
        setSaving(true);
        try {
            await authFetch("/api/admin/access/roles", {
                method: "POST",
                body: JSON.stringify({ email: email.trim(), role }),
            });
            toast.success(t("access_role_set"));
            setEmail("");
            await load();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        } finally {
            setSaving(false);
        }
    };

    /**
     * Change or drop one row's role.
     *
     * "Remove" is `user`, not a delete: `user_roles` is the one role store and
     * every account is expected to have a row there, so taking a role away
     * means writing the ordinary one back — after which the row leaves this
     * table, which only lists elevated roles.
     */
    const setRowRole = async (row: RoleRow, nextRole: string) => {
        setSavingId(row.authUserId);
        await writeRole({ email: row.email, current: row.role, next: nextRole });
        setSavingId(null);
    };

    return (
        <div className="space-y-4">
            {canGrant ? (
                <div className="cw-panel p-4 space-y-3">
                    <div>
                        <p className="text-sm font-semibold cw-text">{t("access_role_title")}</p>
                        <p className="text-xs cw-muted mt-1">{t("access_role_hint")}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t("access_grant_email")}
                            className="cw-input px-3 py-2.5 text-sm flex-1"
                        />
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="cw-input cw-select pl-3 py-2 text-sm w-full sm:w-40"
                        >
                            {GRANTABLE_ROLES.map((value) => (
                                <option key={value} value={value}>{value}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={assign}
                            disabled={saving || !email.trim()}
                            className="px-4 py-2.5 cw-btn cw-surface-2 text-sm disabled:opacity-50"
                        >
                            {t("access_role_submit")}
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-xs cw-muted">{t("access_role_admin_only")}</p>
            )}

            <AdminSearchInput
                value={q}
                onChange={setQ}
                placeholder={t("access_search_roles")}
                onClear={q ? () => setQ("") : undefined}
            />

            {loading ? (
                <AdminLoadingState variant="spinner" text={t("access_loading")} />
            ) : error ? (
                <AdminErrorState
                    title={t("common_error")}
                    message={error}
                    action={(
                        <button type="button" onClick={() => void load()} className="px-4 py-2 cw-btn cw-surface-2">
                            {t("analytics_retry")}
                        </button>
                    )}
                />
            ) : filtered.length === 0 ? (
                <AdminEmptyState className="py-16" iconWrapperClassName="w-12 h-12 rounded-full" icon={<EmptyIcon />} description={t("access_empty_roles")} />
            ) : (
                <div className="space-y-1.5">
                    {filtered.map((row) => {
                        const isSelf = row.authUserId === selfId;
                        const editable = canGrant && !isSelf && Boolean(row.email);
                        return (
                        <div key={row.authUserId} className="cw-list-item flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium cw-text truncate">{row.email ?? row.authUserId}</p>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium cw-surface-2 cw-text uppercase tracking-wide">
                                        {row.role}
                                    </span>
                                    {isSelf ? <span className="text-[10px] cw-muted uppercase tracking-wide">{t("access_role_self")}</span> : null}
                                </div>
                                <div className="text-xs cw-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                    <span>{t("access_role_owned_courses")}: {row.ownedCourses}</span>
                                    <span>{t("access_role_enrollments")}: {row.enrollments}</span>
                                    {row.lastSignInAt ? (
                                        <span>
                                            {t("access_role_last_sign_in")}: {new Date(row.lastSignInAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            {editable ? (
                                <div className="flex items-center gap-2 shrink-0">
                                    <select
                                        value={row.role}
                                        onChange={(e) => void setRowRole(row, e.target.value)}
                                        disabled={savingId === row.authUserId}
                                        aria-label={t("access_role_title")}
                                        className="cw-input cw-select pl-3 py-2 text-sm w-full sm:w-36 disabled:opacity-50"
                                    >
                                        {GRANTABLE_ROLES.map((value) => (
                                            <option key={value} value={value}>{value}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => void setRowRole(row, "user")}
                                        disabled={savingId === row.authUserId}
                                        className="px-3 py-2 cw-btn cw-btn-muted text-xs disabled:opacity-50"
                                    >
                                        {t("access_role_remove")}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────── Accounts ────────────────────────────── */

/**
 * Everyone who has an account — the list the other three tabs cannot give.
 *
 * Roles show only elevated roles, Learners only people holding a course, and
 * Customers only people who paid. Someone who signed in and did nothing else
 * appeared nowhere, which made them impossible to find on the very surface
 * built for handing out access by hand.
 */
function AccountsTab({
    courses,
    canGrant,
    locale,
    errorText,
    onCoursesChanged,
}: {
    courses: CourseRow[];
    canGrant: boolean;
    locale: string;
    errorText: (message: string) => string;
    onCoursesChanged: () => void;
}) {
    const { t } = useI18n();
    const toast = useToast();

    const [q, setQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [page, setPage] = useState(0);

    const [items, setItems] = useState<AccountRow[]>([]);
    const [total, setTotal] = useState(0);
    const [selfId, setSelfId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // The course each row would be granted, and which row is being written.
    const [grantDraft, setGrantDraft] = useState<Record<string, string>>({});
    const [busyId, setBusyId] = useState<string | null>(null);

    const requestSeq = useRef(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQ(q);
            setPage(0);
        }, 350);
        return () => clearTimeout(timer);
    }, [q]);

    const load = useCallback(async () => {
        requestSeq.current += 1;
        const reqId = requestSeq.current;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (debouncedQ) params.set("q", debouncedQ);
            params.set("limit", String(LIMIT));
            params.set("offset", String(page * LIMIT));

            const payload = await authFetch(`/api/admin/access/accounts?${params}`) as {
                items: AccountRow[];
                total: number;
                selfId?: string;
            };
            if (reqId !== requestSeq.current) return;
            setItems(payload.items ?? []);
            setTotal(payload.total ?? 0);
            setSelfId(payload.selfId ?? null);
        } catch (e) {
            if (reqId !== requestSeq.current) return;
            setError(errorText(getErrorMessage(e)));
        } finally {
            if (reqId === requestSeq.current) setLoading(false);
        }
    }, [debouncedQ, page, errorText]);

    useEffect(() => {
        void load();
    }, [load]);

    const writeRole = useRoleWrite(errorText, load);

    const grant = async (row: AccountRow) => {
        const slug = grantDraft[row.authUserId] ?? courses[0]?.slug;
        if (!row.email || !slug) return;
        setBusyId(row.authUserId);
        try {
            const payload = await authFetch("/api/admin/access/learners", {
                method: "POST",
                body: JSON.stringify({ email: row.email, course: slug }),
            }) as { created: boolean };
            toast[payload.created ? "success" : "info"](
                payload.created ? t("access_granted") : t("access_already_enrolled")
            );
            onCoursesChanged();
            await load();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        } finally {
            setBusyId(null);
        }
    };

    const setRowRole = async (row: AccountRow, nextRole: string) => {
        setBusyId(row.authUserId);
        await writeRole({ email: row.email, current: row.role, next: nextRole });
        setBusyId(null);
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="space-y-4">
            <p className="text-xs cw-muted">{t("access_accounts_hint")}</p>

            <AdminSearchInput
                value={q}
                onChange={setQ}
                placeholder={t("access_search_learners")}
                onClear={q ? () => setQ("") : undefined}
            />

            {loading ? (
                <AdminLoadingState variant="spinner" text={t("access_loading")} />
            ) : error ? (
                <AdminErrorState
                    title={t("common_error")}
                    message={error}
                    action={(
                        <button type="button" onClick={() => void load()} className="px-4 py-2 cw-btn cw-surface-2">
                            {t("analytics_retry")}
                        </button>
                    )}
                />
            ) : items.length === 0 ? (
                <AdminEmptyState className="py-16" iconWrapperClassName="w-12 h-12 rounded-full" icon={<EmptyIcon />} description={t("access_empty_accounts")} />
            ) : (
                <div className="space-y-1.5">
                    {items.map((row) => {
                        const isSelf = row.authUserId === selfId;
                        const busy = busyId === row.authUserId;
                        return (
                            <div key={row.authUserId} className="cw-list-item flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 p-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium cw-text truncate">{row.email ?? row.authUserId}</p>
                                        {/* Only an elevated role is worth a badge — `user` is everyone. */}
                                        {row.role && row.role !== "user" ? (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium cw-surface-2 cw-text uppercase tracking-wide">
                                                {row.role}
                                            </span>
                                        ) : null}
                                        {isSelf ? <span className="text-[10px] cw-muted uppercase tracking-wide">{t("access_role_self")}</span> : null}
                                    </div>
                                    <div className="text-xs cw-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                        {row.fullName ? <span className="truncate">{row.fullName}</span> : null}
                                        {row.provider ? <span>{row.provider}</span> : null}
                                        <span>{t("access_role_enrollments")}: {row.enrollments}</span>
                                        <span>{t("access_accounts_purchases")}: {row.purchases}</span>
                                        <span>
                                            {row.lastSignInAt
                                                ? `${t("access_role_last_sign_in")}: ${new Date(row.lastSignInAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}`
                                                : t("access_accounts_never_signed_in")}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <select
                                        value={grantDraft[row.authUserId] ?? courses[0]?.slug ?? ""}
                                        onChange={(e) => setGrantDraft((prev) => ({ ...prev, [row.authUserId]: e.target.value }))}
                                        aria-label={t("access_grant_course")}
                                        className="cw-input cw-select pl-3 py-2 text-sm flex-1 lg:flex-none lg:w-48"
                                    >
                                        {courses.map((course) => (
                                            <option key={course.id} value={course.slug}>{course.title}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => void grant(row)}
                                        disabled={busy || !row.email || courses.length === 0}
                                        className="px-3 py-2 cw-btn cw-surface-2 text-xs disabled:opacity-50 shrink-0"
                                    >
                                        {t("access_grant_submit")}
                                    </button>
                                    {canGrant && !isSelf && row.email ? (
                                        <select
                                            value={row.role ?? "user"}
                                            onChange={(e) => void setRowRole(row, e.target.value)}
                                            disabled={busy}
                                            aria-label={t("access_role_title")}
                                            className="cw-input cw-select pl-3 py-2 text-sm w-28 shrink-0 disabled:opacity-50"
                                        >
                                            {GRANTABLE_ROLES.map((value) => (
                                                <option key={value} value={value}>{value}</option>
                                            ))}
                                        </select>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && !error && total > LIMIT ? (
                <AdminPagination
                    page={page}
                    totalPages={totalPages}
                    onPrev={() => setPage((p) => Math.max(0, p - 1))}
                    onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                />
            ) : null}
        </div>
    );
}

/* ───────────────────────────── Builder ────────────────────────────── */

function BuilderTab({
    courses,
    canGrant,
    locale,
    errorText,
    onChanged,
}: {
    courses: CourseRow[];
    canGrant: boolean;
    locale: string;
    errorText: (message: string) => string;
    onChanged: () => void;
}) {
    const { t } = useI18n();
    const toast = useToast();
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [savingId, setSavingId] = useState<string | null>(null);
    const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

    const save = async (course: CourseRow, email: string | null) => {
        setSavingId(course.id);
        try {
            await authFetch("/api/admin/access/courses", {
                method: "PATCH",
                body: JSON.stringify({ courseId: course.id, email }),
            });
            toast.success(email ? t("access_author_set") : t("access_author_cleared"));
            setDraft((prev) => ({ ...prev, [course.id]: "" }));
            onChanged();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        } finally {
            setSavingId(null);
        }
    };

    const moderate = async (course: CourseRow, action: "approve" | "request_changes" | "set_visibility", visibility?: CourseRow["visibility"]) => {
        setSavingId(course.id);
        try {
            await authFetch("/api/admin/access/courses", { method: "PATCH", body: JSON.stringify({ courseId: course.id, action, visibility, note: reviewNotes[course.id] }) });
            toast.success(action === "approve" ? "Курс схвалено" : action === "request_changes" ? "Курс повернено автору" : "Видимість оновлено");
            onChanged();
        } catch (e) { toast.error(errorText(getErrorMessage(e))); }
        finally { setSavingId(null); }
    };

    if (courses.length === 0) {
        return <AdminEmptyState className="py-16" iconWrapperClassName="w-12 h-12 rounded-full" icon={<EmptyIcon />} description={t("access_empty_courses")} />;
    }

    return (
        <div className="space-y-4">
            <div className="cw-panel p-4">
                <p className="text-sm font-semibold cw-text">{t("access_builder_title")}</p>
                <p className="text-xs cw-muted mt-1">{t("access_builder_hint")}</p>
                {!canGrant ? <p className="text-xs cw-muted mt-2">{t("access_role_admin_only")}</p> : null}
            </div>

            <div className="space-y-1.5">
                {courses.map((course) => (
                    <div key={course.id} className="cw-list-item p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium cw-text truncate">{course.title}</p>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium cw-surface-2 cw-text uppercase tracking-wide">
                                        {course.status}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium cw-surface-2 cw-text uppercase tracking-wide">{course.hasPendingRevision ? `оновлення · ${course.reviewStatus}` : course.reviewStatus}</span>
                                </div>
                                <div className="text-xs cw-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                    <span className="font-mono">{course.slug}</span>
                                    <span>{t("access_course_learners")}: {course.learners}</span>
                                    <span>{new Date(course.updatedAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0 hidden sm:block">
                                <p className="text-sm cw-text truncate max-w-[220px]">
                                    {course.authorEmail ?? t("access_author_house")}
                                </p>
                            </div>
                        </div>

                        {canGrant && course.reviewEnabled ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                                {course.reviewStatus === "in_review" ? (
                                    <>
                                        <input className="cw-input px-3 py-2 text-sm flex-1" value={reviewNotes[course.id] ?? ""} onChange={(e) => setReviewNotes((prev) => ({ ...prev, [course.id]: e.target.value }))} placeholder="Коментар автору, якщо потрібні зміни" />
                                        <button className="px-4 py-2 cw-btn cw-surface-2 text-sm" disabled={savingId === course.id} onClick={() => void moderate(course, "approve")}>Схвалити</button>
                                        <button className="px-4 py-2 cw-btn cw-btn-muted text-sm" disabled={savingId === course.id} onClick={() => void moderate(course, "request_changes")}>Повернути</button>
                                    </>
                                ) : course.status === "published" && course.reviewStatus === "approved" ? (
                                    <select className="cw-input cw-select pl-3 py-2 text-sm w-full sm:w-48" value={course.visibility} disabled={savingId === course.id} onChange={(e) => void moderate(course, "set_visibility", e.target.value as CourseRow["visibility"])}>
                                        <option value="hidden">Приховано</option><option value="unlisted">За посиланням</option><option value="listed">У каталозі</option>
                                    </select>
                                ) : <p className="text-xs cw-muted">Каталог стане доступним після схвалення й публікації.</p>}
                            </div>
                        ) : null}

                        {canGrant ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="email"
                                    value={draft[course.id] ?? ""}
                                    onChange={(e) => setDraft((prev) => ({ ...prev, [course.id]: e.target.value }))}
                                    placeholder={t("access_author_email")}
                                    className="cw-input px-3 py-2 text-sm flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => save(course, (draft[course.id] ?? "").trim())}
                                    disabled={savingId === course.id || !(draft[course.id] ?? "").trim()}
                                    className="px-4 py-2 cw-btn cw-surface-2 text-sm disabled:opacity-50"
                                >
                                    {t("access_author_assign")}
                                </button>
                                {course.authorId ? (
                                    <button
                                        type="button"
                                        onClick={() => save(course, null)}
                                        disabled={savingId === course.id}
                                        className="px-4 py-2 cw-btn cw-btn-muted text-sm disabled:opacity-50"
                                    >
                                        {t("access_author_clear")}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}
