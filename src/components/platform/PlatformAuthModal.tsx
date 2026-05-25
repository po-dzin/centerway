"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import styles from "@/components/platform/PlatformContentStyles";

type PlatformAuthModalProps = {
  open: boolean;
  onClose: () => void;
  onSignIn: () => void;
};

export function PlatformAuthModal({
  open,
  onClose,
  onSignIn,
}: PlatformAuthModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 cw-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`${styles.panel} ${styles.panelStack} ${styles.authModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.authModalClose}
          onClick={onClose}
          aria-label="Закрити вікно входу"
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className={styles.panelIntro}>
          <p className={styles.label}>Вхід</p>
          <h2 className={styles.authModalTitle} id={titleId}>Увійдіть у профіль</h2>
          <p className={styles.lead}>
            Щоб зберігати персональні результати, прогрес і доступи у профілі CenterWay, потрібна авторизація.
          </p>
        </div>
        <div className={styles.authModalActions}>
          <button className={styles.primaryButton} type="button" onClick={onSignIn}>
            Увійти через Google
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
