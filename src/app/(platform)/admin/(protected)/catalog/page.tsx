"use client";

/**
 * Каталог: публікація і продаж.
 *
 * WHY THIS SCREEN EXISTS. Two things a course needs before anyone can buy it
 * lived nowhere an operator could reach:
 *
 *   · PUBLICATION. A course published in the builder that never passed through
 *     review sat at `review_status = 'draft'`, and the old panel offered the
 *     approve button only for `in_review` and the visibility control only for
 *     `approved` — a corner with no way out. `ideal-body` had been stuck in it.
 *
 *   · THE PRICE AND THE TERM. `lms_course_offers` was writable only from a
 *     shell script on the owner's machine, so "put this course on sale" was not
 *     an act the admin surface could perform at all.
 *
 * ONE SCREEN, TWO OWNERS, TWO ENDPOINTS — and that is deliberate, not an
 * oversight. What the course claims about itself is the author's and is
 * moderated through /api/admin/access/courses; what it costs is the owner's and
 * is written through /api/admin/catalog, which support cannot call. Reading
 * them side by side is the operator's job; merging them would undo the split
 * that keeps an external author from setting their own payout.
 *
 * The readiness line is the point of the first tab: a course is not "for sale"
 * or "not for sale", it is stuck behind exactly one of four gates, and the
 * screen says which.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import surfaces from "@/components/admin/AdminSurfaces.module.css";
import { useToast } from "@/components/ToastProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { getErrorMessage } from "@/lib/errors";
import type { CatalogRow, SaleBlocker } from "@/lib/admin/catalogTypes";
import type { AuthorProfileRow, CourseRow } from "@/lib/admin/accessTypes";
import { CourseAuthorshipTab } from "@/components/admin/CourseAuthorshipTab";
import { ProductPricingTab } from "@/components/admin/ProductPricingTab";
import type { ProductOfferRow } from "@/lib/admin/productOfferTypes";
import { ACCESS_TERM_PRESETS } from "@/lib/admin/catalogTypes";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { authorizedJson as authFetch } from "@/components/auth/authorizedFetch";
import { Icon } from "@/components/Icon";
import pageStyles from "@/components/admin/AdminPage.module.css";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { AdminRow, AdminRowIconAction } from "@/components/admin/AdminRow";
import {
  CATALOG_GROUPINGS,
  filterCatalogRows,
  groupCatalogRows,
  type CatalogCategoryFilter,
  type CatalogGrouping,
} from "@/lib/admin/catalogGrouping";
import { coverCardStyle } from "@/lib/lms/courseCover";
import { COURSE_CATEGORIES, type CourseCategory } from "@/lms-core";

const BLOCKER_KEY: Record<SaleBlocker, string> = {
  not_renderable: "catalog_blocker_not_renderable",
  not_published: "catalog_blocker_not_published",
  not_approved: "catalog_blocker_not_approved",
  hidden: "catalog_blocker_hidden",
  no_offer: "catalog_blocker_no_offer",
  offer_withdrawn: "catalog_blocker_offer_withdrawn",
  no_access_rule: "catalog_blocker_no_access_rule",
};

const CATEGORY_KEY: Record<CourseCategory, string> = {
  movement: "catalog_category_movement",
  nutrition: "catalog_category_nutrition",
  cleansing: "catalog_category_cleansing",
};

const GROUPING_KEY: Record<CatalogGrouping, string> = {
  submitted: "catalog_group_submitted",
  alphabet: "catalog_group_alphabet",
  status: "catalog_group_status",
  updated: "catalog_group_updated",
};

function initialsOf(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/* THE ROW'S THUMBNAIL — the card system's row size in the admin
   (`--ds-card-thumb-width-compact`, docs/card-system-2026-09-13.md). A title
   in a list of forty is read; a cover is recognised, which is what an operator
   narrowing the list with a search or a filter is doing. */
function CourseThumb({ row }: { row: CatalogRow }) {
  return (
    <span className={lists.itemThumb} aria-hidden="true">
      {row.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.cover.src} alt="" loading="lazy" decoding="async" style={coverCardStyle(row.cover)} />
      ) : (
        initialsOf(row.title)
      )}
    </span>
  );
}

function EmptyIcon() {
  return <Icon className="cw-muted" name="list" size={20} />;
}

export default function CatalogPage() {
  const { lang, t } = useI18n();
  const locale = getAdminLocale(lang);

  const [tab, setTab] = useState<"publication" | "pricing" | "products" | "authorship">("publication");
  /* Authorship needs the ACCESS shape of a course — `author_id` resolved to an
       email, plus whether this operator may write it — which `/admin/catalog`
       does not carry. It is fetched only when that tab is first opened: two
       reads on arrival for a tab most visits never touch is the cost of merging
       it here, and it is avoidable. */
  const [authorCourses, setAuthorCourses] = useState<CourseRow[]>([]);
  const [authorProfiles, setAuthorProfiles] = useState<AuthorProfileRow[]>([]);
  const [canAssignAuthor, setCanAssignAuthor] = useState(false);
  /* Same lazy-load shape as authorship: a different table, fetched only when
       the tab is first opened. */
  const [productOffers, setProductOffers] = useState<ProductOfferRow[]>([]);
  const [canEditProducts, setCanEditProducts] = useState(false);
  const [rows, setRows] = useState<CatalogRow[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CatalogCategoryFilter>("all");
  /* Newest submissions first: «what is waiting for me?» is the question this
     page is opened with more often than any other. */
  const [grouping, setGrouping] = useState<CatalogGrouping>("submitted");

  const errorText = useCallback(
    (message: string) => {
      const known: Record<string, string> = {
        course_not_found: t("access_error_course_not_found"),
        amount_invalid: t("catalog_error_amount"),
        list_amount_invalid: t("catalog_error_list_amount"),
        access_rule_required: t("catalog_error_access_rule"),
        offer_not_found: t("catalog_error_offer_not_found"),
        course_not_in_review: t("catalog_error_not_in_review"),
        course_not_ready_for_storefront: t("catalog_error_not_ready"),
        product_amount_invalid: t("products_error_amount"),
        product_list_amount_invalid: t("products_error_list_amount"),
        product_list_amount_without_amount: t("products_error_list_amount_without_amount"),
        product_unknown: t("products_error_product_unknown"),
        product_kind_invalid: t("products_error_kind"),
        Forbidden: t("access_error_forbidden"),
      };
      return known[message] ?? message;
    },
    [t],
  );

  const load = useCallback(async () => {
    try {
      const payload = (await authFetch("/api/admin/catalog")) as { items?: CatalogRow[]; canEdit?: boolean };
      setRows(payload.items ?? []);
      setCanEdit(Boolean(payload.canEdit));
      setError(null);
    } catch (e) {
      setError(errorText(getErrorMessage(e)));
    }
  }, [errorText]);

  const loadAuthorship = useCallback(async () => {
    try {
      const payload = (await authFetch("/api/admin/access/courses")) as {
        items?: CourseRow[];
        authorProfiles?: AuthorProfileRow[];
        canGrant?: boolean;
      };
      setAuthorCourses(payload.items ?? []);
      setAuthorProfiles(payload.authorProfiles ?? []);
      setCanAssignAuthor(Boolean(payload.canGrant));
    } catch (e) {
      setError(errorText(getErrorMessage(e)));
    }
  }, [errorText]);

  const loadProductOffers = useCallback(async () => {
    try {
      const payload = (await authFetch("/api/admin/catalog/products")) as {
        items?: ProductOfferRow[];
        canEdit?: boolean;
      };
      setProductOffers(payload.items ?? []);
      setCanEditProducts(Boolean(payload.canEdit));
    } catch (e) {
      setError(errorText(getErrorMessage(e)));
    }
  }, [errorText]);

  /* The read is started from inside the effect's async body rather than
       called from it directly: a synchronous `load()` sets state during the
       effect and cascades a render, which is what react-hooks flags. Reloads
       after a write call `load` from the handler, where that is not a concern. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const filtered = useMemo(() => (rows ? filterCatalogRows(rows, { text: q, category }) : null), [rows, q, category]);

  const groups = useMemo(
    () =>
      filtered
        ? groupCatalogRows(
            filtered,
            grouping,
            {
              inReview: t("catalog_section_in_review"),
              changesRequested: t("catalog_section_changes_requested"),
              rest: t("catalog_section_rest"),
              listed: t("catalog_section_listed"),
              unlisted: t("catalog_section_unlisted"),
              hidden: t("catalog_section_hidden"),
              draft: t("catalog_section_draft"),
            },
            locale,
          )
        : null,
    [filtered, grouping, t, locale],
  );

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.heading}>
        <h2 className={pageStyles.title}>{t("catalog_title")}</h2>
        <p className={pageStyles.subtitle}>{t("catalog_subtitle")}</p>
      </div>

      <AdminTabs
        items={[
          { key: "publication", label: t("catalog_tab_publication") },
          { key: "pricing", label: t("catalog_tab_pricing") },
          { key: "products", label: t("catalog_tab_products") },
          { key: "authorship", label: t("access_tab_builder") },
        ]}
        activeKey={tab}
        onChange={(key) => {
          const next = key as typeof tab;
          setTab(next);
          if (next === "authorship") void loadAuthorship();
          if (next === "products") void loadProductOffers();
        }}
      />

      {/* Authorship brings its own list and its own read, so it stands in
                place of the catalogue's rows rather than inside them — the
                search below filters `rows`, which this tab does not use. */}
      {tab === "authorship" ? (
        <CourseAuthorshipTab
          courses={authorCourses}
          authorProfiles={authorProfiles}
          canGrant={canAssignAuthor}
          locale={locale}
          errorText={errorText}
          onChanged={loadAuthorship}
        />
      ) : tab === "products" ? (
        <ProductPricingTab
          products={productOffers}
          canEdit={canEditProducts}
          errorText={errorText}
          onChanged={loadProductOffers}
        />
      ) : (
        <>
          <AdminSearchInput value={q} onChange={setQ} placeholder={t("catalog_search")} />

          {rows && rows.length > 1 ? (
            <div className={lists.toolbar}>
              <label className={lists.toolbarField}>
                <span className={controls.fieldCaption}>{t("catalog_filter_category")}</span>
                <select
                  className={controls.select}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CatalogCategoryFilter)}
                >
                  <option value="all">{t("catalog_category_all")}</option>
                  {COURSE_CATEGORIES.map((code) => (
                    <option key={code} value={code}>
                      {t(CATEGORY_KEY[code] as never)}
                    </option>
                  ))}
                  <option value="none">{t("catalog_category_none")}</option>
                </select>
              </label>
              <label className={lists.toolbarField}>
                <span className={controls.fieldCaption}>{t("catalog_group_by")}</span>
                <select
                  className={controls.select}
                  value={grouping}
                  onChange={(e) => setGrouping(e.target.value as CatalogGrouping)}
                >
                  {CATALOG_GROUPINGS.map((key) => (
                    <option key={key} value={key}>
                      {t(GROUPING_KEY[key] as never)}
                    </option>
                  ))}
                </select>
              </label>
              {filtered && filtered.length !== rows.length ? (
                <p className={lists.toolbarCount}>
                  {t("catalog_shown_of")} {filtered.length} / {rows.length}
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <AdminErrorState
              title={t("catalog_title")}
              message={error}
              action={
                <button type="button" className={`${controls.action} cw-surface-2`} onClick={() => void load()}>
                  {t("analytics_retry")}
                </button>
              }
            />
          ) : filtered === null || groups === null ? (
            <AdminLoadingState variant="skeleton" />
          ) : filtered.length === 0 ? (
            <AdminEmptyState icon={<EmptyIcon />} description={t("catalog_empty")} />
          ) : (
            <div className={lists.groups}>
              {groups.map((group) => (
                <section key={group.key} className={lists.group} aria-label={group.label ?? undefined}>
                  {group.label ? (
                    <h3 className={lists.groupHead}>
                      {group.label}
                      <span className={lists.groupCount}>{group.rows.length}</span>
                    </h3>
                  ) : null}
                  <div className={lists.list}>
                    {group.rows.map((row) =>
                      tab === "publication" ? (
                        <PublicationRow
                          key={row.courseId}
                          row={row}
                          canEdit={canEdit}
                          locale={locale}
                          errorText={errorText}
                          onChanged={load}
                        />
                      ) : (
                        <PricingRow
                          key={row.courseId}
                          row={row}
                          canEdit={canEdit}
                          errorText={errorText}
                          onChanged={load}
                        />
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The two doors into the course itself, from the row that decides its fate.
 *
 * MODERATION WITHOUT READING IS RUBBER-STAMPING. Approving a revision and
 * putting a course in the catalogue are decisions about CONTENT, and until now
 * this screen offered no way to see any: an operator had to know that the
 * reader lives on the personal host, and type the slug there by hand.
 *
 * Two links because there are two things to look at, and they are not the same
 * thing: «курс» is the material as a learner reads it (staff open any course,
 * draft included — see lms/server.ts), «сторінка» is the offer a buyer lands
 * on. Both cross an origin — this screen is on `www`, the reader is on `my` —
 * so both go through the one resolver that owns that question.
 */
function CourseLinks({ row }: { row: CatalogRow }) {
  const { t } = useI18n();
  const href = useSurfaceHref();
  return (
    <div className={lists.itemLinks}>
      <a
        className={lists.itemLink}
        data-cw-ink-control
        href={href(`/learn/${row.slug}`)}
        target="_blank"
        rel="noreferrer"
      >
        <InteractionInkLabel variant="link">{t("catalog_open_course")}</InteractionInkLabel>
      </a>
      <a
        className={lists.itemLink}
        data-cw-ink-control
        href={href(`/programs/${row.programSlug}`)}
        target="_blank"
        rel="noreferrer"
      >
        <InteractionInkLabel variant="link">{t("catalog_open_offer")}</InteractionInkLabel>
      </a>
    </div>
  );
}

/** The state chain a course walks, printed as chips so the stuck step is visible.
 *
 * WORDS, NOT COLUMN VALUES (2026-09-13). The chips used to print the raw enum —
 * «DRAFT DRAFT HIDDEN» — and the two drafts are different facts: the author has
 * not published, and the review was never submitted. Each chip now names its
 * axis, so the stuck step reads without knowing the schema. An unknown value
 * falls back to itself rather than to a blank chip. */
function StateChips({ row }: { row: CatalogRow }) {
  const { t } = useI18n();
  const chip = lists.tag;

  const statusLabel: Record<string, string> = {
    draft: t("catalog_status_draft"),
    published: t("catalog_status_published"),
  };
  const reviewLabel: Record<string, string> = {
    draft: t("catalog_review_draft"),
    in_review: t("catalog_review_in_review"),
    changes_requested: t("catalog_review_changes_requested"),
    approved: t("catalog_review_approved"),
  };
  const visibilityLabel: Record<CatalogRow["visibility"], string> = {
    hidden: t("catalog_visibility_hidden"),
    unlisted: t("catalog_visibility_unlisted"),
    listed: t("catalog_visibility_listed"),
  };
  const pendingReview = row.pendingReviewStatus ?? "draft";

  return (
    <div className={lists.chipRow}>
      <span className={chip}>{statusLabel[row.status] ?? row.status}</span>
      {/* THE CHIP SAYS WHAT THE BUTTONS BELOW OBEY. It used to print the
                LIVE review status beside the «оновлення» word, so a returned
                revision on an approved course read «ОНОВЛЕННЯ · APPROVED» —
                the one state where there is nothing to approve. */}
      <span className={chip}>
        {row.hasPendingRevision
          ? `${t("catalog_pending_revision")} · ${reviewLabel[pendingReview] ?? pendingReview}`
          : (reviewLabel[row.reviewStatus] ?? row.reviewStatus)}
      </span>
      <span className={chip}>{visibilityLabel[row.visibility] ?? row.visibility}</span>
      {row.blockers.length === 0 ? <span className={lists.tagOnSale}>{t("catalog_on_sale")}</span> : null}
    </div>
  );
}

/**
 * ЧТО ПРИНЕСЛИ НА ПРОВЕРКУ, до того как рецензент нажмёт «одобрить».
 *
 * Раньше он видел «оновлення · in_review» и ничего о содержании: одобрение было
 * вслепую, и подмена обязательного блока «межі» после прохождения проверки
 * ничем себя не выдавала. Числа отвечают на «во что смотреть», подробности —
 * в самом курсе; разница считается по запросу и нигде не хранится.
 */
function PendingChanges({ row }: { row: CatalogRow }) {
  const { t } = useI18n();
  const diff = row.pendingDiff;
  if (!row.hasPendingRevision || !diff) return null;

  const parts = [
    [diff.fields, t("catalog_changes_fields")],
    [diff.modules, t("catalog_changes_modules")],
    [diff.lessonsAdded, t("catalog_changes_lessons_added")],
    [diff.lessonsRemoved, t("catalog_changes_lessons_removed")],
    [diff.lessonsChanged, t("catalog_changes_lessons_changed")],
  ]
    .filter(([count]) => (count as number) > 0)
    .map(([count, label]) => `${count} ${label}`);

  return (
    <div className={lists.changes}>
      <p className={lists.changesText}>
        {t("catalog_changes_vs_live")}: {parts.length > 0 ? parts.join(" · ") : t("catalog_changes_none")}
        {/* Підпис під відправкою — з журналу: колонка зберігала коли,
                    але ніколи не зберігала хто. */}
        {diff.submittedBy ? ` · ${t("catalog_submitted_by")}: ${diff.submittedBy}` : ""}
      </p>
      {diff.boundaryTouched ? <p className={lists.changesAlert}>{t("catalog_changes_boundary")}</p> : null}
    </div>
  );
}

/** What is missing, in the order it should be fixed. */
function Blockers({ row }: { row: CatalogRow }) {
  const { t } = useI18n();
  if (row.blockers.length === 0) return null;

  return (
    <p className={lists.blockers}>
      {t("catalog_blocked_by")}: {row.blockers.map((blocker) => t(BLOCKER_KEY[blocker] as never)).join(" · ")}
    </p>
  );
}

/**
 * «Не проходив модерацію» — said quietly, and said separately.
 *
 * An unapproved course that is already on the shelf sells: nothing on the
 * buying path reads `review_status` (see `SaleBlocker.not_approved`). What it
 * cannot do is have its visibility changed, so the fact is worth printing —
 * just not in the red line that claims the course is not selling, which is
 * where it spent weeks being wrong about `short` and `irem-gymnastics`.
 */
function ModerationNote({ row }: { row: CatalogRow }) {
  const { t } = useI18n();
  /* Only on a course that is actually selling. A draft, a hidden row, a row
     the shelf cannot render or one without an offer already has the red line
     above saying why — and printing «продається» under it would be false. */
  if (row.reviewStatus === "approved" || row.blockers.length > 0) return null;

  return <p className={controls.hint}>{t("catalog_not_moderated")}</p>;
}

function PublicationRow({
  row,
  canEdit,
  locale,
  errorText,
  onChanged,
}: {
  row: CatalogRow;
  canEdit: boolean;
  locale: string;
  errorText: (message: string) => string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const moderate = async (
    action: "approve" | "request_changes" | "set_visibility",
    visibility?: CatalogRow["visibility"],
  ) => {
    setBusy(true);
    try {
      await authFetch("/api/admin/access/courses", {
        method: "PATCH",
        body: JSON.stringify({ courseId: row.courseId, action, visibility, note }),
      });
      toast.success(
        t(
          action === "approve"
            ? "catalog_approved"
            : action === "request_changes"
              ? "catalog_returned"
              : "catalog_visibility_saved",
        ),
      );
      await onChanged();
    } catch (e) {
      toast.error(errorText(getErrorMessage(e)));
    } finally {
      setBusy(false);
    }
  };

  const inReview = (row.hasPendingRevision ? row.pendingReviewStatus : row.reviewStatus) === "in_review";
  /* Mirrors `moderateCourse`, which is the authority: a revision SUBMITTED
     for review is approved as a release; otherwise the live publication can
     be approved on its own — including with an unsubmitted draft sitting on
     top of it, which used to remove the button entirely and leave a public
     course permanently unapprovable. */
  const revisionInReview = row.hasPendingRevision && row.pendingReviewStatus === "in_review";
  const approvesLive =
    !revisionInReview &&
    row.reviewStatus !== "approved" &&
    (row.reviewStatus === "in_review" || row.status === "published");
  const approvable = revisionInReview || approvesLive;

  const [deleting, setDeleting] = useState(false);

  return (
    <AdminRow
      lead={<CourseThumb row={row} />}
      title={row.title}
      badges={<StateChips row={row} />}
      meta={
        <>
          <span className={lists.itemCode}>{row.slug}</span>
          <span>
            {t("access_course_learners")}: {row.learners}
          </span>
          <span>{row.authorEmail ?? t("access_author_house")}</span>
          <span>{new Date(row.updatedAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}</span>
          {inReview && row.submittedAt ? (
            <span className={lists.itemMetaStrong}>
              {t("catalog_submitted_on")}:{" "}
              {new Date(row.submittedAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
            </span>
          ) : null}
        </>
      }
      controls={
        canEdit ? (
          <>
            {/* Hiding is offered always — taking something off the storefront
                must never be gated on how it got there. */}
            <select
              aria-label={t("catalog_visibility_label")}
              className={controls.select}
              value={row.visibility}
              disabled={busy}
              onChange={(e) => void moderate("set_visibility", e.target.value as CatalogRow["visibility"])}
            >
              <option value="hidden">{t("catalog_visibility_hidden")}</option>
              <option value="unlisted">{t("catalog_visibility_unlisted")}</option>
              <option value="listed">{t("catalog_visibility_listed")}</option>
            </select>
            <AdminRowIconAction
              icon="trash"
              label={t("catalog_delete")}
              danger
              expanded={deleting}
              onClick={() => setDeleting((open) => !open)}
            />
          </>
        ) : (
          <p className={controls.hint}>{t("access_role_admin_only")}</p>
        )
      }
      footer={
        canEdit && (approvable || deleting) ? (
          <>
            {approvable ? (
              <div className={controls.fields}>
                {inReview ? (
                  <input
                    className={controls.inputGrow}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("catalog_note_placeholder")}
                  />
                ) : null}
                <button
                  type="button"
                  className={`${controls.action} cw-surface-2`}
                  disabled={busy}
                  onClick={() => void moderate("approve")}
                >
                  {approvesLive && row.hasPendingRevision ? t("catalog_approve_live") : t("catalog_approve")}
                </button>
                {inReview ? (
                  <button
                    type="button"
                    className={`${controls.action} cw-btn-muted`}
                    disabled={busy}
                    onClick={() => void moderate("request_changes")}
                  >
                    {t("catalog_return")}
                  </button>
                ) : null}
              </div>
            ) : null}
            {deleting ? (
              <DeleteCourseConfirm row={row} onCancel={() => setDeleting(false)} onChanged={onChanged} />
            ) : null}
          </>
        ) : null
      }
    >
      <Blockers row={row} />
      <ModerationNote row={row} />
      <PendingChanges row={row} />
      <CourseLinks row={row} />
    </AdminRow>
  );
}

/* The confirmation the row's trash icon opens in its footer. Typing the slug is
   the step that makes a delete deliberate; the icon only asks the question. */
function DeleteCourseConfirm({
  row,
  onCancel,
  onChanged,
}: {
  row: CatalogRow;
  onCancel: () => void;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    try {
      await authFetch("/api/admin/access/courses", {
        method: "DELETE",
        body: JSON.stringify({ courseId: row.courseId, confirmSlug: confirmation }),
      });
      toast.success(t("catalog_deleted"));
      await onChanged();
    } catch {
      toast.error(t("catalog_delete_failed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`${surfaces.plate} ${controls.confirmGroup}`} role="group" aria-label={t("catalog_delete")}>
      <p className={controls.confirmText}>
        {t("catalog_delete_warning")} {t("access_course_learners")}: {row.learners}.
      </p>
      <label className={controls.confirmLabel}>
        {t("catalog_delete_confirm")} <strong>{row.slug}</strong>
        <input
          className={controls.confirmInput}
          value={confirmation}
          autoComplete="off"
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={busy}
        />
      </label>
      <div className={controls.actions}>
        <button
          type="button"
          className={`${controls.action} cw-btn-muted`}
          disabled={busy || confirmation !== row.slug}
          onClick={() => void remove()}
        >
          {t("catalog_delete")}
        </button>
        <button
          type="button"
          className={controls.action}
          disabled={busy}
          onClick={() => {
            setConfirmation("");
            onCancel();
          }}
        >
          {t("catalog_delete_cancel")}
        </button>
      </div>
    </div>
  );
}

function PricingRow({
  row,
  canEdit,
  errorText,
  onChanged,
}: {
  row: CatalogRow;
  canEdit: boolean;
  errorText: (message: string) => string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] = useState(row.offer ? String(row.offer.amount) : "");
  const [listAmount, setListAmount] = useState(row.offer?.listAmount ? String(row.offer.listAmount) : "");
  /* The term is a single control with an explicit "forever" option rather
       than a number that may be left blank: blank is how an unstated term gets
       sold as perpetual access, which is the mistake this screen exists to
       make impossible. */
  const [term, setTerm] = useState<string>(
    row.offer ? (row.offer.accessLifetime ? "lifetime" : String(row.offer.accessDays ?? "")) : "",
  );

  const save = async () => {
    if (!term) {
      toast.error(t("catalog_error_access_rule"));
      return;
    }
    setBusy(true);
    try {
      await authFetch("/api/admin/catalog", {
        method: "PATCH",
        body: JSON.stringify({
          courseId: row.courseId,
          action: "save_offer",
          amount: Number(amount),
          listAmount: listAmount.trim() === "" ? null : Number(listAmount),
          accessDays: term === "lifetime" ? null : Number(term),
          accessLifetime: term === "lifetime",
        }),
      });
      toast.success(t("catalog_offer_saved"));
      await onChanged();
    } catch (e) {
      toast.error(errorText(getErrorMessage(e)));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (active: boolean) => {
    setBusy(true);
    try {
      await authFetch("/api/admin/catalog", {
        method: "PATCH",
        body: JSON.stringify({ courseId: row.courseId, action: active ? "resume_offer" : "withdraw_offer" }),
      });
      toast.success(t(active ? "catalog_offer_resumed" : "catalog_offer_withdrawn"));
      await onChanged();
    } catch (e) {
      toast.error(errorText(getErrorMessage(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminRow
      lead={<CourseThumb row={row} />}
      title={row.title}
      meta={
        <>
          <span className={lists.itemCode}>{row.slug}</span>
          {row.offer ? (
            <>
              <span>
                {row.offer.amount} {row.offer.currency}
                {row.offer.listAmount ? ` · ${t("catalog_quoted")} ${row.offer.listAmount}` : ""}
              </span>
              <span>
                {row.offer.accessLifetime
                  ? t("catalog_term_lifetime")
                  : `${row.offer.accessDays} ${t("catalog_term_days")}`}
              </span>
              {!row.offer.active ? <span className="cw-status-failed-text">{t("catalog_offer_inactive")}</span> : null}
            </>
          ) : (
            <span>{t("catalog_no_offer")}</span>
          )}
        </>
      }
      footer={
        canEdit ? (
          <div className={controls.fields}>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{t("catalog_amount")}</span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={controls.input}
              />
            </label>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{t("catalog_list_amount")}</span>
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
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{t("catalog_term")}</span>
              <select value={term} onChange={(e) => setTerm(e.target.value)} className={controls.select}>
                <option value="">{t("catalog_term_unset")}</option>
                {ACCESS_TERM_PRESETS.map((days) => (
                  <option key={days} value={String(days)}>
                    {days} {t("catalog_term_days")}
                  </option>
                ))}
                <option value="lifetime">{t("catalog_term_lifetime")}</option>
              </select>
            </label>
            <div className={controls.actions}>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy || !amount || !term}
                className={`${controls.action} cw-surface-2`}
              >
                {t("catalog_save_offer")}
              </button>
              {row.offer ? (
                <button
                  type="button"
                  onClick={() => void toggleActive(!row.offer?.active)}
                  disabled={busy}
                  className={`${controls.action} cw-btn-muted`}
                >
                  {t(row.offer.active ? "catalog_withdraw_offer" : "catalog_resume_offer")}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className={controls.hint}>{t("access_role_admin_only")}</p>
        )
      }
    >
      <Blockers row={row} />
      <PendingChanges row={row} />
      <CourseLinks row={row} />
    </AdminRow>
  );
}
