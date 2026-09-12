"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import surfaces from "@/components/admin/AdminSurfaces.module.css";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import { Icon } from "@/components/Icon";

interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: unknown;
  created_at: string;
  actor_email?: string;
}

export default function AuditLogPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(0);
  const LIMIT = 50;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const requestSeq = useRef(0);

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  const fetchLogs = async (pageIndex: number) => {
    requestSeq.current += 1;
    const reqId = requestSeq.current;
    setLoading(true);
    setError(null);
    setLogs([]);

    try {
      const response = await authorizedFetch(`/api/admin/audit?limit=${LIMIT}&offset=${pageIndex * LIMIT}`);

      if (reqId !== requestSeq.current) return;

      if (!response.ok) {
        const details = await response.text();
        console.error("Error fetching audit logs", details);
        setError(details || `HTTP ${response.status}`);
        return;
      }

      const payload = (await response.json()) as { items?: AuditLogEntry[]; total?: number };
      if (reqId !== requestSeq.current) return;

      setLogs(payload.items ?? []);
      setCount(payload.total ?? 0);
    } catch (err) {
      if (reqId !== requestSeq.current) return;
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reqId !== requestSeq.current) return;
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(count / LIMIT);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="cw-page-title text-2xl mb-2">{t("audit_title")}</h2>
        <p className="cw-page-subtitle">{t("audit_subtitle")}</p>
      </div>

      {loading ? (
        <AdminLoadingState variant="spinner" text={t("audit_loading")} className={surfaces.plate} />
      ) : error ? (
        <AdminErrorState
          title={t("common_error")}
          message={error}
          action={
            <button type="button" onClick={() => fetchLogs(page)} className="px-4 py-2 cw-btn cw-surface-2">
              {t("analytics_retry")}
            </button>
          }
        />
      ) : logs.length === 0 ? (
        <div className={surfaces.plateFlush}>
          <AdminEmptyState icon={<Icon className="cw-muted" name="list" size={20} />} description={t("audit_empty")} />
        </div>
      ) : (
        <div className={`${surfaces.plateFlush} transition-colors duration-300`}>
          <div className="overflow-x-auto">
            <table className={surfaces.table}>
              <thead className={surfaces.tableHead}>
                <tr>
                  <th className={surfaces.th}>{t("audit_col_time")}</th>
                  <th className={surfaces.th}>{t("audit_col_actor")}</th>
                  <th className={surfaces.th}>{t("audit_col_action")}</th>
                  <th className={surfaces.th}>{t("audit_col_entity")}</th>
                  <th className={surfaces.th}>{t("audit_col_details")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className={surfaces.row}>
                    <td className={`${surfaces.td} whitespace-nowrap cw-muted font-mono text-xs`}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className={`${surfaces.td} whitespace-nowrap font-mono text-xs`} title={log.actor_id}>
                      {log.actor_id.substring(0, 8)}...
                    </td>
                    <td className={`${surfaces.td} cw-text font-medium`}>
                      <span className="cw-surface-2 px-2 py-1 rounded text-xs transition-colors duration-300">
                        {log.action}
                      </span>
                    </td>
                    <td className={surfaces.td}>
                      {log.entity_type}{" "}
                      {log.entity_id ? <span className="cw-muted text-xs">#{log.entity_id}</span> : ""}
                    </td>
                    <td className={surfaces.td}>
                      <pre className="text-[10px] cw-muted font-mono max-w-xs overflow-hidden truncate">
                        {JSON.stringify(log.metadata)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && count > 0 && (
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
