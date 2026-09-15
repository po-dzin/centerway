"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";
import surfaces from "@/components/admin/AdminSurfaces.module.css";
import styles from "@/components/admin/AdminBroadcasts.module.css";
import type { TranslationKey } from "@/lib/i18n";
import type { SubscriptionItem, SubscriptionsPage, SubscriptionStatus } from "@/lib/broadcasts/subscriptions";

import { errorFromResponse, fill } from "./broadcastUi";

const LIMIT = 50;

const STATUS_LABEL: Record<SubscriptionStatus, TranslationKey> = {
  subscribed: "broadcasts_base_subscribed",
  unsubscribed: "broadcasts_base_unsubscribed",
  bounced: "broadcasts_base_bounced",
  complained: "broadcasts_base_complained",
};

const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  subscribed: "cw-status-success-badge",
  unsubscribed: "cw-status-pending-badge",
  bounced: "cw-status-failed-badge",
  complained: "cw-status-failed-badge",
};

type Preview = { valid: number; invalid: number; duplicates: number; unsubscribed: number };

export function SubscribersPanel({ canWrite }: { canWrite: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState<"" | SubscriptionStatus>("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [data, setData] = useState<SubscriptionsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const [csv, setCsv] = useState("");
  const [source, setSource] = useState("sendpulse");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setPageIndex(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(pageIndex * LIMIT) });
      if (status) params.set("status", status);
      if (debouncedQ) params.set("q", debouncedQ);
      const res = await authorizedFetch(`/api/admin/subscriptions?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as SubscriptionsPage;
      if (id === seq.current) setData(json);
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [status, debouncedQ, pageIndex]);

  useEffect(() => {
    void load();
  }, [load]);

  const runImport = async (dryRun: boolean) => {
    setImporting(true);
    try {
      const res = await authorizedFetch("/api/admin/subscriptions", {
        method: "POST",
        body: JSON.stringify({ csv, source, dryRun }),
      });
      if (!res.ok) {
        toast.error(await errorFromResponse(res, t));
        return;
      }
      const json = (await res.json()) as {
        preview: Preview;
        result?: { inserted: number; alreadyKnown: number; suppressed: number };
      };
      setPreview(json.preview);
      if (json.result) {
        toast.success(
          fill(t("broadcasts_import_done"), {
            inserted: json.result.inserted,
            known: json.result.alreadyKnown,
            suppressed: json.result.suppressed,
          }),
        );
        setCsv("");
        setPreview(null);
        setPageIndex(0);
        void load();
      }
    } finally {
      setImporting(false);
    }
  };

  const changeStatus = async (item: SubscriptionItem, next: SubscriptionStatus) => {
    const res = await authorizedFetch("/api/admin/subscriptions", {
      method: "PATCH",
      body: JSON.stringify({ address: item.address, status: next }),
    });
    if (!res.ok) {
      toast.error(await errorFromResponse(res, t));
      return;
    }
    const outcome = (await res.json()) as { changed: boolean };
    if (outcome.changed) toast.success(t("broadcasts_base_updated"));
    else toast.warning(t("broadcasts_base_unchanged"));
    void load();
  };

  const totals = data?.totals ?? {};
  const statusTabs = [
    { key: "", label: t("broadcasts_base_all") },
    ...(Object.keys(STATUS_LABEL) as SubscriptionStatus[]).map((key) => ({
      key,
      label: `${t(STATUS_LABEL[key])} · ${totals[key] ?? 0}`,
    })),
  ];
  const totalPages = Math.ceil((data?.count ?? 0) / LIMIT);

  return (
    <div className={styles.section}>
      {canWrite ? (
        <div className={`${surfaces.plate} ${surfaces.plateCard} ${controls.fieldStack}`}>
          <p className={controls.disclosureTitle}>{t("broadcasts_import_title")}</p>
          <p className={controls.hint}>{t("broadcasts_import_hint")}</p>
          <div className={styles.twoFields}>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{t("broadcasts_import_file")}</span>
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className={controls.input}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setCsv(await file.text());
                  setPreview(null);
                }}
              />
            </label>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{t("broadcasts_import_source")}</span>
              <input className={controls.input} value={source} onChange={(e) => setSource(e.target.value)} />
            </label>
          </div>
          <label className={controls.field}>
            <span className={controls.fieldCaption}>{t("broadcasts_import_paste")}</span>
            <textarea
              className={styles.importBox}
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
              }}
              placeholder={"email;name;status\nanna@example.com;Анна;active"}
            />
          </label>
          {preview ? (
            <div className={controls.facts}>
              <div className={controls.factRow}>
                <span className={controls.factLabel}>{t("broadcasts_import_valid")}</span>
                <span className={controls.factValue}>{preview.valid}</span>
              </div>
              <div className={controls.factRow}>
                <span className={controls.factLabel}>{t("broadcasts_import_unsubscribed")}</span>
                <span className={controls.factValue}>{preview.unsubscribed}</span>
              </div>
              <div className={controls.factRow}>
                <span className={controls.factLabel}>{t("broadcasts_import_duplicates")}</span>
                <span className={controls.factValue}>{preview.duplicates}</span>
              </div>
              <div className={controls.factRow}>
                <span className={controls.factLabel}>{t("broadcasts_import_invalid")}</span>
                <span className={controls.factValue}>{preview.invalid}</span>
              </div>
            </div>
          ) : null}
          <div className={controls.actions}>
            <button
              type="button"
              className={`${controls.action} cw-surface-2`}
              disabled={!csv.trim() || importing}
              onClick={() => runImport(true)}
            >
              {t("broadcasts_import_check")}
            </button>
            <button
              type="button"
              className={`${controls.action} cw-btn-primary`}
              disabled={!preview || preview.valid === 0 || importing}
              onClick={() => runImport(false)}
            >
              {t("broadcasts_import_run")}
            </button>
          </div>
        </div>
      ) : null}

      <AdminTabs
        items={statusTabs}
        activeKey={status}
        onChange={(key) => {
          setStatus(key as "" | SubscriptionStatus);
          setPageIndex(0);
        }}
      />
      <AdminSearchInput
        value={q}
        onChange={setQ}
        placeholder={t("broadcasts_base_search")}
        onClear={q ? () => setQ("") : undefined}
      />

      {loading ? (
        <AdminLoadingState variant="skeleton" rows={5} />
      ) : error ? (
        <AdminErrorState
          title={t("broadcasts_load_error")}
          message={error}
          action={
            <button type="button" className={`${controls.action} cw-surface-2`} onClick={load}>
              {t("broadcasts_retry")}
            </button>
          }
        />
      ) : !data || data.data.length === 0 ? (
        <AdminEmptyState
          icon={<Icon className="cw-muted" name="mail" size={20} />}
          title={t("broadcasts_base_empty")}
          description={t("broadcasts_base_empty_hint")}
        />
      ) : (
        <div className={lists.list}>
          {data.data.map((item) => (
            <div key={item.id} className={lists.item}>
              <div className={lists.itemHead}>
                <div className={lists.itemIdentity}>
                  <p className={lists.itemTitle}>{item.address}</p>
                  <p className={lists.itemSub}>
                    {[item.name, fill(t("broadcasts_base_source"), { source: item.source })].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {canWrite ? (
                  <select
                    className={controls.select}
                    aria-label={t("broadcasts_base_set_status")}
                    value={item.status}
                    onChange={(e) => changeStatus(item, e.target.value as SubscriptionStatus)}
                    style={{ width: "auto" }}
                  >
                    {(Object.keys(STATUS_LABEL) as SubscriptionStatus[]).map((key) => (
                      <option key={key} value={key}>
                        {t(STATUS_LABEL[key])}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`${STATUS_BADGE[item.status]} ${styles.rowStatus}`}>{t(STATUS_LABEL[item.status])}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 ? (
        <AdminPagination
          page={pageIndex}
          totalPages={totalPages}
          onPrev={() => setPageIndex((p) => Math.max(0, p - 1))}
          onNext={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
        />
      ) : null}
    </div>
  );
}
