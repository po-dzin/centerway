"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
    id: number;
    message: string;
    variant: ToastVariant;
    durationMs: number;
}

interface ToastContextValue {
    showToast: (message: string, variant?: ToastVariant, durationMs?: number) => void;
    success: (message: string, durationMs?: number) => void;
    error: (message: string, durationMs?: number) => void;
    info: (message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_VARIANT_CLASSES: Record<ToastVariant, { dot: string; tone: string }> = {
    success: { dot: "cw-status-success-dot", tone: "cw-status-success-text" },
    error: { dot: "cw-status-failed-dot", tone: "cw-status-failed-text" },
    info: { dot: "cw-status-running-dot", tone: "cw-status-running-text" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const nextIdRef = useRef(1);

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback((message: string, variant: ToastVariant = "info", durationMs = 3200) => {
        const id = nextIdRef.current++;
        setToasts((prev) => [...prev, { id, message, variant, durationMs }]);
        window.setTimeout(() => removeToast(id), durationMs);
    }, [removeToast]);

    const value = useMemo<ToastContextValue>(() => ({
        showToast,
        success: (message: string, durationMs?: number) => showToast(message, "success", durationMs),
        error: (message: string, durationMs?: number) => showToast(message, "error", durationMs),
        info: (message: string, durationMs?: number) => showToast(message, "info", durationMs),
    }), [showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed top-4 right-4 z-[110] space-y-2 pointer-events-none">
                {toasts.map((toast) => {
                    const tone = TOAST_VARIANT_CLASSES[toast.variant];
                    return (
                        <div
                            key={toast.id}
                            className="pointer-events-auto min-w-[260px] max-w-[420px] cw-surface-solid border cw-border rounded-xl cw-shadow px-3 py-2.5 flex items-start gap-2"
                        >
                            <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${tone.dot}`} />
                            <p className={`text-sm leading-snug ${tone.tone}`}>{toast.message}</p>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="ml-auto p-1 rounded-md cw-muted hover:text-[var(--cw-text)] hover:bg-[var(--cw-accent-soft)] transition-colors"
                                aria-label="Close"
                                title="Close"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
}
