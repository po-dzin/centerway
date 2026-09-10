"use client";

import { useState } from "react";
import { JOB_STATUS_BADGE_CLASS } from "@/lib/admin/adminStatusStyles";
import { useToast } from "@/components/ToastProvider";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
import { authorizedFetch } from "@/components/auth/authorizedFetch";

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
            const res = await authorizedFetch(`/api/admin/jobs/${job.id}/retry`, { method: "POST" });
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
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 cw-overlay animate-in fade-in duration-200"
            onClick={onClose}
            onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
            }}
        >
            <div
                className="cw-surface-solid rounded-2xl cw-shadow w-full max-w-2xl overflow-hidden border cw-border"
                role="dialog"
                aria-modal="true"
                aria-label={labels.details}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b cw-border">
                    <div>
                        <h3 className="text-lg font-semibold cw-text">{labels.details}</h3>
                        <p className="text-xs cw-muted font-mono mt-1">{job.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {job.status === "failed" && (
                            <button
                                type="button"
                                onClick={handleRetry}
                                disabled={retrying}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 cw-btn-status-running"
                            >
                                {/* IN FLIGHT, IN WORDS (2026-09-06). This was a
                                    14px rotating ring — too small for the house
                                    mark to stand in (`LogoMark` refuses below
                                    20px, and rightly), and the fourth spinner in
                                    a product that had decided against them. It
                                    needs no glyph: the button is already
                                    disabled and dimmed while the request is out,
                                    and the ellipsis is how every other control
                                    here says «doing it» — «Зберігаємо…» in the
                                    workshop, «Надсилаємо…» in the cabinet. */}
                                {retrying ? `${labels.retry}…` : labels.retry}
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="cw-icon-btn" aria-label="Close modal">
                            <InteractionInkIcon>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </InteractionInkIcon>
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
