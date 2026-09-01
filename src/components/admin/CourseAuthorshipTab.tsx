"use client";

/**
 * Course authorship — who may edit which course in the builder.
 *
 * IT USED TO LIVE ON THE ACCESS PAGE, as a fourth tab beside three tabs of
 * PEOPLE. It was the only one of the four whose row is a course, and a course
 * page already existed next door — so it moved here, to the page whose entity
 * it shares. Step 3 of docs/admin-access-shape-2026-08-28.md.
 *
 * WHY THIS IS NOT A ROLE, which is the question the old placement invited.
 * `lms_courses.author_id` is per row. An "author" role would say "may edit
 * courses"; this says "may edit THIS course". `coach` and `author_id` look
 * adjacent because one person usually holds both, not because they are one
 * field — see the authorship migration.
 */

import { useState } from "react";

import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { getErrorMessage } from "@/lib/errors";
import { supabaseClient } from "@/lib/supabaseClient";
import type { AuthorProfileRow, CourseRow } from "@/lib/admin/accessTypes";

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

function EmptyIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cw-muted">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}

export function CourseAuthorshipTab({
    courses,
    authorProfiles,
    canGrant,
    locale,
    errorText,
    onChanged,
}: {
    courses: CourseRow[];
    authorProfiles: AuthorProfileRow[];
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

    const selectProfile = async (course: CourseRow, authorProfileId: string | null) => {
        setSavingId(course.id);
        try {
            await authFetch("/api/admin/access/courses", {
                method: "PATCH",
                body: JSON.stringify({ courseId: course.id, action: "set_author_profile", authorProfileId }),
            });
            toast.success(t("access_author_profile_set"));
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
                            <div className="grid gap-2">
                              <label className="grid gap-1">
                                <span className="text-xs cw-muted">{t("access_author_profile")}</span>
                                <select
                                    className="cw-input cw-select px-3 py-2 text-sm"
                                    value={course.authorProfileId ?? ""}
                                    disabled={savingId === course.id}
                                    onChange={(event) => void selectProfile(course, event.target.value || null)}
                                >
                                    <option value="">{t("access_author_profile_none")}</option>
                                    {authorProfiles.map((profile) => (
                                        <option key={profile.id} value={profile.id}>{profile.name} · /expert/{profile.slug}</option>
                                    ))}
                                </select>
                              </label>
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
                            </div>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}
