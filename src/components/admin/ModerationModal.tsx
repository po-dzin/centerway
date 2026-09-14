"use client";

import { useState } from "react";

import { AdminModal } from "@/components/admin/AdminModal";
import controls from "@/components/admin/AdminControls.module.css";

/**
 * Review a course in a dialog, not in a form that unfolds inside its row
 * (2026-09-14). Approving, or returning with a note, is an episode — it happens
 * once per submission — so it does not get to change the height of every row
 * that is waiting. The row carries one «Розглянути» button; this carries the
 * decision. `returnLabel` absent means there is nothing to return (a live
 * publication approved on its own), so neither the note nor the return shows.
 */
export function ModerationModal({
  title,
  description,
  context,
  approveLabel,
  returnLabel,
  notePlaceholder,
  cancelLabel,
  busy,
  onApprove,
  onReturn,
  onClose,
}: {
  title: string;
  description: string;
  context?: string | null;
  approveLabel: string;
  returnLabel?: string;
  notePlaceholder: string;
  cancelLabel: string;
  busy: boolean;
  onApprove: (note: string) => void;
  onReturn?: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");

  return (
    <AdminModal
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={controls.action} disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
          {returnLabel && onReturn ? (
            <button
              type="button"
              className={`${controls.action} cw-btn-muted`}
              disabled={busy}
              onClick={() => onReturn(note)}
            >
              {returnLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={`${controls.action} cw-surface-2`}
            disabled={busy}
            onClick={() => onApprove(note)}
          >
            {approveLabel}
          </button>
        </>
      }
    >
      {context ? <p className={controls.hint}>{context}</p> : null}
      {returnLabel ? (
        <textarea
          className={controls.textareaShort}
          value={note}
          aria-label={notePlaceholder}
          placeholder={notePlaceholder}
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
        />
      ) : null}
    </AdminModal>
  );
}
