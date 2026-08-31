"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useChromeReveal } from "@/components/platform/layout/useChromeReveal";
import { useZenPreview, type ZenPreviewNavigation } from "./ZenPreviewContext";
import styles from "./Lms.module.css";

/** One reading toolbar, including the author-only way back. No second bar. */
export function ReaderChrome({ backHref, backLabel = "До курсу", tools, locked = false, preview: suppliedPreview }: {
  backHref?: string;
  backLabel?: string;
  tools?: ReactNode;
  locked?: boolean;
  preview?: ZenPreviewNavigation;
}) {
  const contextPreview = useZenPreview();
  const preview = suppliedPreview ?? contextPreview;
  const chromeRef = useRef<HTMLDivElement>(null);
  const { hidden } = useChromeReveal(true, chromeRef, { locked });

  return (
    <div className={styles.readerChrome} ref={chromeRef} data-hidden={hidden ? "true" : undefined}>
      {preview ? (
        <button className={styles.readerPreviewBack} type="button" onClick={preview.returnToBuilder}>
          <Icon name="arrow-left" size={18} />
          <span>До редагування</span>
        </button>
      ) : backHref ? (
        <Link className={styles.readerBack} href={backHref} aria-label={backLabel}>
          <Icon name="arrow-left" size={18} />
        </Link>
      ) : null}
      {tools ? <div className={styles.readerTools}>{tools}</div> : null}
    </div>
  );
}
