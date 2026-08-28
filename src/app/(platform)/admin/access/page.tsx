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
import { AdminDateField } from "@/components/admin/AdminDateField";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { supabaseClient } from "@/lib/supabaseClient";
import { getErrorMessage } from "@/lib/errors";
import { getAdminLocale } from "@/lib/adminLocale";
import type { CourseRow, LearnerAccountRow, LearnerRow, LearnerStatus, PersonRow } from "@/lib/admin/accessTypes";
import { deadlineInputValue, ELEVATED_ROLES, grantDeadlineValue, GRANTABLE_ROLES, PAYMENT_CURRENCIES } from "@/lib/admin/accessTypes";

const LIMIT = 50;

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

function PlusGlyph() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="cw-page-title mb-1">{t("access_title")}</h2>
                <p className="cw-page-subtitle">{t("access_subtitle")}</p>
            </div>

            {/* NO TAB BAR. There were four: three views of PEOPLE and one of
                COURSES. The three collapsed into this one list with facets, and
                the fourth moved to /admin/catalog, where the other views of a
                course already were — one tab is not a tab.
                See docs/admin-access-shape-2026-08-28.md. */}
            <PeopleTab
                courses={courses}
                canGrantRoles={canGrantRoles}
                locale={locale}
                errorText={errorText}
                onCoursesChanged={reloadCourses}
            />
        </div>
    );
}

/** The date field's labels, in one place: three call sites, one wording. */
function useDateLabels() {
    const { t } = useI18n();
    return useMemo(
        () => ({
            open: t("access_date_open"),
            clear: t("access_deadline_clear"),
            today: t("access_date_today"),
            placeholder: t("access_date_placeholder"),
        }),
        [t]
    );
}

/**
 * Changing one account's role — the only writer, called from both tables.
 *
 * IT WAS TWO. The Roles tab and the Accounts tab each had their own copy: same POST,
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

/* ────────────────────────────── People ───────────────────────────── */

/**
 * One list of people, and everything about one of them in their own row.
 *
 * It was two tabs — Учні (accounts holding a course) and Акаунти (accounts) —
 * which were one list seen from two ends. "Holds a course" is an attribute of a
 * person, so it is the `access` facet here rather than a tab of its own. Step 2
 * of docs/admin-access-shape-2026-08-28.md.
 */
function PeopleTab({
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
    /** A role to narrow to, or `staff` for any elevated one. Empty is everybody. */
    const [roleFilter, setRoleFilter] = useState("");
    /** Everybody, only people holding a course, or only people holding none. */
    const [accessFilter, setAccessFilter] = useState<"" | "enrolled" | "none">("");
    const [page, setPage] = useState(0);

    const [items, setItems] = useState<PersonRow[]>([]);
    const [total, setTotal] = useState(0);
    const [truncated, setTruncated] = useState(false);
    const [summary, setSummary] = useState<Record<LearnerStatus, number> | null>(null);
    const [selfId, setSelfId] = useState<string | null>(null);
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
    // Unticked by default: the safe answer for a course with a paid offer is
    // to sell it on that offer's own term, not to override it with forever
    // every time someone opens this form. A course with no offer to inherit
    // (a gift, a review grant) still ends up perpetual — the same as ticking
    // this by hand — because `provisionAccess` reads no term as no deadline.
    const [grantForever, setGrantForever] = useState(false);
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
    /** Which account is being given another course, so only its own row goes busy. */
    const [grantingTo, setGrantingTo] = useState<string | null>(null);
    const dateLabels = useDateLabels();
    /** The grant form's dialog. Closed on arrival: reading the list is the common visit. */
    const [grantOpen, setGrantOpen] = useState(false);
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
            if (roleFilter) params.set("role", roleFilter);
            if (accessFilter) params.set("access", accessFilter);
            params.set("limit", String(LIMIT));
            params.set("offset", String(page * LIMIT));

            const payload = await authFetch(`/api/admin/access/learners?${params}`) as {
                items: PersonRow[];
                total: number;
                truncated: boolean;
                summary: Record<LearnerStatus, number>;
                selfId?: string;
            };
            if (reqId !== requestSeq.current) return;
            setItems(payload.items ?? []);
            setTotal(payload.total ?? 0);
            setTruncated(Boolean(payload.truncated));
            setSummary(payload.summary ?? null);
            setSelfId(payload.selfId ?? null);
        } catch (e) {
            if (reqId !== requestSeq.current) return;
            setError(errorText(getErrorMessage(e)));
        } finally {
            if (reqId === requestSeq.current) setLoading(false);
        }
    }, [debouncedQ, courseSlug, status, roleFilter, accessFilter, page, errorText]);

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
            // Only on success: a failed grant keeps the dialog and everything
            // typed into it, which is the whole point of failing inside one.
            setGrantOpen(false);
            onCoursesChanged();
            await load();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        } finally {
            setGranting(false);
        }
    };

    /**
     * A second course for somebody already listed.
     *
     * Deliberately the plain case only: no deadline, no payment, no account
     * creation — the account is right there, and the seat can be dated
     * afterwards on the row this creates. The big form stays the place where a
     * sale with money attached is recorded.
     */
    const grantMore = async (account: LearnerAccountRow, slug: string) => {
        if (!account.email) return;
        setGrantingTo(account.authUserId);
        try {
            const payload = await authFetch("/api/admin/access/learners", {
                method: "POST",
                body: JSON.stringify({ email: account.email, course: slug }),
            }) as { created: boolean };
            toast[payload.created ? "success" : "info"](
                payload.created ? t("access_granted") : t("access_already_enrolled")
            );
            onCoursesChanged();
            await load();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        } finally {
            setGrantingTo(null);
        }
    };

    const writeRole = useRoleWrite(errorText, load);

    const setPersonRole = async (account: PersonRow, nextRole: string) => {
        setGrantingTo(account.authUserId);
        await writeRole({ email: account.email, current: account.role, next: nextRole });
        setGrantingTo(null);
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
            {/* THE FORM IS BEHIND A BUTTON NOW. It is the rarest thing on this
                screen — most visits are to read the list or to fix one seat —
                and it was the first and largest thing on it: eight fields and
                two checkboxes pushing the learners it is about below the fold.
                A dialog also gives it room to breathe, which a strip crammed
                into twelve columns never had. */}
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => setGrantOpen(true)}
                    className="px-4 py-2 cw-btn cw-surface-2 text-sm inline-flex items-center gap-2"
                >
                    <PlusGlyph />
                    {t("access_grant_open")}
                </button>
            </div>

            {grantOpen ? (
                <AdminModal
                    title={t("access_grant_title")}
                    description={t("access_grant_hint")}
                    size="lg"
                    onClose={() => setGrantOpen(false)}
                    footer={(
                        <>
                            <button
                                type="button"
                                onClick={() => setGrantOpen(false)}
                                className="px-4 py-2 cw-btn text-sm"
                            >
                                {t("common_close")}
                            </button>
                            <button
                                type="button"
                                onClick={grant}
                                disabled={granting || !grantEmail.trim() || !grantCourse}
                                className="px-4 py-2 cw-btn cw-surface-2 text-sm disabled:opacity-50"
                            >
                                {t("access_grant_submit")}
                            </button>
                        </>
                    )}
                >

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
                <p className="text-xs cw-muted">{t("access_grant_deadline_hint")}</p>

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
                        <div className="flex flex-col gap-1">
                            <span className="text-xs cw-muted">{t("access_grant_deadline")}</span>
                            <AdminDateField
                                value={grantExpiresAt}
                                onChange={setGrantExpiresAt}
                                disabled={grantForever}
                                locale={locale}
                                labels={dateLabels}
                            />
                        </div>
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
                    </div>
                </AdminModal>
            ) : null}

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

            {/* THE FACETS, in the order a question is usually asked: who, then
                what they hold, then which course. Each resets the page — page 3
                of "everybody" is not page 3 of "coaches". */}
            <div className="flex flex-col sm:flex-row gap-2">
                <AdminSearchInput
                    value={q}
                    onChange={setQ}
                    placeholder={t("access_search_learners")}
                    onClear={q ? () => setQ("") : undefined}
                    className="flex-1"
                />
                <select
                    value={roleFilter}
                    onChange={(e) => {
                        setRoleFilter(e.target.value);
                        setPage(0);
                    }}
                    aria-label={t("access_filter_role")}
                    className="cw-input cw-select pl-3 py-2 text-sm w-full sm:w-44"
                >
                    <option value="">{t("access_filter_role_all")}</option>
                    <option value="staff">{t("access_filter_role_staff")}</option>
                    {ELEVATED_ROLES.map((role) => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </select>
                <select
                    value={accessFilter}
                    onChange={(e) => {
                        setAccessFilter(e.target.value as "" | "enrolled" | "none");
                        setPage(0);
                    }}
                    aria-label={t("access_filter_access")}
                    className="cw-input cw-select pl-3 py-2 text-sm w-full sm:w-44"
                >
                    <option value="">{t("access_filter_access_all")}</option>
                    <option value="enrolled">{t("access_filter_access_enrolled")}</option>
                    <option value="none">{t("access_filter_access_none")}</option>
                </select>
                <select
                    value={courseSlug}
                    onChange={(e) => {
                        setCourseSlug(e.target.value);
                        setPage(0);
                    }}
                    aria-label={t("access_grant_course")}
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
                <AdminEmptyState className="py-16" iconWrapperClassName="w-12 h-12 rounded-full" icon={<EmptyIcon />} description={t("access_empty_accounts")} />
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
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-medium cw-text truncate">
                                                {account.email ?? account.authUserId}
                                            </p>
                                            {/* Only an elevated role is worth a badge — `user` is everyone. */}
                                            {account.role && account.role !== "user" ? (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium cw-surface-2 cw-text uppercase tracking-wide">
                                                    {account.role}
                                                </span>
                                            ) : null}
                                            {account.authUserId === selfId ? (
                                                <span className="text-[10px] cw-muted uppercase tracking-wide">{t("access_role_self")}</span>
                                            ) : null}
                                        </div>
                                        <div className="text-xs cw-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                            <span>{t("access_col_courses")}: {account.courses.length}</span>
                                            {account.fullName ? <span className="truncate">{account.fullName}</span> : null}
                                            {account.ownedCourses > 0 ? (
                                                <span>{t("access_role_owned_courses")}: {account.ownedCourses}</span>
                                            ) : null}
                                            {account.purchases > 0 ? (
                                                <span>{t("access_accounts_purchases")}: {account.purchases}</span>
                                            ) : null}
                                            {/* Activity when there is any, otherwise
                                                when they last signed in — an account
                                                that holds no course has no activity to
                                                report, and "немає активності" on every
                                                such row says nothing. */}
                                            <span>
                                                {account.lastActivityAt
                                                    ? `${t("access_col_last_activity")}: ${new Date(account.lastActivityAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}`
                                                    : account.lastSignInAt
                                                      ? `${t("access_role_last_sign_in")}: ${new Date(account.lastSignInAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}`
                                                      : t("access_accounts_never_signed_in")}
                                            </span>
                                        </div>
                                    </div>

                                    {/* No lesson tally here. Summed across every
                                        course a person holds, "7/77" answers no
                                        question anybody has: it is not progress
                                        in anything, since the courses are of
                                        different lengths and only some are even
                                        started. The per-COURSE count inside the
                                        fold is the real one, and it is one click
                                        away. */}
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
                                                        <AdminDateField
                                                            value={draft}
                                                            onChange={(next) =>
                                                                setDeadlineDraft((prev) => ({ ...prev, [row.enrollmentId]: next }))
                                                            }
                                                            locale={locale}
                                                            labels={dateLabels}
                                                            className="w-44"
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

                                        {/* ANOTHER COURSE, FROM HERE. Giving a
                                            second course to somebody already on
                                            the shelf meant scrolling back to the
                                            form at the top and retyping an email
                                            that is on screen — with the risk of
                                            typing it wrong and quietly creating
                                            a second account. The person is
                                            already identified; only the course
                                            is missing. */}
                                        <AddCourseRow
                                            email={account.email}
                                            courses={courses}
                                            taken={account.courses.map((row) => row.courseSlug)}
                                            busy={grantingTo === account.authUserId}
                                            onGrant={(slug) => void grantMore(account, slug)}
                                        />

                                        {/* THE ROLE, on the person it belongs
                                            to. It was on a table of its own, and
                                            before that on a second table of the
                                            same people; here it sits beside what
                                            they hold, which is the other half of
                                            the same question. Admin-only, and
                                            never on your own row — the API
                                            answers `cannot_change_own_role` with
                                            a 409, and a control that cannot work
                                            should not be offered. */}
                                        {canGrantRoles && account.email && account.authUserId !== selfId ? (
                                            <div className="flex flex-wrap items-center gap-2 pl-5 pt-1">
                                                <span className="text-xs cw-muted">{t("access_filter_role")}</span>
                                                <select
                                                    value={account.role ?? "user"}
                                                    disabled={grantingTo === account.authUserId}
                                                    onChange={(e) => void setPersonRole(account, e.target.value)}
                                                    aria-label={t("access_filter_role")}
                                                    className="cw-input cw-select pl-3 py-1.5 text-xs disabled:opacity-50"
                                                >
                                                    {GRANTABLE_ROLES.map((role) => (
                                                        <option key={role} value={role}>
                                                            {role === "user" ? t("access_grant_role_none") : role}
                                                        </option>
                                                    ))}
                                                </select>
                                                {account.roleUpdatedAt && account.role && account.role !== "user" ? (
                                                    <span className="text-xs cw-muted">
                                                        {new Date(account.roleUpdatedAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : null}
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

/**
 * "Give this person another course", inside their own card.
 *
 * COURSES THEY ALREADY HAVE ARE NOT OFFERED. The list above shows what they
 * hold, so repeating those here is offering an action whose only outcome is the
 * "already enrolled" notice. When nothing is left, the row says so instead of
 * showing an empty select beside a button that cannot do anything.
 */
function AddCourseRow({
    email,
    courses,
    taken,
    busy,
    onGrant,
}: {
    email: string | null;
    courses: CourseRow[];
    taken: string[];
    busy: boolean;
    onGrant: (slug: string) => void;
}) {
    const { t } = useI18n();
    const available = useMemo(
        () => courses.filter((course) => !taken.includes(course.slug)),
        [courses, taken]
    );
    const [slug, setSlug] = useState("");

    // The first course that is actually on offer, re-picked when the list
    // changes underneath — granting one removes it from `available`.
    const selected = available.some((course) => course.slug === slug) ? slug : available[0]?.slug ?? "";

    if (!email) return null;

    if (available.length === 0) {
        return <p className="text-xs cw-muted pl-5 pt-1">{t("access_add_course_all")}</p>;
    }

    return (
        <div className="flex flex-wrap items-center gap-2 pl-5 pt-1">
            <span className="text-xs cw-muted">{t("access_add_course")}</span>
            <select
                value={selected}
                onChange={(e) => setSlug(e.target.value)}
                aria-label={t("access_add_course")}
                className="cw-input cw-select pl-3 py-1.5 text-xs"
            >
                {available.map((course) => (
                    <option key={course.id} value={course.slug}>{course.title}</option>
                ))}
            </select>
            <button
                type="button"
                disabled={busy || !selected}
                onClick={() => onGrant(selected)}
                className="px-3 py-1.5 cw-btn cw-surface-2 text-xs disabled:opacity-50"
            >
                {t("access_add_course_submit")}
            </button>
        </div>
    );
}
