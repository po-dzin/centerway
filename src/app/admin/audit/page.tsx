"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "../../../lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { AdminPagination } from "@/components/admin/AdminPagination";

interface AuditLogEntry {
    id: string;
    actor_id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    metadata: unknown;
    created_at: string;
    actor_email?: string; // We'll try to fetch this if possible, or just show ID
}

export default function AuditLogPage() {
    const { t } = useI18n();
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [page, setPage] = useState(0);
    const LIMIT = 50;
    const [loading, setLoading] = useState(true);
    const [count, setCount] = useState(0);

    useEffect(() => {
        fetchLogs(page);
    }, [page]);

    const fetchLogs = async (pageIndex: number) => {
        setLoading(true);

        try {
            const { data, count: exactCount, error } = await supabaseClient
                .from("audit_log")
                .select("*", { count: "exact" })
                .order("created_at", { ascending: false })
                .range(pageIndex * LIMIT, (pageIndex + 1) * LIMIT - 1);

            if (error) {
                console.error("Error fetching audit logs", error);
            } else if (data) {
                setLogs(data);
                setCount(exactCount ?? 0);
            }
        } catch (err) {
            console.error(err);
        } finally {
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
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center cw-muted">
                                        {t("audit_loading")}
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center cw-muted">
                                        {t("audit_empty")}
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-[var(--cw-accent-soft)] transition-colors">
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Pagination */}
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
