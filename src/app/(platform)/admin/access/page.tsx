"use client";

/**
 * Access — the panel's answer to "who is learning what" and "who may do what".
 *
 * Three tabs, one per store the CLI scripts used to reach:
 *   · Learners — lms_enrollments + folded progress, plus grant/revoke
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
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { supabaseClient } from "@/lib/supabaseClient";
import { getErrorMessage } from "@/lib/errors";
import { getAdminLocale } from "@/lib/adminLocale";
import type { CourseRow, LearnerRow, LearnerStatus, RoleRow } from "@/lib/admin/accessTypes";
import { GRANTABLE_ROLES } from "@/lib/admin/accessTypes";

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

export default function AccessPage() {
    const { lang, t } = useI18n();
    const locale = getAdminLocale(lang);
    const toast = useToast();

    const [tab, setTab] = useState<"learners" | "roles" | "builder">("learners");

    // Shared: the course list feeds the grant form, the course filter and the
    // builder tab, so it is fetched once for the page rather than per tab.
    const [courses, setCourses] = useState<CourseRow[]>([]);
    const [canGrantRoles, setCanGrantRoles] = useState(false);

    const errorText = useCallback((message: string) => {
        const known: Record<string, string> = {
            account_not_found: t("access_error_account_not_found"),
            course_not_found: t("access_error_course_not_found"),
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
                onChange={(key) => setTab(key as typeof tab)}
                className="overflow-x-auto no-scrollbar"
            />

            {tab === "learners" ? (
                <LearnersTab courses={courses} locale={locale} errorText={errorText} onCoursesChanged={reloadCourses} />
            ) : tab === "roles" ? (
                <RolesTab canGrant={canGrantRoles} locale={locale} errorText={errorText} />
            ) : (
                <BuilderTab courses={courses} canGrant={canGrantRoles} locale={locale} errorText={errorText} onChanged={reloadCourses} />
            )}
        </div>
    );
}

/* ───────────────────────────── Learners ───────────────────────────── */

function LearnersTab({
    courses,
    locale,
    errorText,
    onCoursesChanged,
}: {
    courses: CourseRow[];
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

    const [items, setItems] = useState<LearnerRow[]>([]);
    const [total, setTotal] = useState(0);
    const [truncated, setTruncated] = useState(false);
    const [summary, setSummary] = useState<Record<LearnerStatus, number> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [grantEmail, setGrantEmail] = useState("");
    const [grantCourse, setGrantCourse] = useState("");
    const [granting, setGranting] = useState(false);

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
                items: LearnerRow[];
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
                body: JSON.stringify({ email: grantEmail.trim(), course: grantCourse }),
            }) as { created: boolean };
            toast[payload.created ? "success" : "info"](
                payload.created ? t("access_granted") : t("access_already_enrolled")
            );
            setGrantEmail("");
            onCoursesChanged();
            await load();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        } finally {
            setGranting(false);
        }
    };

    const revoke = async (row: LearnerRow) => {
        if (!window.confirm(t("access_revoke_confirm"))) return;
        try {
            await authFetch(`/api/admin/access/learners?enrollmentId=${encodeURIComponent(row.enrollmentId)}`, {
                method: "DELETE",
            });
            toast.success(t("access_revoked"));
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
        source === "manual" ? t("access_source_manual") : source === "token" ? t("access_source_token") : t("access_source_order");

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="space-y-4">
            {/* Grant */}
            <div className="cw-panel p-4 space-y-3">
                <div>
                    <p className="text-sm font-semibold cw-text">{t("access_grant_title")}</p>
                    <p className="text-xs cw-muted mt-1">{t("access_grant_hint")}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="email"
                        value={grantEmail}
                        onChange={(e) => setGrantEmail(e.target.value)}
                        placeholder={t("access_grant_email")}
                        className="cw-input px-3 py-2.5 text-sm flex-1"
                    />
                    <select
                        value={grantCourse}
                        onChange={(e) => setGrantCourse(e.target.value)}
                        className="cw-input px-3 py-2.5 text-sm sm:w-64"
                    >
                        {courses.map((course) => (
                            <option key={course.id} value={course.slug}>
                                {course.title} · {course.slug}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={grant}
                        disabled={granting || !grantEmail.trim() || !grantCourse}
                        className="px-4 py-2.5 cw-btn cw-surface-2 text-sm disabled:opacity-50"
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
                    className="cw-input px-3 py-2.5 text-sm sm:w-64"
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
                    {items.map((row) => (
                        <div key={row.enrollmentId} className="cw-list-item flex items-center gap-4 p-4">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[row.status]}`} title={t(STATUS_LABEL_KEY[row.status])} />

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium cw-text truncate">
                                    {row.email ?? row.authUserId}
                                </p>
                                <div className="text-xs cw-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                    <span className="font-mono">{row.courseSlug}</span>
                                    <span>{sourceLabel(row.source)}</span>
                                    <span>
                                        {t("access_col_started")}: {new Date(row.startedAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                                    </span>
                                </div>
                            </div>

                            <div className="text-right shrink-0 hidden sm:block">
                                <p className="text-sm cw-text tabular-nums">
                                    {row.lessonsTotal > 0 ? `${row.lessonsCompleted}/${row.lessonsTotal}` : t("access_no_lessons")}
                                </p>
                                <p className="text-xs cw-muted mt-0.5">
                                    {row.lastActivityAt
                                        ? new Date(row.lastActivityAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })
                                        : t("access_no_activity")}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => revoke(row)}
                                className="px-3 py-1.5 cw-btn cw-btn-muted text-xs shrink-0"
                            >
                                {t("access_revoke")}
                            </button>
                        </div>
                    ))}
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [email, setEmail] = useState("");
    const [role, setRole] = useState<string>("coach");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const payload = await authFetch("/api/admin/access/roles") as { items: RoleRow[] };
            setItems(payload.items ?? []);
        } catch (e) {
            setError(errorText(getErrorMessage(e)));
        } finally {
            setLoading(false);
        }
    }, [errorText]);

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
                            className="cw-input px-3 py-2.5 text-sm sm:w-48"
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
                    {filtered.map((row) => (
                        <div key={row.authUserId} className="cw-list-item flex items-center gap-4 p-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium cw-text truncate">{row.email ?? row.authUserId}</p>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium cw-surface-2 cw-text uppercase tracking-wide">
                                        {row.role}
                                    </span>
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
                        </div>
                    ))}
                </div>
            )}
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
