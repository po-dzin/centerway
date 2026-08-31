"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
import { createToastTimer, type ToastTimer } from "./toastTimer";
import styles from "./ToastProvider.module.css";

export type ToastVariant = "success" | "error" | "info" | "warning";
type ToastItem = { id: number; message: string; variant: ToastVariant; durationMs: number };
interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
  warning: (message: string, durationMs?: number) => void;
}
const ToastContext = createContext<ToastContextValue | null>(null);
const TYPE_LABELS: Record<ToastVariant, string> = {
  success: "Успішно", error: "Помилка", info: "Інформація", warning: "Увага",
};

function Toast({ item, dismiss }: { item: ToastItem; dismiss: (id: number) => void }) {
  const timer = useRef<ToastTimer | null>(null);
  useEffect(() => {
    const clock = createToastTimer(() => dismiss(item.id), item.durationMs);
    timer.current = clock;
    const visibility = () => document.hidden ? clock.pause("hidden") : clock.resume("hidden");
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      clock.dispose();
      timer.current = null;
    };
  }, [item.id, item.durationMs, dismiss]);

  return (
    <div
      className={styles.toast}
      data-variant={item.variant}
      onPointerEnter={() => timer.current?.pause("pointer")}
      onPointerLeave={() => timer.current?.resume("pointer")}
      onFocusCapture={() => timer.current?.pause("focus")}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) timer.current?.resume("focus");
      }}
    >
      <span className={styles.dot} aria-hidden="true" />
      <p className={styles.message} role={item.variant === "error" ? "alert" : "status"} aria-atomic="true">
        <span className={styles.srOnly}>{TYPE_LABELS[item.variant]}: </span>{item.message}
      </p>
      <button type="button" className={styles.close} onClick={() => dismiss(item.id)} aria-label="Закрити сповіщення">
        <InteractionInkIcon><Icon name="close" size={18} /></InteractionInkIcon>
      </button>
    </div>
  );
}

/** One viewport per route-group root; notifications never enter page layout. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const showToast = useCallback((message: string, variant: ToastVariant = "info", durationMs = 5000) => {
    if (!message.trim()) return;
    const item = { id: nextId.current++, message, variant, durationMs };
    // Repeated results renew their own timer rather than flooding the viewport.
    setToasts((items) => [...items.filter((one) => one.message !== message || one.variant !== variant), item]);
  }, []);
  const value = useMemo<ToastContextValue>(() => ({
    showToast,
    success: (message, duration) => showToast(message, "success", duration),
    error: (message, duration) => showToast(message, "error", duration),
    info: (message, duration) => showToast(message, "info", duration),
    warning: (message, duration) => showToast(message, "warning", duration),
  }), [showToast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.viewport} aria-label="Сповіщення">
        {toasts.map((item) => <Toast key={item.id} item={item} dismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
