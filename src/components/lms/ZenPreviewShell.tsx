"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/Icon";
import styles from "./ZenPreview.module.css";

const RETURN_STATE_KEY = "cw-builder-zen-preview-return";

type PreviewReturnState = {
  href: string;
  historyIndex: number | null;
};

function historyIndex(): number | null {
  const value = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof value === "number" ? value : null;
}

/**
 * Records the exact Builder history entry before the preview route is pushed.
 * The stored index lets the return control cross several preview-only lesson
 * navigations in one step and restore the cached editor page and scroll state.
 */
export function rememberZenPreviewReturn(href: string) {
  const state: PreviewReturnState = { href, historyIndex: historyIndex() };
  window.sessionStorage.setItem(RETURN_STATE_KEY, JSON.stringify(state));
}

export function zenPreviewHref(pathname: string, returnTo: string) {
  const search = new URLSearchParams({ preview: "draft", returnTo });
  return `${pathname}?${search.toString()}`;
}

function readReturnState(): PreviewReturnState | null {
  try {
    const raw = window.sessionStorage.getItem(RETURN_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PreviewReturnState>;
    if (typeof parsed.href !== "string") return null;
    return {
      href: parsed.href,
      historyIndex: typeof parsed.historyIndex === "number" ? parsed.historyIndex : null,
    };
  } catch {
    return null;
  }
}

export function ZenPreviewShell({ returnTo, children }: { returnTo: string; children: ReactNode }) {
  const router = useRouter();

  const returnToBuilder = () => {
    const saved = readReturnState();
    const currentIndex = historyIndex();

    if (
      saved?.href === returnTo &&
      saved.historyIndex !== null &&
      currentIndex !== null &&
      currentIndex > saved.historyIndex
    ) {
      window.sessionStorage.removeItem(RETURN_STATE_KEY);
      window.history.go(saved.historyIndex - currentIndex);
      return;
    }

    window.sessionStorage.removeItem(RETURN_STATE_KEY);
    router.push(returnTo);
  };

  return (
    <div className={styles.shell} data-cw-preview="zen">
      <header className={styles.boundary}>
        <button className={styles.back} type="button" onClick={returnToBuilder}>
          <Icon name="arrow-left" size={18} />
          <span>До редагування</span>
        </button>
        <span className={styles.status} role="status">
          Чернетка <span aria-hidden="true">·</span> збережено
        </span>
      </header>
      {children}
    </div>
  );
}
