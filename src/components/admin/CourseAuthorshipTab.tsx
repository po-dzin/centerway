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
import type { AuthorProfileRow, CourseRow } from "@/lib/admin/accessTypes";
import { authorizedJson as authFetch } from "@/components/auth/authorizedFetch";
import surfaces from "@/components/admin/AdminSurfaces.module.css";
import { Icon } from "@/components/Icon";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";
import { AdminRow } from "@/components/admin/AdminRow";

function EmptyIcon() {
  return <Icon className="cw-muted" name="lock" size={20} />;
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

  const moderate = async (
    course: CourseRow,
    action: "approve" | "request_changes" | "set_visibility",
    visibility?: CourseRow["visibility"],
  ) => {
    setSavingId(course.id);
    try {
      await authFetch("/api/admin/access/courses", {
        method: "PATCH",
        body: JSON.stringify({ courseId: course.id, action, visibility, note: reviewNotes[course.id] }),
      });
      toast.success(
        action === "approve"
          ? t("catalog_authorship_approved")
          : action === "request_changes"
            ? t("catalog_authorship_returned")
            : t("catalog_authorship_visibility_updated"),
      );
      onChanged();
    } catch (e) {
      toast.error(errorText(getErrorMessage(e)));
    } finally {
      setSavingId(null);
    }
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
    return <AdminEmptyState icon={<EmptyIcon />} description={t("access_empty_courses")} />;
  }

  return (
    <div className={lists.panel}>
      <div className={`${surfaces.plate} ${surfaces.plateCard} ${controls.fieldStack}`}>
        <p className={controls.disclosureTitle}>{t("access_builder_title")}</p>
        <p className={controls.hint}>{t("access_builder_hint")}</p>
        {!canGrant ? <p className={controls.hint}>{t("access_role_admin_only")}</p> : null}
      </div>

      <div className={lists.list}>
        {courses.map((course) => {
          const reviewing = course.reviewEnabled && course.reviewStatus === "in_review";
          const visibilityEditable =
            course.reviewEnabled && course.status === "published" && course.reviewStatus === "approved";
          return (
            <AdminRow
              key={course.id}
              title={course.title}
              badges={
                <>
                  <span className={lists.tag}>{course.status}</span>
                  <span className={lists.tag}>
                    {course.hasPendingRevision
                      ? `${t("catalog_authorship_updated_at")} · ${course.reviewStatus}`
                      : course.reviewStatus}
                  </span>
                </>
              }
              meta={
                <>
                  <span className={lists.itemCode}>{course.slug}</span>
                  <span>
                    {t("access_course_learners")}: {course.learners}
                  </span>
                  <span>
                    {new Date(course.updatedAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                  </span>
                  <span className={lists.itemMetaStrong}>{course.authorEmail ?? t("access_author_house")}</span>
                </>
              }
              controls={
                canGrant && visibilityEditable ? (
                  <select
                    aria-label={t("catalog_visibility_label")}
                    className={controls.select}
                    value={course.visibility}
                    disabled={savingId === course.id}
                    onChange={(e) => void moderate(course, "set_visibility", e.target.value as CourseRow["visibility"])}
                  >
                    <option value="hidden">{t("catalog_authorship_hidden")}</option>
                    <option value="unlisted">{t("catalog_authorship_unlisted")}</option>
                    <option value="listed">{t("catalog_authorship_listed")}</option>
                  </select>
                ) : null
              }
              footer={
                canGrant ? (
                  <>
                    {reviewing ? (
                      <div className={controls.fields}>
                        <>
                          <input
                            className={controls.inputGrow}
                            value={reviewNotes[course.id] ?? ""}
                            onChange={(e) => setReviewNotes((prev) => ({ ...prev, [course.id]: e.target.value }))}
                            placeholder={t("catalog_authorship_comment_placeholder")}
                          />
                          <button
                            className={`${controls.action} cw-surface-2`}
                            disabled={savingId === course.id}
                            onClick={() => void moderate(course, "approve")}
                          >
                            {t("catalog_authorship_approve")}
                          </button>
                          <button
                            className={`${controls.action} cw-btn-muted`}
                            disabled={savingId === course.id}
                            onClick={() => void moderate(course, "request_changes")}
                          >
                            {t("catalog_authorship_return")}
                          </button>
                        </>
                      </div>
                    ) : course.reviewEnabled && !visibilityEditable ? (
                      <p className={controls.hint}>{t("catalog_authorship_listed_hint")}</p>
                    ) : null}
                    <div className={controls.fieldStack}>
                      <label className={controls.field}>
                        <span className={controls.fieldCaption}>{t("access_author_profile")}</span>
                        <select
                          className={controls.select}
                          value={course.authorProfileId ?? ""}
                          disabled={savingId === course.id}
                          onChange={(event) => void selectProfile(course, event.target.value || null)}
                        >
                          <option value="">{t("access_author_profile_none")}</option>
                          {authorProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.name} · /expert/{profile.slug}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className={controls.fields}>
                        <input
                          type="email"
                          value={draft[course.id] ?? ""}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [course.id]: e.target.value }))}
                          placeholder={t("access_author_email")}
                          className={controls.inputGrow}
                        />
                        <button
                          type="button"
                          onClick={() => save(course, (draft[course.id] ?? "").trim())}
                          disabled={savingId === course.id || !(draft[course.id] ?? "").trim()}
                          className={`${controls.action} cw-surface-2`}
                        >
                          {t("access_author_assign")}
                        </button>
                        {course.authorId ? (
                          <button
                            type="button"
                            onClick={() => save(course, null)}
                            disabled={savingId === course.id}
                            className={`${controls.action} cw-btn-muted`}
                          >
                            {t("access_author_clear")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null
              }
            />
          );
        })}
      </div>
    </div>
  );
}
