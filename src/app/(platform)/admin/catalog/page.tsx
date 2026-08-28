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
import { useToast } from "@/components/ToastProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { getAdminLocale } from "@/lib/adminLocale";
import { getErrorMessage } from "@/lib/errors";
import { supabaseClient } from "@/lib/supabaseClient";
import type { CatalogRow, SaleBlocker } from "@/lib/admin/catalogTypes";
import type { CourseRow } from "@/lib/admin/accessTypes";
import { CourseAuthorshipTab } from "@/components/admin/CourseAuthorshipTab";
import { ACCESS_TERM_PRESETS } from "@/lib/admin/catalogTypes";

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

const BLOCKER_KEY: Record<SaleBlocker, string> = {
    not_published: "catalog_blocker_not_published",
    not_approved: "catalog_blocker_not_approved",
    hidden: "catalog_blocker_hidden",
    no_offer: "catalog_blocker_no_offer",
    offer_withdrawn: "catalog_blocker_offer_withdrawn",
    no_access_rule: "catalog_blocker_no_access_rule",
};

function EmptyIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cw-muted">
            <path d="M3 7h18M3 12h18M3 17h12" />
        </svg>
    );
}

export default function CatalogPage() {
    const { lang, t } = useI18n();
    const locale = getAdminLocale(lang);

    const [tab, setTab] = useState<"publication" | "pricing" | "authorship">("publication");
    /* Authorship needs the ACCESS shape of a course — `author_id` resolved to an
       email, plus whether this operator may write it — which `/admin/catalog`
       does not carry. It is fetched only when that tab is first opened: two
       reads on arrival for a tab most visits never touch is the cost of merging
       it here, and it is avoidable. */
    const [authorCourses, setAuthorCourses] = useState<CourseRow[]>([]);
    const [canAssignAuthor, setCanAssignAuthor] = useState(false);
    const [rows, setRows] = useState<CatalogRow[] | null>(null);
    const [canEdit, setCanEdit] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState("");

    const errorText = useCallback((message: string) => {
        const known: Record<string, string> = {
            course_not_found: t("access_error_course_not_found"),
            amount_invalid: t("catalog_error_amount"),
            list_amount_invalid: t("catalog_error_list_amount"),
            access_rule_required: t("catalog_error_access_rule"),
            offer_not_found: t("catalog_error_offer_not_found"),
            course_not_in_review: t("catalog_error_not_in_review"),
            course_not_ready_for_storefront: t("catalog_error_not_ready"),
            Forbidden: t("access_error_forbidden"),
        };
        return known[message] ?? message;
    }, [t]);

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
            const payload = (await authFetch("/api/admin/access/courses")) as { items?: CourseRow[]; canGrant?: boolean };
            setAuthorCourses(payload.items ?? []);
            setCanAssignAuthor(Boolean(payload.canGrant));
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

    const filtered = useMemo(() => {
        if (!rows) return null;
        const needle = q.trim().toLowerCase();
        if (!needle) return rows;
        return rows.filter(
            (row) => row.title.toLowerCase().includes(needle) || row.slug.toLowerCase().includes(needle)
        );
    }, [rows, q]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="cw-page-title mb-1">{t("catalog_title")}</h2>
                <p className="cw-page-subtitle">{t("catalog_subtitle")}</p>
            </div>

            <AdminTabs
                items={[
                    { key: "publication", label: t("catalog_tab_publication") },
                    { key: "pricing", label: t("catalog_tab_pricing") },
                    { key: "authorship", label: t("access_tab_builder") },
                ]}
                activeKey={tab}
                onChange={(key) => {
                    const next = key as typeof tab;
                    setTab(next);
                    if (next === "authorship") void loadAuthorship();
                }}
                className="overflow-x-auto no-scrollbar"
            />

            {/* Authorship brings its own list and its own read, so it stands in
                place of the catalogue's rows rather than inside them — the
                search below filters `rows`, which this tab does not use. */}
            {tab === "authorship" ? (
                <CourseAuthorshipTab
                    courses={authorCourses}
                    canGrant={canAssignAuthor}
                    locale={locale}
                    errorText={errorText}
                    onChanged={loadAuthorship}
                />
            ) : (
            <>
            <AdminSearchInput value={q} onChange={setQ} placeholder={t("catalog_search")} />

            {error ? (
                <AdminErrorState
                    title={t("catalog_title")}
                    message={error}
                    action={
                        <button type="button" className="px-4 py-2 cw-btn cw-surface-2 text-sm" onClick={() => void load()}>
                            {t("analytics_retry")}
                        </button>
                    }
                />
            ) : filtered === null ? (
                <AdminLoadingState variant="skeleton" />
            ) : filtered.length === 0 ? (
                <AdminEmptyState
                    className="py-16"
                    iconWrapperClassName="w-12 h-12 rounded-full"
                    icon={<EmptyIcon />}
                    description={t("catalog_empty")}
                />
            ) : (
                <div className="space-y-1.5">
                    {filtered.map((row) =>
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
                        )
                    )}
                </div>
            )}
            </>
            )}
        </div>
    );
}

/** The state chain a course walks, printed as chips so the stuck step is visible. */
function StateChips({ row }: { row: CatalogRow }) {
    const { t } = useI18n();
    const chip = "text-[10px] px-1.5 py-0.5 rounded-full font-medium cw-surface-2 cw-text uppercase tracking-wide";

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span className={chip}>{row.status}</span>
            <span className={chip}>{row.hasPendingRevision ? `${t("catalog_pending_revision")} · ${row.reviewStatus}` : row.reviewStatus}</span>
            <span className={chip}>{row.visibility}</span>
            {row.blockers.length === 0 ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium cw-status-paid uppercase tracking-wide">
                    {t("catalog_on_sale")}
                </span>
            ) : null}
        </div>
    );
}

/** What is missing, in the order it should be fixed. */
function Blockers({ row }: { row: CatalogRow }) {
    const { t } = useI18n();
    if (row.blockers.length === 0) return null;

    return (
        <p className="text-xs cw-status-failed-text">
            {t("catalog_blocked_by")}: {row.blockers.map((blocker) => t(BLOCKER_KEY[blocker] as never)).join(" · ")}
        </p>
    );
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

    const moderate = async (action: "approve" | "request_changes" | "set_visibility", visibility?: CatalogRow["visibility"]) => {
        setBusy(true);
        try {
            await authFetch("/api/admin/access/courses", {
                method: "PATCH",
                body: JSON.stringify({ courseId: row.courseId, action, visibility, note }),
            });
            toast.success(
                t(action === "approve" ? "catalog_approved" : action === "request_changes" ? "catalog_returned" : "catalog_visibility_saved")
            );
            await onChanged();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        } finally {
            setBusy(false);
        }
    };

    const inReview = row.reviewStatus === "in_review";
    // Already-published material an admin may wave through: the corner that
    // used to have no exit. A pending revision is NOT this case.
    const approvable = inReview || (!row.hasPendingRevision && row.status === "published" && row.reviewStatus !== "approved");

    return (
        <div className="cw-list-item p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium cw-text truncate">{row.title}</p>
                    <StateChips row={row} />
                    <div className="text-xs cw-muted flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="font-mono">{row.slug}</span>
                        <span>{t("access_course_learners")}: {row.learners}</span>
                        <span>{row.authorEmail ?? t("access_author_house")}</span>
                        <span>{new Date(row.updatedAt).toLocaleDateString(locale, { day: "2-digit", month: "short" })}</span>
                    </div>
                    <Blockers row={row} />
                </div>
            </div>

            {canEdit ? (
                <div className="flex flex-col sm:flex-row gap-2">
                    {approvable ? (
                        <>
                            {inReview ? (
                                <input
                                    className="cw-input px-3 py-2 text-sm flex-1"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder={t("catalog_note_placeholder")}
                                />
                            ) : null}
                            <button
                                type="button"
                                className="px-4 py-2 cw-btn cw-surface-2 text-sm disabled:opacity-50"
                                disabled={busy}
                                onClick={() => void moderate("approve")}
                            >
                                {t("catalog_approve")}
                            </button>
                            {inReview ? (
                                <button
                                    type="button"
                                    className="px-4 py-2 cw-btn cw-btn-muted text-sm disabled:opacity-50"
                                    disabled={busy}
                                    onClick={() => void moderate("request_changes")}
                                >
                                    {t("catalog_return")}
                                </button>
                            ) : null}
                        </>
                    ) : null}

                    {/* Visibility is offered whenever the course is approved, and
                        hiding is offered always — taking something off the
                        storefront must never be gated on how it got there. */}
                    <select
                        className="cw-input cw-select pl-3 py-2 text-sm w-full sm:w-52"
                        value={row.visibility}
                        disabled={busy}
                        onChange={(e) => void moderate("set_visibility", e.target.value as CatalogRow["visibility"])}
                    >
                        <option value="hidden">{t("catalog_visibility_hidden")}</option>
                        <option value="unlisted">{t("catalog_visibility_unlisted")}</option>
                        <option value="listed">{t("catalog_visibility_listed")}</option>
                    </select>
                </div>
            ) : (
                <p className="text-xs cw-muted">{t("access_role_admin_only")}</p>
            )}
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
        row.offer ? (row.offer.accessLifetime ? "lifetime" : String(row.offer.accessDays ?? "")) : ""
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
        <div className="cw-list-item p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium cw-text truncate">{row.title}</p>
                    <div className="text-xs cw-muted flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="font-mono">{row.slug}</span>
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
                                {!row.offer.active ? (
                                    <span className="cw-status-failed-text">{t("catalog_offer_inactive")}</span>
                                ) : null}
                            </>
                        ) : (
                            <span>{t("catalog_no_offer")}</span>
                        )}
                    </div>
                    <Blockers row={row} />
                </div>
            </div>

            {canEdit ? (
                <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-xs cw-muted">{t("catalog_amount")}</span>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="cw-input px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-xs cw-muted">{t("catalog_list_amount")}</span>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            value={listAmount}
                            onChange={(e) => setListAmount(e.target.value)}
                            className="cw-input px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-xs cw-muted">{t("catalog_term")}</span>
                        <select
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            className="cw-input cw-select pl-3 py-2 text-sm"
                        >
                            <option value="">{t("catalog_term_unset")}</option>
                            {ACCESS_TERM_PRESETS.map((days) => (
                                <option key={days} value={String(days)}>
                                    {days} {t("catalog_term_days")}
                                </option>
                            ))}
                            <option value="lifetime">{t("catalog_term_lifetime")}</option>
                        </select>
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void save()}
                            disabled={busy || !amount || !term}
                            className="px-4 py-2 cw-btn cw-surface-2 text-sm disabled:opacity-50"
                        >
                            {t("catalog_save_offer")}
                        </button>
                        {row.offer ? (
                            <button
                                type="button"
                                onClick={() => void toggleActive(!row.offer?.active)}
                                disabled={busy}
                                className="px-4 py-2 cw-btn cw-btn-muted text-sm disabled:opacity-50"
                            >
                                {t(row.offer.active ? "catalog_withdraw_offer" : "catalog_resume_offer")}
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <p className="text-xs cw-muted">{t("access_role_admin_only")}</p>
            )}
        </div>
    );
}
