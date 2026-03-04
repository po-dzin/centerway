"use client";

import { useEffect, useState, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { getErrorMessage } from "@/lib/errors";

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

const LOCALE_BY_LANG = {
    ru: "ru-RU",
    en: "en-US",
} as const;

const STATUS_COLORS = {
    pending: "cw-status-pending-badge",
    running: "cw-status-running-badge",
    success: "cw-status-success-badge",
    failed: "cw-status-failed-badge",
};

function JobDetailsModal({
    job, onClose, onRetry, labels, statusLabels
}: {
    job: Job;
    onClose: () => void;
    onRetry: () => void;
    labels: {
        retryError: string;
        details: string;
        type: string;
        status: string;
        attempts: string;
        payload: string;
        error: string;
        retry: string;
    };
    statusLabels: Record<Job["status"], string>;
}) {
    const [retrying, setRetrying] = useState(false);

    const handleRetry = async () => {
        setRetrying(true);
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const res = await fetch(`/api/admin/jobs/${job.id}/retry`, {
                method: "POST",
                headers: session ? { "Authorization": `Bearer ${session.access_token}` } : {}
            });
            if (!res.ok) throw new Error(labels.retryError);
            onRetry();
        } catch (err) {
            console.error(err);
        } finally {
            setRetrying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
            <div className="cw-surface-solid rounded-2xl cw-shadow w-full max-w-2xl overflow-hidden border cw-border">
                <div className="flex items-center justify-between p-4 border-b cw-border">
                    <div>
                        <h3 className="text-lg font-semibold cw-text">{labels.details}</h3>
                        <p className="text-xs cw-muted font-mono mt-1">{job.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {job.status === "failed" && (
                            <button
                                onClick={handleRetry}
                                disabled={retrying}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 cw-btn-status-running"
                            >
                                {retrying && (
                                    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                )}
                                {labels.retry}
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 rounded-xl cw-muted hover:text-[var(--cw-text)] hover:bg-[var(--cw-accent-soft)]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 cw-surface-2 rounded-xl">
                            <span className="text-xs cw-muted uppercase">{labels.type}:</span>
                            <div className="font-mono text-sm font-medium mt-1">{job.type}</div>
                        </div>
                        <div className="p-3 cw-surface-2 rounded-xl flex justify-between items-center">
                            <div>
                                <span className="text-xs cw-muted uppercase">{labels.status}:</span>
                                <div className={`text-sm font-medium mt-1 px-2 py-0.5 rounded-md inline-block ${STATUS_COLORS[job.status]}`}>
                                    {statusLabels[job.status]}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-xs cw-muted uppercase">{labels.attempts}:</span>
                                <div className="text-sm font-medium mt-1">{job.attempts}</div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <span className="text-xs cw-muted uppercase mb-2 block">{labels.payload}:</span>
                        <pre className="p-3 cw-surface-2 rounded-xl text-xs font-mono overflow-auto border cw-border">
                            {JSON.stringify(job.payload, null, 2)}
                        </pre>
                    </div>

                    {job.error_text && (
                        <div>
                            <span className="text-xs cw-muted uppercase mb-2 block">{labels.error}:</span>
                            <pre className="p-3 rounded-xl text-xs font-mono overflow-auto whitespace-pre-wrap cw-alert-failed">
                                {job.error_text}
                            </pre>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

export default function JobsPage() {
    const { lang, t } = useI18n();
    const locale = LOCALE_BY_LANG[lang];
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
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status]}`}>
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
