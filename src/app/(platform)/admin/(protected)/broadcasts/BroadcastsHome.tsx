"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";
import pageStyles from "@/components/admin/AdminPage.module.css";
import styles from "@/components/admin/AdminBroadcasts.module.css";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import type { Broadcast } from "@/lib/broadcasts/server";

import { BROADCAST_STATUS_BADGE_CLASS, BROADCAST_STATUS_LABEL, errorFromResponse, fill } from "./broadcastUi";
import { SubscribersPanel } from "./SubscribersPanel";

type Page = { data: Broadcast[]; count: number };

export function BroadcastsHome({ initial, canWrite }: { initial: Page; canWrite: boolean }) {
  const { lang, t } = useI18n();
  const locale = getAdminLocale(lang);
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"campaigns" | "base">("campaigns");
  const [page, setPage] = useState<Page>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authorizedFetch("/api/admin/broadcasts?limit=100");
      if (!res.ok) throw new Error(String(res.status));
      setPage(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const create = async () => {
    setCreating(true);
    try {
      const res = await authorizedFetch("/api/admin/broadcasts", {
        method: "POST",
        body: JSON.stringify({ title: "", audience: { include: [{ kind: "subscribers" }] } }),
      });
      if (!res.ok) {
        toast.error(await errorFromResponse(res, t));
        return;
      }
      const { broadcast } = (await res.json()) as { broadcast: Broadcast };
      router.push(`/admin/broadcasts/${broadcast.id}`);
    } finally {
      setCreating(false);
    }
  };

  const tabs = [
    { key: "campaigns", label: t("broadcasts_tab_campaigns") },
    { key: "base", label: t("broadcasts_tab_base") },
  ];

  return (
    <div className={pageStyles.page}>
      <div className={styles.toolbar}>
        <div className={pageStyles.heading}>
          <h2 className={pageStyles.title}>{t("broadcasts_title")}</h2>
          <p className={pageStyles.subtitle}>{t("broadcasts_subtitle")}</p>
        </div>
        {canWrite && tab === "campaigns" ? (
          <button type="button" className={`${controls.action} cw-surface-2`} onClick={create} disabled={creating}>
            <Icon name="plus" size={16} />
            {t("broadcasts_new")}
          </button>
        ) : null}
      </div>

      {!canWrite ? <p className={controls.hint}>{t("broadcasts_role_admin_only")}</p> : null}

      <AdminTabs
        items={tabs}
        activeKey={tab}
        onChange={(key) => {
          setTab(key as "campaigns" | "base");
          if (key === "campaigns") void reload();
        }}
      />

      {tab === "base" ? (
        <SubscribersPanel canWrite={canWrite} />
      ) : loading ? (
        <AdminLoadingState variant="skeleton" rows={4} />
      ) : error ? (
        <AdminErrorState
          title={t("broadcasts_load_error")}
          message={error}
          action={
            <button type="button" className={`${controls.action} cw-surface-2`} onClick={reload}>
              {t("broadcasts_retry")}
            </button>
          }
        />
      ) : page.data.length === 0 ? (
        <AdminEmptyState
          icon={<Icon className="cw-muted" name="mail" size={20} />}
          title={t("broadcasts_empty")}
          description={t("broadcasts_empty_hint")}
        />
      ) : (
        <div className={lists.list}>
          {page.data.map((broadcast) => {
            const when = broadcast.finished_at ?? broadcast.scheduled_at ?? broadcast.created_at;
            const title = broadcast.title || broadcast.subject || t("broadcasts_untitled");
            return (
              <Link key={broadcast.id} href={`/admin/broadcasts/${broadcast.id}`} className={lists.itemPress}>
                <div className={lists.itemBody}>
                  <div className={lists.itemTitleRow}>
                    <p className={lists.itemTitle}>{title}</p>
                    <span className={BROADCAST_STATUS_BADGE_CLASS[broadcast.status]}>
                      {t(BROADCAST_STATUS_LABEL[broadcast.status])}
                    </span>
                  </div>
                  <div className={lists.itemMeta}>
                    {broadcast.subject && broadcast.subject !== title ? <span>{broadcast.subject}</span> : null}
                    {broadcast.recipients_total > 0 ? (
                      <span>
                        {fill(t("broadcasts_row_progress"), {
                          sent: broadcast.sent_count,
                          total: broadcast.recipients_total,
                        })}
                      </span>
                    ) : broadcast.status === "scheduled" && broadcast.scheduled_at ? (
                      <span>
                        {fill(t("broadcasts_row_scheduled_for"), {
                          date: new Date(broadcast.scheduled_at).toLocaleString(locale, {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }),
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className={lists.itemWhen}>
                  <p className={lists.itemWhenTime}>
                    {new Date(when).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className={lists.itemWhenDate}>
                    {new Date(when).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
