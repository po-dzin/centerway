"use client";

/**
 * Розсилки: the platform's own mailing list, replacing SendPulse.
 *
 * Two tabs. «Кампанії» is the letters — a list, and one letter open at a time
 * in the editor. «Список» is the people — consent and the way out: who
 * unsubscribed, which addresses bounced, who complained, and the import of the
 * old SendPulse base.
 *
 * The data contract is src/lib/broadcasts (and the migration it names); the
 * runbook is docs/broadcasts-2026-09-15.md.
 */

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { useToast } from "@/components/ToastProvider";
import { authorizedJson } from "@/components/auth/authorizedFetch";
import { Icon } from "@/components/Icon";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { getErrorMessage } from "@/lib/errors";
import type { TranslationKey } from "@/lib/i18n";
import type { BroadcastDetail, BroadcastSummary } from "@/lib/broadcasts/server";
import pageStyles from "@/components/admin/AdminPage.module.css";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";

import { BroadcastEditor } from "./BroadcastEditor";
import { SubscriptionsPanel } from "./SubscriptionsPanel";

const STATUS_BADGE: Record<string, string> = {
  draft: "cw-status-pending-badge",
  scheduled: "cw-status-pending-badge",
  sending: "cw-status-running-badge",
  sent: "cw-status-success-badge",
  cancelled: "cw-status-failed-badge",
  failed: "cw-status-failed-badge",
};

export default function BroadcastsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState("campaigns");

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.heading}>
        <h2 className={pageStyles.title}>{t("bc_title")}</h2>
        <p className={pageStyles.subtitle}>{t("bc_subtitle")}</p>
      </div>
      <AdminTabs
        items={[
          { key: "campaigns", label: t("bc_tab_campaigns") },
          { key: "list", label: t("bc_tab_list") },
        ]}
        activeKey={tab}
        onChange={setTab}
      />
      {tab === "campaigns" ? <Campaigns /> : <SubscriptionsPanel />}
    </div>
  );
}

function Campaigns() {
  const { lang, t } = useI18n();
  const toast = useToast();
  const locale = getAdminLocale(lang);
  const [items, setItems] = useState<BroadcastSummary[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<BroadcastDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await authorizedJson<{ broadcasts: BroadcastSummary[]; canEdit: boolean }>("/api/admin/broadcasts");
      setItems(data.broadcasts);
      setCanEdit(data.canEdit);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openOne = async (id: string) => {
    setBusy(true);
    try {
      const data = await authorizedJson<{ broadcast: BroadcastDetail; canEdit: boolean }>(
        `/api/admin/broadcasts/${id}`,
      );
      setCanEdit(data.canEdit);
      setOpen(data.broadcast);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const data = await authorizedJson<{ broadcast: BroadcastDetail }>("/api/admin/broadcasts", {
        method: "POST",
        body: JSON.stringify({ title: "", audience: { include: [] } }),
      });
      setOpen(data.broadcast);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (open) {
    return (
      <BroadcastEditor
        key={open.id}
        initial={open}
        canEdit={canEdit}
        onBack={() => {
          setOpen(null);
          void load();
        }}
        onOpen={(id) => void openOne(id)}
      />
    );
  }

  if (error) {
    return (
      <AdminErrorState
        title={t("common_error")}
        message={error}
        action={
          <button type="button" onClick={() => void load()} className={`${controls.action} cw-surface-2`}>
            {t("analytics_retry")}
          </button>
        }
      />
    );
  }
  if (!items) return <AdminLoadingState variant="spinner" text={t("bc_loading")} />;

  return (
    <>
      {canEdit ? (
        <div className={controls.actions}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className={`${controls.action} cw-surface-2`}
          >
            <Icon name="plus" size={16} />
            {t("bc_new")}
          </button>
        </div>
      ) : (
        <p className={controls.hint}>{t("bc_admin_only")}</p>
      )}
      {items.length === 0 ? (
        <AdminEmptyState
          icon={<Icon className="cw-muted" name="mail" size={20} />}
          title={t("bc_empty")}
          description={t("bc_empty_hint")}
        />
      ) : (
        <div className={lists.list}>
          {items.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={busy}
              onClick={() => void openOne(b.id)}
              className={lists.itemPress}
            >
              <div className={lists.itemBody}>
                <div className={lists.itemTitleRow}>
                  <p className={lists.itemTitle}>{b.title || b.subject || t("bc_untitled")}</p>
                  <span className={STATUS_BADGE[b.status] ?? STATUS_BADGE.draft}>
                    {t(`bc_status_${b.status}` as TranslationKey)}
                  </span>
                </div>
                <div className={lists.itemMeta}>
                  {b.subject && b.title ? <span>{b.subject}</span> : null}
                  {b.status !== "draft" ? (
                    <span>
                      {b.sentCount}/{b.recipientsTotal}
                      {b.failedCount ? ` · ${t("bc_stat_failed")} ${b.failedCount}` : ""}
                    </span>
                  ) : null}
                  <span className={lists.itemIdFaint}>
                    {new Date(b.startedAt ?? b.createdAt).toLocaleString(locale)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
