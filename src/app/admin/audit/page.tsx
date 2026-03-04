"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "../../../lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";

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
                    <table className="w-full text-sm text-left text-neutral-600 dark:text-neutral-300">
                        <thead className="text-xs uppercase bg-neutral-50 dark:bg-neutral-950/50 text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
                            <tr>
                                <th className="px-6 py-4 font-medium">{t("audit_col_time")}</th>
                                <th className="px-6 py-4 font-medium">{t("audit_col_actor")}</th>
                                <th className="px-6 py-4 font-medium">{t("audit_col_action")}</th>
                                <th className="px-6 py-4 font-medium">{t("audit_col_entity")}</th>
                                <th className="px-6 py-4 font-medium">{t("audit_col_details")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                                        {t("audit_loading")}
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                                        {t("audit_empty")}
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-neutral-500 dark:text-neutral-400 font-mono text-xs">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs" title={log.actor_id}>
                                            {log.actor_id.substring(0, 8)}...
                                        </td>
                                        <td className="px-6 py-4 font-medium text-neutral-900 dark:text-white">
                                            <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded text-xs transition-colors duration-300">{log.action}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.entity_type} {log.entity_id ? <span className="text-neutral-400 dark:text-neutral-500 text-xs">#{log.entity_id}</span> : ""}
                                        </td>
                                        <td className="px-6 py-4">
                                            <pre className="text-[10px] text-neutral-500 font-mono max-w-xs overflow-hidden truncate">
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
            {!loading && count > 0 && totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="cw-icon-btn disabled:opacity-30"
                        title={t("common_prev")}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>

                    <div className="cw-page-subtitle">
                        {t("common_page")} <span className="font-medium text-neutral-900 dark:text-white">{page + 1}</span> {t("common_of")} <span className="font-medium text-neutral-900 dark:text-white">{totalPages}</span>
                    </div>

                    <button
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="cw-icon-btn disabled:opacity-30"
                        title={t("common_next")}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
