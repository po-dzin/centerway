"use client";

import type { ReactNode } from "react";

interface AdminErrorStateProps {
    title: ReactNode;
    message: ReactNode;
    action?: ReactNode;
    className?: string;
}

export function AdminErrorState({ title, message, action, className = "" }: AdminErrorStateProps) {
    return (
        <div className={`cw-panel p-6 ${className}`.trim()}>
            <div className="flex items-start gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-full cw-status-failed-soft-bg flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="cw-status-failed-text">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold cw-text">{title}</p>
                    <p className="text-sm cw-muted mt-1">{message}</p>
                    {action ? <div className="mt-3">{action}</div> : null}
                </div>
            </div>
        </div>
    );
}
