"use client";

import { useEffect, useState, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { JobDetailsModal } from "@/components/admin/modals/JobDetailsModal";
import { getErrorMessage } from "@/lib/errors";
import { getAdminLocale } from "@/lib/adminLocale";
import { JOB_STATUS_BADGE_CLASS } from "@/lib/adminStatusStyles";

interface Job {
    id: string;
    type: string;
    payload: unknown;
    status: "pending" | "running" | "success" | "failed";
    error_text: string | null;
    attempts: number;
    run_at: string;
    created_at: string;
    updated_at: string;
}

export default function JobsPage() {
    const { lang, t } = useI18n();
    const locale = getAdminLocale(lang);
    const statusLabels: Record<Job["status"], string> = {
        pending: t("jobs_status_pending"),
        running: t("jobs_status_running"),
        success: t("jobs_status_success"),
        failed: t("jobs_status_failed"),
    };
    const STATUS_TABS = [
        { key: "", label: t("jobs_tab_all") },
        { key: "pending", label: t("jobs_tab_pending") },
        { key: "running", label: t("jobs_tab_running") },
        { key: "success", label: t("jobs_tab_success") },
        { key: "failed", label: t("jobs_tab_failed") },
    ];
    const modalLabels = {
        retryError: t("jobs_retry_error"),
        details: t("jobs_details"),
        type: t("jobs_type"),
        status: t("jobs_status"),
        attempts: t("jobs_attempts"),
        payload: t("jobs_payload"),
        error: t("jobs_error"),
        retry: t("jobs_retry"),
    };

    const [q, setQ] = useState("");
    const [debouncedQ, setDQ] = useState("");
    const [activeStatus, setStatus] = useState("");
    const [data, setData] = useState<Job[]>([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(0);
    const LIMIT = 50;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);

    useEffect(() => {
        const t = setTimeout(() => {
            setDQ(q);
            setPage(0);
        }, 350);
        return () => clearTimeout(t);
    }, [q]);

    const fetchJobs = useCallback(async (query: string, status: string, pageIndex: number) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query) params.set("q", query);
            if (status) params.set("status", status);
            params.set("limit", String(LIMIT));
            params.set("offset", String(pageIndex * LIMIT));

            const { data: { session } } = await supabaseClient.auth.getSession();
            const res = await fetch(`/api/admin/jobs?${params}`, {
                headers: session ? { "Authorization": `Bearer ${session.access_token}` } : {}
            });
            if (!res.ok) throw new Error(`${res.status}`);
            const json = await res.json();

            setData(json.data ?? []);
            setCount(json.count ?? 0);
        } catch (e: unknown) {
            setError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchJobs(debouncedQ, activeStatus, page);
    }, [debouncedQ, activeStatus, page, fetchJobs]);

    const handleStatusChange = (status: string) => {
        setStatus(status);
        setPage(0);
    };

    const totalPages = Math.ceil(count / LIMIT);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="cw-page-title mb-1">
                        {t("jobs_title")}
                    </h2>
                    <p className="cw-page-subtitle">
                        {t("jobs_subtitle")}
                    </p>
                </div>
            </div>

            {/* Status tabs */}
            <AdminTabs
                items={STATUS_TABS}
                activeKey={activeStatus}
                onChange={handleStatusChange}
                className="overflow-x-auto no-scrollbar"
            />

            <AdminSearchInput
                value={q}
                onChange={setQ}
                placeholder={t("jobs_search_placeholder")}
                onClear={q ? () => setQ("") : undefined}
            />

            {loading && data.length === 0 ? (
                <AdminLoadingState variant="spinner" text={t("jobs_loading")} />
            ) : error ? (
                <div className="p-4 rounded-xl text-sm cw-alert-failed">
                    {error}
                </div>
            ) : data.length === 0 ? (
                <AdminEmptyState
                    className="py-20"
                    iconWrapperClassName="w-12 h-12 rounded-full"
                    icon={(
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cw-muted">
                            <circle cx="12" cy="12" r="10" />
                            <path d="m4.93 4.93 14.14 14.14" />
                        </svg>
                    )}
                    title={t("jobs_not_found")}
                    description={q || activeStatus ? t("jobs_try_filters") : t("jobs_queue_empty")}
                />
            ) : (
                <div className="space-y-1.5">
                    {data.map((job) => (
                        <div
                            key={job.id}
                            onClick={() => setSelectedJob(job)}
                            className="cw-list-item flex items-center gap-4 p-4 cursor-pointer group"
                        >
                            <div className="w-10 h-10 rounded-full cw-surface-2 flex items-center justify-center shrink-0 group-hover:bg-[var(--cw-surface)] transition-colors border border-transparent group-hover:border-[var(--cw-border)]">
                                <span className={`w-2.5 h-2.5 rounded-full ${job.status === 'success' ? 'cw-status-success-dot' : job.status === 'failed' ? 'cw-status-failed-dot' : job.status === 'running' ? 'cw-status-running-dot animate-pulse' : 'cw-status-pending-dot'}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium cw-text font-mono break-all line-clamp-1">
                                        {job.type}
                                    </p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${JOB_STATUS_BADGE_CLASS[job.status]}`}>
                                        {statusLabels[job.status]}
                                    </span>
                                </div>
                                <div className="text-xs cw-muted flex items-center gap-3">
                                    <span className="truncate max-w-[200px] font-mono opacity-60">{job.id}</span>
                                    {job.status === "failed" && job.error_text && (
                                        <span className="cw-status-failed-text truncate hidden sm:inline-block max-w-[200px]">
                                            {job.error_text}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <p className="text-sm font-medium cw-text tabular-nums">
                                    {new Date(job.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                                </p>
                                <p className="text-xs cw-muted mt-0.5">
                                    {new Date(job.created_at).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {!loading && !error && count > 0 && (
                <AdminPagination
                    page={page}
                    totalPages={totalPages}
                    onPrev={() => setPage((p) => Math.max(0, p - 1))}
                    onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                />
            )}

            {/* Modal */}
            {selectedJob && (
                <JobDetailsModal
                    job={selectedJob}
                    labels={modalLabels}
                    statusLabels={statusLabels}
                    onClose={() => setSelectedJob(null)}
                    onRetry={() => {
                        setSelectedJob(null);
                        fetchJobs(debouncedQ, activeStatus, page);
                    }}
                />
            )}
        </div>
    );
}
