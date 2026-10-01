"use client";

/**
 * «Список»: consent and the way out.
 *
 * Buyers and learners reach an audience straight from orders and enrollments;
 * this table is where an address's STATUS lives — subscribed through an import,
 * or unsubscribed, bounced, complained, which no audience rule can override.
 * Support may unsubscribe someone by hand (it is what people write to support
 * for); only the owner imports.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminModal } from "@/components/admin/AdminModal";
import { authorizedJson } from "@/components/auth/authorizedFetch";
import { Icon } from "@/components/Icon";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { getErrorMessage } from "@/lib/errors";
import type { SubscriptionCounts, SubscriptionRow } from "@/lib/broadcasts/server";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";

const LIMIT = 50;

const STATUS_BADGE: Record<string, string> = {
  subscribed: "cw-status-success-badge",
  unsubscribed: "cw-status-pending-badge",
  bounced: "cw-status-failed-badge",
  complained: "cw-status-failed-badge",
};

export function SubscriptionsPanel() {
  const { lang, t } = useI18n();
  const toast = useToast();
  const locale = getAdminLocale(lang);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<SubscriptionRow[] | null>(null);
  const [count, setCount] = useState(0);
  const [counts, setCounts] = useState<SubscriptionCounts>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSendpulse, setImportSendpulse] = useState(true);
  const [busy, setBusy] = useState(false);
  // Import and resubscribe are the owner's; support sees the list and may unsubscribe.
  const [canEdit, setCanEdit] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    const id = ++seq.current;
    setRows(null);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
      if (status) params.set("status", status);
      if (debouncedQ) params.set("q", debouncedQ);
      const data = await authorizedJson<{
        data: SubscriptionRow[];
        count: number;
        counts: SubscriptionCounts;
        canEdit?: boolean;
      }>(`/api/admin/broadcasts/subscriptions?${params}`);
      if (id !== seq.current) return;
      setRows(data.data);
      setCount(data.count);
      setCounts(data.counts);
      setCanEdit(Boolean(data.canEdit));
    } catch (e) {
      if (id !== seq.current) return;
      setRows([]);
      toast.error(getErrorMessage(e));
    }
  }, [status, debouncedQ, page, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (address: string, action: "unsubscribe" | "resubscribe") => {
    setBusy(true);
    try {
      await authorizedJson("/api/admin/broadcasts/subscriptions", {
        method: "PATCH",
        body: JSON.stringify({ address, action }),
      });
      toast.success(t("bc_list_done"));
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    try {
      const result = await authorizedJson<{ added: number; existing: number; invalid: string[] }>(
        "/api/admin/broadcasts/subscriptions",
        {
          method: "POST",
          body: JSON.stringify({ text: importText, source: importSendpulse ? "sendpulse_import" : "csv_import" }),
        },
      );
      toast.success(
        t("bc_import_result")
          .replace("{added}", String(result.added))
          .replace("{existing}", String(result.existing))
          .replace("{invalid}", String(result.invalid.length)),
      );
      setImportOpen(false);
      setImportText("");
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const total =
    (counts.subscribed ?? 0) + (counts.unsubscribed ?? 0) + (counts.bounced ?? 0) + (counts.complained ?? 0);

  return (
    <>
      <p className={controls.hint}>{t("bc_list_hint")}</p>
      <AdminTabs
        items={[
          { key: "", label: `${t("bc_list_all")} · ${total}` },
          { key: "subscribed", label: `${t("bc_list_subscribed")} · ${counts.subscribed ?? 0}` },
          { key: "unsubscribed", label: `${t("bc_list_unsubscribed")} · ${counts.unsubscribed ?? 0}` },
          { key: "bounced", label: `${t("bc_list_bounced")} · ${counts.bounced ?? 0}` },
          { key: "complained", label: `${t("bc_list_complained")} · ${counts.complained ?? 0}` },
        ]}
        activeKey={status}
        onChange={(key) => {
          setStatus(key);
          setPage(0);
        }}
      />
      {canEdit ? (
        <div className={controls.actions}>
          <button type="button" onClick={() => setImportOpen(true)} className={`${controls.action} cw-surface-2`}>
            <Icon name="import" size={16} />
            {t("bc_import")}
          </button>
        </div>
      ) : null}
      <AdminSearchInput
        value={q}
        onChange={setQ}
        placeholder={t("bc_list_search")}
        onClear={q ? () => setQ("") : undefined}
      />

      {rows === null ? (
        <AdminLoadingState variant="spinner" text={t("bc_loading")} />
      ) : rows.length === 0 ? (
        <AdminEmptyState icon={<Icon className="cw-muted" name="mail" size={20} />} description={t("bc_list_empty")} />
      ) : (
        <div className={lists.list}>
          {rows.map((row) => (
            <div key={row.address} className={lists.item}>
              <div className={lists.itemBody}>
                <div className={lists.itemTitleRow}>
                  <p className={lists.itemTypeCode}>{row.address}</p>
                  <span className={STATUS_BADGE[row.status] ?? STATUS_BADGE.unsubscribed}>
                    {t(
                      row.status === "subscribed"
                        ? "bc_list_subscribed"
                        : row.status === "bounced"
                          ? "bc_list_bounced"
                          : row.status === "complained"
                            ? "bc_list_complained"
                            : "bc_list_unsubscribed",
                    )}
                  </span>
                </div>
                <div className={lists.itemMeta}>
                  {row.name ? <span>{row.name}</span> : null}
                  <span>{row.source}</span>
                  {row.statusReason ? <span>{row.statusReason}</span> : null}
                  <span className={lists.itemIdFaint}>{new Date(row.statusChangedAt).toLocaleString(locale)}</span>
                </div>
              </div>
              <div className={controls.inlineActions}>
                {row.status === "subscribed" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patch(row.address, "unsubscribe")}
                    className={`${controls.action} cw-btn-muted`}
                  >
                    {t("bc_list_unsubscribe")}
                  </button>
                ) : canEdit && row.status === "unsubscribed" && row.statusReason === "manual" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patch(row.address, "resubscribe")}
                    className={`${controls.action} cw-btn-muted`}
                  >
                    {t("bc_list_resubscribe")}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {count > LIMIT ? (
        <AdminPagination
          page={page}
          totalPages={Math.ceil(count / LIMIT)}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      ) : null}

      {importOpen ? (
        <AdminModal
          title={t("bc_import")}
          description={t("bc_import_hint")}
          onClose={() => setImportOpen(false)}
          size="lg"
          footer={
            <div className={controls.actions}>
              <button type="button" onClick={() => setImportOpen(false)} className={`${controls.action} cw-btn-muted`}>
                {t("bc_cancel_dialog")}
              </button>
              <button
                type="button"
                disabled={busy || !importText.trim()}
                onClick={() => void runImport()}
                className={`${controls.action} cw-surface-2`}
              >
                {t("bc_import_go")}
              </button>
            </div>
          }
        >
          <div className={controls.formStack}>
            <textarea
              className={controls.textarea}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={12}
            />
            <label className={controls.fieldCaption}>
              <input type="checkbox" checked={importSendpulse} onChange={(e) => setImportSendpulse(e.target.checked)} />{" "}
              {t("bc_import_source_sendpulse")}
            </label>
          </div>
        </AdminModal>
      ) : null}
    </>
  );
}
