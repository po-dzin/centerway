"use client";

import { useEffect, useState, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
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
        error: string;
        close: string;
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
            <div className="cw-surface rounded-2xl cw-shadow w-full max-w-2xl overflow-hidden border cw-border">
                <div className="flex items-center justify-between p-4 border-b cw-border">
                    <div>
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{labels.details}</h3>
                        <p className="text-xs text-neutral-500 font-mono mt-1">{job.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>

                <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
                            <span className="text-xs text-neutral-500 uppercase">{labels.type}:</span>
                            <div className="font-mono text-sm font-medium mt-1">{job.type}</div>
                        </div>
                        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl flex justify-between items-center">
                            <div>
                                <span className="text-xs text-neutral-500 uppercase">{labels.status}:</span>
                                <div className={`text-sm font-medium mt-1 px-2 py-0.5 rounded-md inline-block ${STATUS_COLORS[job.status]}`}>
                                    {statusLabels[job.status]}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-neutral-500 uppercase">{labels.attempts}:</span>
                                <div className="text-sm font-medium mt-1">{job.attempts}</div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <span className="text-xs text-neutral-500 uppercase mb-2 block">Payload:</span>
                        <pre className="p-3 cw-surface-2 rounded-xl text-xs font-mono overflow-auto border cw-border">
                            {JSON.stringify(job.payload, null, 2)}
                        </pre>
                    </div>

                    {job.error_text && (
                        <div>
                            <span className="text-xs text-neutral-500 uppercase mb-2 block">{labels.error}:</span>
                            <pre className="p-3 rounded-xl text-xs font-mono overflow-auto whitespace-pre-wrap cw-alert-failed">
                                {job.error_text}
                            </pre>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t cw-border flex justify-end gap-3 cw-surface-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium cw-muted hover:bg-[var(--cw-accent-soft)] rounded-xl transition-colors">
                        {labels.close}
                    </button>
                    {job.status === "failed" && (
                        <button
                            onClick={handleRetry}
                            disabled={retrying}
                            className="px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 cw-btn-status-running"
                        >
                            {retrying && (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            )}
                            {labels.retry}
                        </button>
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
        error: t("jobs_error"),
        close: t("jobs_close"),
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
            <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto no-scrollbar">
                {STATUS_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleStatusChange(tab.key)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${activeStatus === tab.key
                            ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                            : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="cw-input pl-10 pr-4 py-2.5 text-sm focus:outline-none transition-shadow"
                    placeholder={t("jobs_search_placeholder")}
                />
            </div>

            {loading && data.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                    <svg className="animate-spin text-neutral-400 dark:text-neutral-600 w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-medium text-neutral-500">{t("jobs_loading")}</span>
                </div>
            ) : error ? (
                <div className="p-4 rounded-xl text-sm cw-alert-failed">
                    {error}
                </div>
            ) : data.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
                    <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                            <circle cx="12" cy="12" r="10" /><path d="m4.93 4.93 14.14 14.14" />
                        </svg>
                    </div>
                    <h3 className="text-sm font-medium text-neutral-900 dark:text-white">{t("jobs_not_found")}</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-xs text-center">
                        {q || activeStatus
                            ? t("jobs_try_filters")
                            : t("jobs_queue_empty")}
                    </p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {data.map((job) => (
                        <div
                            key={job.id}
                            onClick={() => setSelectedJob(job)}
                            className="cw-list-item flex items-center gap-4 p-4 cursor-pointer group"
                        >
                            <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 group-hover:bg-white dark:group-hover:bg-neutral-700 transition-colors border border-transparent group-hover:border-neutral-200 dark:group-hover:border-neutral-600">
                                <span className={`w-2.5 h-2.5 rounded-full ${job.status === 'success' ? 'cw-status-success-dot' : job.status === 'failed' ? 'cw-status-failed-dot' : job.status === 'running' ? 'cw-status-running-dot animate-pulse' : 'cw-status-pending-dot'}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium text-neutral-900 dark:text-white font-mono break-all line-clamp-1">
                                        {job.type}
                                    </p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status]}`}>
                                        {statusLabels[job.status]}
                                    </span>
                                </div>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-3">
                                    <span className="truncate max-w-[200px] font-mono opacity-60">{job.id}</span>
                                    {job.status === "failed" && job.error_text && (
                                        <span className="cw-status-failed-text truncate hidden sm:inline-block max-w-[200px]">
                                            {job.error_text}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <p className="text-sm font-medium text-neutral-900 dark:text-white tabular-nums">
                                    {new Date(job.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                                </p>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                    {new Date(job.created_at).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {!loading && !error && count > 0 && totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
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
                        className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                        title={t("common_next")}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </div>
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
