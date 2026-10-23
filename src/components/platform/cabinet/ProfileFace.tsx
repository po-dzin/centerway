"use client";

/**
 * YOUR OWN FACE IS A BUTTON (2026-10-23, the «Профіль CenterWay» canvas, Main
 * board). Pressing the avatar in the profile hero opens a small sheet beside
 * it with the three things a face is for: look at it, replace it, or go and
 * aim it. Generation («Згенерувати») is deliberately absent until its pricing
 * is settled — not hidden, not disabled: not built.
 *
 *   · «Переглянути» opens the platform's one photo viewer (`PhotoViewer`), the
 *     same one the feed uses, with «Завантажити» on its bottom row;
 *   · «Завантажити фото» picks a file and uploads it at once — no draft, no
 *     save button: the result is the face everywhere, and a toast says so;
 *   · «Кадрувати, ім'я, обкладинка» is the way to the fuller editor, offered
 *     only where one exists (the author fold, for now).
 *
 * selection_family: contour for the face button and the sheet's buttons (the
 * focus ring and the role's own surface), ink for the settings link
 * (`InteractionInkLabel variant="link"`). Boundary: the sheet is a quiet
 * overlay — the raised material shadow, no outline.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { PhotoViewer } from "@/components/platform/PhotoViewer";
import type { FaceCopy } from "./faceCopy";
import styles from "./ProfileFace.module.css";

export function ProfileFace({
  avatar,
  frameClassName,
  photo,
  name,
  settingsHref,
  uploading,
  onUpload,
  copy,
}: {
  /** What the circle shows: the picture, or the initial standing in for one. */
  avatar: ReactNode;
  /** The circle's own geometry, owned by the hero that places it. */
  frameClassName: string;
  /** The full picture for the viewer; null when there is only an initial. */
  photo: { src: string; alt: string } | null;
  name: string;
  /** Where cropping, the name and the cover are edited; null where nothing does yet. */
  settingsHref: string | null;
  uploading: boolean;
  /** Resolves true when the new face is saved; the caller says so in a toast. */
  onUpload: (file: File) => Promise<boolean>;
  copy: FaceCopy;
}) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const sheetId = useId();

  /* Escape and a press outside close the sheet, the way every popover in the
     chrome closes; focus goes back to the face it came from. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const pick = () => input.current?.click();

  /* ONE FIELD, IN WHICHEVER LAYER IS LIVE. The viewer is a modal <dialog>, and
     a modal dialog makes everything outside it inert — so while it is open the
     field moves inside it, beside the «Завантажити» that opens it. */
  const fileField = (
    <input
      ref={input}
      className={styles.file}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
      tabIndex={-1}
      aria-hidden="true"
      onChange={async (event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        setOpen(false);
        if (await onUpload(file)) setViewing(false);
      }}
    />
  );

  return (
    <span className={styles.wrap} ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className={styles.face}
        aria-label={copy.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? sheetId : undefined}
        aria-busy={uploading || undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={frameClassName} aria-hidden="true">
          {avatar}
        </span>
        <span className={styles.penMark} aria-hidden="true">
          <Icon name="edit" size={16} />
        </span>
      </button>

      {viewing ? null : fileField}

      {open ? (
        <div id={sheetId} role="dialog" aria-label={copy.sheetLabel} className={styles.sheet}>
          <div className={styles.sheetHead}>
            <span className={styles.sheetLabel}>{copy.sheetLabel}</span>
            <button
              type="button"
              className={styles.sheetClose}
              aria-label={copy.close}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          {photo ? (
            <button
              type="button"
              className={styles.sheetAction}
              onClick={() => {
                setOpen(false);
                setViewing(true);
              }}
            >
              <Icon name="eye" size={18} />
              {copy.view}
            </button>
          ) : null}
          <button type="button" className={styles.sheetAction} disabled={uploading} onClick={pick}>
            <Icon name="photo" size={18} />
            {uploading ? copy.uploading : copy.upload}
          </button>
          {settingsHref ? (
            <a className={styles.sheetLink} href={settingsHref} data-cw-ink-control="" onClick={() => setOpen(false)}>
              <InteractionInkLabel variant="link">{copy.settings}</InteractionInkLabel>
            </a>
          ) : null}
        </div>
      ) : null}

      {viewing && photo ? (
        <PhotoViewer
          photos={[photo]}
          start={0}
          label={copy.viewerLabel(name)}
          onClose={() => setViewing(false)}
          actions={
            <>
              {fileField}
              <button type="button" className={styles.viewerUpload} disabled={uploading} onClick={pick}>
                <Icon name="photo" size={18} />
                {uploading ? copy.uploading : copy.viewerUpload}
              </button>
            </>
          }
        />
      ) : null}
    </span>
  );
}
