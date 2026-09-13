"use client";

/**
 * The panel's dialog, once, instead of per call site.
 *
 * WHAT THE COPIES GOT WRONG. `ReconcileModal` and `JobDetailsModal` each build
 * their own overlay, and both share the same three holes: Escape is bound to the
 * overlay's `onKeyDown`, so it only fires while focus is already inside — press
 * it right after opening and nothing happens; nothing moves focus into the
 * dialog, so a keyboard user opens a box and stays outside it, and Tab keeps
 * walking the page behind; and the page under the overlay still scrolls.
 *
 * A dialog is a small pile of details that are all easy to get wrong and all
 * invisible when they are wrong, so they live here.
 *
 * A PORTAL, because `position: fixed` is not fixed to the viewport inside an
 * ancestor with a transform, a filter, or `contain` — any of which is one
 * utility class away in a panel built from them. Rendering to `body` makes the
 * overlay independent of wherever it was called from.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import controls from "@/components/admin/AdminControls.module.css";

export function AdminModal({
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const dialog = useRef<HTMLDivElement>(null);

  // `useSyncExternalStore` rather than a mount flag in an effect: the server
  // snapshot is `false` and the client's is `true`, which is precisely the
  // question "is there a DOM to portal into" — and it answers it without a
  // second render or a setState the linter is right to object to.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!mounted) return;

    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // On `document`, not on the overlay: the overlay only hears a key once
    // something inside it has focus, which is exactly the moment a person is
    // most likely to press Escape and find nothing happens.
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      // Back where they were: closing a dialog should not drop a keyboard
      // user at the top of the document.
      opener?.focus?.();
    };
  }, [onClose, mounted]);

  /* Tab stays inside. Without this the sequence after the last field is the
       page behind the scrim — visibly nowhere, since the overlay covers it. */
  const trap = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || !dialog.current) return;
    const focusable = dialog.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === dialog.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className={controls.overlay}
      onMouseDown={(event) => {
        // `mousedown` on the scrim ITSELF: a click that starts on a field
        // and ends on the scrim (a drag while selecting text) is not a
        // request to close, and `onClick` cannot tell the difference.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={trap}
        className={size === "lg" ? controls.dialogWide : controls.dialog}
      >
        <div className={controls.dialogHead}>
          <h3 className={controls.dialogTitle}>{title}</h3>
          {description ? <p className={controls.dialogNote}>{description}</p> : null}
        </div>

        <div className={controls.dialogBody}>{children}</div>

        {footer ? <div className={controls.dialogFoot}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
