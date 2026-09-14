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
import { AdminRow, AdminRowIconAction } from "@/components/admin/AdminRow";
import { courseStateKeys } from "@/lib/lms/courseState";
import { CourseStateBadge } from "@/components/platform/StateBadge";
import { AdminModal } from "@/components/admin/AdminModal";

function EmptyIcon() {
  return <Icon className="cw-muted" name="lock" size={20} />;
}

/**
 * AUTHORSHIP ONLY (2026-09-14). This tab used to be the access page's course
 * list, and it came into the catalogue carrying its own review buttons and its
 * own visibility select — the same controls, over the same courses, as the
 * «Публікація» tab beside it. A course's STATE (review, visibility, delete) is
 * decided in «Публікація»; this tab answers only who a course belongs to: the
 * account that edits it in the builder, and the author profile printed on its
 * page.
 */
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
  const { lang, t } = useI18n();
  const toast = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  /* The builder-owner dialog, for one course at a time. */
  const [dialog, setDialog] = useState<{ courseId: string } | null>(null);

  const save = async (course: CourseRow, email: string | null) => {
    setSavingId(course.id);
    try {
      await authFetch("/api/admin/access/courses", {
        method: "PATCH",
        body: JSON.stringify({ courseId: course.id, email }),
      });
      toast.success(email ? t("access_author_set") : t("access_author_cleared"));
      onChanged();
      return true;
    } catch (e) {
      toast.error(errorText(getErrorMessage(e)));
      return false;
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

  const dialogCourse = dialog ? (courses.find((course) => course.id === dialog.courseId) ?? null) : null;

  return (
    <div className={lists.panel}>
      <div className={`${surfaces.plate} ${surfaces.plateCard} ${controls.fieldStack}`}>
        <p className={controls.disclosureTitle}>{t("access_builder_title")}</p>
        <p className={controls.hint}>{t("access_builder_hint")}</p>
        {!canGrant ? <p className={controls.hint}>{t("access_role_admin_only")}</p> : null}
      </div>

      <div className={lists.list}>
        {courses.map((course) => {
          const busy = savingId === course.id;
          return (
            <AdminRow
              key={course.id}
              title={course.title}
              badges={
                <>
                  {/* The shared one-word vocabulary. This row's review state is
                      the NEXT version's when a revision is pending, and the live
                      course behind it is published. */}
                  {courseStateKeys({
                    status: course.status,
                    reviewStatus: course.hasPendingRevision ? null : course.reviewStatus,
                    hasPendingRevision: course.hasPendingRevision,
                    pendingReviewStatus: course.hasPendingRevision ? course.reviewStatus : null,
                  }).map((key) => (
                    <CourseStateBadge key={key} state={key} lang={lang} />
                  ))}
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
              actions={
                canGrant ? (
                  <AdminRowIconAction
                    icon="user"
                    label={t("access_owner_open")}
                    opensDialog
                    disabled={busy}
                    onClick={() => setDialog({ courseId: course.id })}
                  />
                ) : null
              }
              footer={
                canGrant ? (
                  <label className={controls.field}>
                    <span className={controls.fieldCaption}>{t("access_author_profile")}</span>
                    <select
                      className={controls.select}
                      value={course.authorProfileId ?? ""}
                      disabled={busy}
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
                ) : null
              }
            />
          );
        })}
      </div>

      {dialogCourse ? (
        <OwnerModal
          course={dialogCourse}
          busy={savingId === dialogCourse.id}
          onAssign={(email) => void save(dialogCourse, email).then((ok) => ok && setDialog(null))}
          onClear={() => void save(dialogCourse, null).then((ok) => ok && setDialog(null))}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

/* WHO EDITS THIS COURSE IN THE BUILDER — `lms_courses.author_id`, set by the
   email of an account that has signed in at least once. Not the public byline
   (that is the profile select on the row). It is an act done rarely, so it is a
   dialog behind the row's person icon rather than an empty field on every
   course. */
function OwnerModal({
  course,
  busy,
  onAssign,
  onClear,
  onClose,
}: {
  course: CourseRow;
  busy: boolean;
  onAssign: (email: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");

  return (
    <AdminModal
      title={t("access_owner_title")}
      description={course.title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={controls.action} disabled={busy} onClick={onClose}>
            {t("catalog_modal_cancel")}
          </button>
          {course.authorId ? (
            <button type="button" className={`${controls.action} cw-btn-muted`} disabled={busy} onClick={onClear}>
              {t("access_author_clear")}
            </button>
          ) : null}
          <button
            type="button"
            className={`${controls.action} cw-surface-2`}
            disabled={busy || !email.trim()}
            onClick={() => onAssign(email.trim())}
          >
            {t("access_author_assign")}
          </button>
        </>
      }
    >
      <p className={controls.hint}>{t("access_owner_hint")}</p>
      <p className={controls.confirmText}>
        {t("access_owner_current")}: <strong>{course.authorEmail ?? t("access_author_house")}</strong>
      </p>
      <label className={controls.field}>
        <span className={controls.fieldCaption}>{t("access_author_email")}</span>
        <input
          type="email"
          className={controls.input}
          value={email}
          autoComplete="off"
          disabled={busy}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
    </AdminModal>
  );
}
