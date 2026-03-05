"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { JOB_STATUS_BADGE_CLASS } from "@/lib/adminStatusStyles";
import { useToast } from "@/components/ToastProvider";

interface Job {
    id: string;
    type: string;
    payload: unknown;
    status: "pending" | "running" | "success" | "failed";
    error_text: string | null;
    attempts: number;
}

export function JobDetailsModal({
    job,
    onClose,
    onRetry,
    labels,
    statusLabels,
}: {
    job: Job;
    onClose: () => void;
    onRetry: () => void;
    labels: {
        retryError: string;
        retrySuccess: string;
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
    const toast = useToast();

    const handleRetry = async () => {
        setRetrying(true);
        try {
            const {
                data: { session },
            } = await supabaseClient.auth.getSession();
            const res = await fetch(`/api/admin/jobs/${job.id}/retry`, {
                method: "POST",
                headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
            });
            if (!res.ok) throw new Error(labels.retryError);
            toast.success(labels.retrySuccess);
            onRetry();
        } catch (err) {
            console.error(err);
            toast.error(labels.retryError);
        } finally {
            setRetrying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 cw-overlay animate-in fade-in duration-200">
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
                                <div className={`text-sm font-medium mt-1 px-2 py-0.5 rounded-md inline-block ${JOB_STATUS_BADGE_CLASS[job.status]}`}>
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
