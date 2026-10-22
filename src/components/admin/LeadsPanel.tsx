"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { Icon } from "@/components/Icon";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/components/ToastProvider";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";
import { AdminRow, AdminRowIconAction } from "@/components/admin/AdminRow";
import { AdminModal } from "@/components/admin/AdminModal";

/* The four stages, in the order a lead travels them. Kept as data rather than
   as markup so the tab strip, the row control and the "is this closed" test all
   read the same list — the bug this column exists to prevent is a sequence that
   keeps writing to somebody because one place forgot a stage. */
const STAGES = ["new", "in_progress", "won", "lost"] as const;
type Stage = (typeof STAGES)[number];
const CLOSED_STAGES: readonly Stage[] = ["won", "lost"];

const STAGE_LABEL_KEY: Record<Stage, string> = {
  new: "leads_stage_new",
  in_progress: "leads_stage_in_progress",
  won: "leads_stage_won",
  lost: "leads_stage_lost",
};

type Lead = {
  id: string;
  order_ref: string;
  product_code: string | null;
  product_title: string | null;
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: Stage;
  stage_changed_at: string | null;
  created_at: string;
  dosha_result_type: string | null;
  dosha_claimed: string | null;
  message: string | null;
};

const LIMIT = 50;

export function LeadsPanel() {
  const { lang, t } = useI18n();
  const locale = getAdminLocale(lang);
  const { showToast } = useToast();

  const [stage, setStage] = useState<Stage | "">("");
  const [rows, setRows] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const [removing, setRemoving] = useState<Lead | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) throw new Error("no_session");
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
      if (stage) params.set("stage", stage);
      const res = await fetch(`/api/admin/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`request_failed_${res.status}`);
      const payload = await res.json();
      setRows(payload.data ?? []);
      setCount(payload.count ?? 0);
      setCounts(payload.counts ?? {});
      setCanDelete(Boolean(payload.canDelete));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, stage]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveStage = async (lead: Lead, next: Stage) => {
    if (next === lead.stage) return;
    setSavingId(lead.id);
    /* Optimistic, and reverted on failure: moving a lead is the one thing
           an operator does here repeatedly, and a round trip between click and
           feedback is what makes a queue feel unusable. */
    const previous = lead.stage;
    setRows((current) => current.map((row) => (row.id === lead.id ? { ...row, stage: next } : row)));
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) throw new Error("no_session");
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: lead.id, stage: next }),
      });
      if (!res.ok) throw new Error(`request_failed_${res.status}`);
      await load();
    } catch (err) {
      setRows((current) => current.map((row) => (row.id === lead.id ? { ...row, stage: previous } : row)));
      showToast(getErrorMessage(err), "error");
    } finally {
      setSavingId(null);
    }
  };

  const removeLead = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) throw new Error("no_session");
      const res = await fetch(`/api/admin/leads?id=${encodeURIComponent(removing.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`request_failed_${res.status}`);
      setRemoving(null);
      showToast(t("leads_deleted"), "success");
      await load();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setRemoveBusy(false);
    }
  };

  const tabs = [
    { key: "", label: t("leads_tab_all") },
    ...STAGES.map((value) => ({
      key: value,
      label: `${t(STAGE_LABEL_KEY[value] as never)}${counts[value] ? ` (${counts[value]})` : ""}`,
    })),
  ];

  const totalPages = Math.ceil(count / LIMIT);
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className={lists.panel}>
      <AdminTabs
        items={tabs}
        activeKey={stage}
        onChange={(key) => {
          setStage(key as Stage | "");
          setPage(0);
        }}
      />

      {loading && <AdminLoadingState variant="skeleton" rows={5} />}

      {error && !loading && (
        <AdminErrorState
          title={t("leads_loading_error")}
          message={error}
          action={
            <button type="button" onClick={() => void load()} className={`${controls.action} cw-surface-2`}>
              {t("analytics_retry")}
            </button>
          }
        />
      )}

      {!loading && !error && rows.length === 0 && (
        <AdminEmptyState
          /* The sprite, not a hand-drawn outline: this panel is new,
                       and new surfaces start on the system's own hand. */
          icon={<Icon name="mail" size={20} />}
          description={t("leads_empty")}
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className={lists.list}>
          {rows.map((lead) => (
            <AdminRow
              key={lead.id}
              title={lead.name ?? lead.email ?? lead.phone ?? lead.order_ref}
              sub={[lead.phone, lead.email].filter(Boolean).join(" · ")}
              meta={
                <>
                  <span>{lead.product_title ?? lead.product_code}</span>
                  <span>·</span>
                  <span>{formatDate(lead.created_at)}</span>
                  {lead.dosha_result_type && (
                    <>
                      <span>·</span>
                      {/* A verified attempt, not a label the page claimed. */}
                      <span className={lists.itemMetaStrong}>
                        {t("leads_dosha")}: {lead.dosha_result_type}
                      </span>
                    </>
                  )}
                  {!lead.dosha_result_type && lead.dosha_claimed && (
                    <>
                      <span>·</span>
                      <span>
                        {t("leads_dosha_claimed")}: {lead.dosha_claimed}
                      </span>
                    </>
                  )}
                  {CLOSED_STAGES.includes(lead.stage) && lead.stage_changed_at && (
                    <>
                      <span>·</span>
                      <span>
                        {t("leads_closed_at")} {formatDate(lead.stage_changed_at)}
                      </span>
                    </>
                  )}
                </>
              }
              controls={
                <>
                  {/* One control says the stage: a badge beside the select that
                      changes it repeated the same word twice (owner, 2026-10-22),
                      as the catalogue's visibility once did. */}
                  <select
                    aria-label={t("leads_stage_change")}
                    className={`${controls.select} ${controls.selectNarrow}`}
                    value={lead.stage}
                    disabled={savingId === lead.id}
                    onChange={(event) => void moveStage(lead, event.target.value as Stage)}
                  >
                    {STAGES.map((value) => (
                      <option key={value} value={value}>
                        {t(STAGE_LABEL_KEY[value] as never)}
                      </option>
                    ))}
                  </select>
                </>
              }
              actions={
                canDelete ? (
                  <AdminRowIconAction
                    icon="trash"
                    danger
                    opensDialog
                    label={t("leads_delete")}
                    onClick={() => setRemoving(lead)}
                  />
                ) : null
              }
              note={lead.message}
            />
          ))}
        </div>
      )}

      {removing ? (
        <AdminModal
          title={t("leads_delete_title")}
          description={t("leads_delete_note")}
          size="md"
          onClose={() => setRemoving(null)}
          closeLabel={t("common_close")}
          footer={
            <button
              type="button"
              onClick={() => void removeLead()}
              disabled={removeBusy}
              className={`${controls.action} cw-btn-primary`}
            >
              {t("leads_delete")}
            </button>
          }
        >
          <p className={controls.hint}>
            {[removing.name, removing.phone, removing.email].filter(Boolean).join(" · ") || removing.order_ref}
          </p>
        </AdminModal>
      ) : null}

      {!loading && !error && count > 0 && (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        />
      )}
    </div>
  );
}
