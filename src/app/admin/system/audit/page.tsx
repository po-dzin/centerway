"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";

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
            const {
                data: { session },
            } = await supabaseClient.auth.getSession();

            const token = session?.access_token;
            const response = await fetch(`/api/admin/audit?limit=${LIMIT}&offset=${pageIndex * LIMIT}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });

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
                <AdminLoadingState variant="spinner" text={t("audit_loading")} className="cw-panel" />
            ) : error ? (
                <AdminErrorState
                    title={t("common_error")}
                    message={error}
                    action={(
                        <button
                            type="button"
                            onClick={() => fetchLogs(page)}
                            className="px-4 py-2 cw-btn cw-surface-2"
                        >
                            {t("analytics_retry")}
                        </button>
                    )}
                />
            ) : logs.length === 0 ? (
                <AdminEmptyState
                    className="py-16 cw-panel"
                    icon={(
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="cw-muted">
                            <path d="M8 6h13" />
                            <path d="M8 12h13" />
                            <path d="M8 18h13" />
                            <path d="M3 6h.01" />
                            <path d="M3 12h.01" />
                            <path d="M3 18h.01" />
                        </svg>
                    )}
                    description={t("audit_empty")}
                />
            ) : (
                <div className="cw-panel overflow-hidden transition-colors duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left cw-muted">
                            <thead className="text-xs uppercase cw-surface-2 cw-muted border-b cw-border transition-colors duration-300">
                                <tr>
                                    <th className="px-6 py-4 font-medium">{t("audit_col_time")}</th>
                                    <th className="px-6 py-4 font-medium">{t("audit_col_actor")}</th>
                                    <th className="px-6 py-4 font-medium">{t("audit_col_action")}</th>
                                    <th className="px-6 py-4 font-medium">{t("audit_col_entity")}</th>
                                    <th className="px-6 py-4 font-medium">{t("audit_col_details")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: "var(--cw-border)" }}>
                                {logs.map((log) => (
                                    <tr key={log.id} className="cw-row-hover">
                                        <td className="px-6 py-4 whitespace-nowrap cw-muted font-mono text-xs">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs" title={log.actor_id}>
                                            {log.actor_id.substring(0, 8)}...
                                        </td>
                                        <td className="px-6 py-4 font-medium cw-text">
                                            <span className="cw-surface-2 px-2 py-1 rounded text-xs transition-colors duration-300">{log.action}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.entity_type} {log.entity_id ? <span className="cw-muted text-xs">#{log.entity_id}</span> : ""}
                                        </td>
                                        <td className="px-6 py-4">
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
