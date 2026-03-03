"use client";

import { useEffect, useState, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

interface Job {
    id: string;
    type: string;
    payload: any;
    status: "pending" | "running" | "success" | "failed";
    error_text: string | null;
    attempts: number;
    run_at: string;
    created_at: string;
    updated_at: string;
}

const STATUS_COLORS = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABELS = {
    pending: "Ожидает",
    running: "Выполняется",
    success: "Успешно",
    failed: "Ошибка",
};

const STATUS_TABS = [
    { key: "", label: "Все" },
    { key: "pending", label: "Ожидают" },
    { key: "running", label: "В работе" },
    { key: "success", label: "Успешные" },
    { key: "failed", label: "Ошибки" },
];

function JobDetailsModal({ job, onClose, onRetry }: { job: Job, onClose: () => void, onRetry: () => void }) {
    const [retrying, setRetrying] = useState(false);

    const handleRetry = async () => {
        setRetrying(true);
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const res = await fetch(`/api/admin/jobs/${job.id}/retry`, {
                method: "POST",
                headers: session ? { "Authorization": `Bearer ${session.access_token}` } : {}
            });
            if (!res.ok) throw new Error("Failed to retry job");
            onRetry();
        } catch (err) {
            console.error(err);
        } finally {
            setRetrying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
                    <div>
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Детали задачи</h3>
                        <p className="text-xs text-neutral-500 font-mono mt-1">{job.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>

                <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
                            <span className="text-xs text-neutral-500 uppercase">Тип:</span>
                            <div className="font-mono text-sm font-medium mt-1">{job.type}</div>
                        </div>
                        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl flex justify-between items-center">
                            <div>
                                <span className="text-xs text-neutral-500 uppercase">Статус:</span>
                                <div className={`text-sm font-medium mt-1 px-2 py-0.5 rounded-md inline-block ${STATUS_COLORS[job.status]}`}>
                                    {STATUS_LABELS[job.status]}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-neutral-500 uppercase">Попыток:</span>
                                <div className="text-sm font-medium mt-1">{job.attempts}</div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <span className="text-xs text-neutral-500 uppercase mb-2 block">Payload:</span>
                        <pre className="p-3 bg-neutral-50 dark:bg-neutral-800/80 rounded-xl text-xs font-mono overflow-auto border border-neutral-200 dark:border-neutral-800">
                            {JSON.stringify(job.payload, null, 2)}
                        </pre>
                    </div>

                    {job.error_text && (
                        <div>
                            <span className="text-xs text-neutral-500 uppercase mb-2 block">Ошибка:</span>
                            <pre className="p-3 bg-red-50 dark:bg-red-900/10 text-red-800 dark:text-red-300 rounded-xl text-xs font-mono overflow-auto border border-red-200 dark:border-red-900/30 whitespace-pre-wrap">
                                {job.error_text}
                            </pre>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3 bg-neutral-50 dark:bg-neutral-900/50">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                        Закрыть
                    </button>
                    {job.status === "failed" && (
                        <button
                            onClick={handleRetry}
                            disabled={retrying}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {retrying && (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            )}
                            Повторить задачу
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function JobsPage() {
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
        } catch (e: any) {
            setError(e.message);
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
                    <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-1">
                        Фоновые задачи
                    </h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Мониторинг рассылок, интеграций и отложенных процессов
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
                    className="w-full bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 transition-shadow"
                    placeholder="Поиск по payload или ошибке..."
                />
            </div>

            {loading && data.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                    <svg className="animate-spin text-neutral-400 dark:text-neutral-600 w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-medium text-neutral-500">Загрузка задач...</span>
                </div>
            ) : error ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-200 dark:border-red-900/30">
                    {error}
                </div>
            ) : data.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
                    <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                            <circle cx="12" cy="12" r="10" /><path d="m4.93 4.93 14.14 14.14" />
                        </svg>
                    </div>
                    <h3 className="text-sm font-medium text-neutral-900 dark:text-white">Задач не найдено</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-xs text-center">
                        {q || activeStatus ? "Попробуйте изменить параметры поиска или фильтры." : "Очередь задач пуста."}
                    </p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {data.map((job) => (
                        <div
                            key={job.id}
                            onClick={() => setSelectedJob(job)}
                            className="flex items-center gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer group"
                        >
                            <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 group-hover:bg-white dark:group-hover:bg-neutral-700 transition-colors border border-transparent group-hover:border-neutral-200 dark:group-hover:border-neutral-600">
                                <span className={`w-2.5 h-2.5 rounded-full ${job.status === 'success' ? 'bg-green-500' : job.status === 'failed' ? 'bg-red-500' : job.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-yellow-500'}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium text-neutral-900 dark:text-white font-mono break-all line-clamp-1">
                                        {job.type}
                                    </p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status]}`}>
                                        {STATUS_LABELS[job.status]}
                                    </span>
                                </div>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-3">
                                    <span className="truncate max-w-[200px] font-mono opacity-60">{job.id}</span>
                                    {job.status === "failed" && job.error_text && (
                                        <span className="text-red-500 dark:text-red-400 truncate hidden sm:inline-block max-w-[200px]">
                                            {job.error_text}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <p className="text-sm font-medium text-neutral-900 dark:text-white tabular-nums">
                                    {new Date(job.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                    {new Date(job.created_at).toLocaleDateString("ru-RU", { day: '2-digit', month: 'short' })}
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
                        title="Предыдущая"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>

                    <div className="text-sm text-neutral-500 dark:text-neutral-400">
                        Страница <span className="font-medium text-neutral-900 dark:text-white">{page + 1}</span> из <span className="font-medium text-neutral-900 dark:text-white">{totalPages}</span>
                    </div>

                    <button
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                        title="Следующая"
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
