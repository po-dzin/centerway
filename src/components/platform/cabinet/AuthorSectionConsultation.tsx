"use client";

/**
 * «Consultation» — the author's own offer of a call, and the three fields the
 * save refuses to go without once it is switched on.
 *
 * Split out of AuthorProfileFold.tsx (1,163 lines) on 2026-09-13; the markup
 * is unchanged.
 */

import { useId } from "react";
import { Icon } from "@/components/Icon";
import styles from "./Cabinet.module.css";
import { RequiredMark } from "./AuthorProfileMedia";
import type { AuthorSectionProps } from "./authorProfileTypes";

export function AuthorSectionConsultation({ draft, setDraft, t }: AuthorSectionProps) {
  /* An explicit `for` beside each `RequiredMark` — a wrapping `<label>` labels
     the mark's button, not the input it names. */
  const titleId = useId();
  const summaryId = useId();
  const contactId = useId();
  return (
    <details className={`${styles.authorSection} ${styles.authorConsultationField}`} open>
      <summary className={styles.authorSectionHead}>
        <div className={styles.authorSectionHeadText}>
          <h3 className={styles.authorSectionTitle}>{t.consultation}</h3>
        </div>
        <Icon className={styles.authorSectionChevron} name="chevron-down" size={20} />
      </summary>
      <div className={styles.authorSectionBody}>
        <label className={styles.authorVisibilityRow}>
          <input
            className={styles.authorVisibilityInput}
            type="checkbox"
            checked={draft.consultation.enabled}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, enabled: e.target.checked } }))
            }
          />
          <span className={styles.authorVisibilityMark} aria-hidden="true">
            <Icon name="check" size={14} />
          </span>
          <span>{t.consultationEnabled}</span>
        </label>
        {draft.consultation.enabled ? (
          <>
            {/* `upsertAuthorProfile` REFUSES the whole save when consultations
                are on and any of these three is blank (`authors.ts` returns
                `invalid_profile`). They were optional, unlabelled placeholders
                here — so the one rule that actually blocks the form was the one
                thing the form never said, and the author got a dead button and a
                generic toast. Labelled, marked, and required in the markup, which
                also routes them through the form's `onInvalid` reopener in
                AuthorProfileFold.tsx. */}
            <div className={styles.authorField}>
              <span className={styles.authorFieldLabel}>
                <label htmlFor={titleId}>{t.consultationTitleLabel}</label>
                <RequiredMark tooltip={t.consultationRequired} />
              </span>
              <input
                id={titleId}
                className={styles.authorInput}
                value={draft.consultation.title}
                required
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, title: e.target.value } }))
                }
              />
            </div>
            <div className={styles.authorField}>
              <span className={styles.authorFieldLabel}>
                <label htmlFor={summaryId}>{t.consultationSummaryLabel}</label>
                <RequiredMark tooltip={t.consultationRequired} />
              </span>
              <textarea
                id={summaryId}
                className={styles.authorTextarea}
                rows={3}
                value={draft.consultation.summary}
                required
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    consultation: { ...prev.consultation, summary: e.target.value },
                  }))
                }
              />
            </div>
            <div className={styles.authorFieldHead}>
              <span>{t.consultationPoints}</span>
              {draft.consultation.points.length < 3 ? (
                <button
                  type="button"
                  className={styles.authorAddIcon}
                  aria-label={t.consultationPointAdd}
                  title={t.consultationPointAdd}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      consultation: { ...prev.consultation, points: [...prev.consultation.points, ""] },
                    }))
                  }
                >
                  <Icon name="plus" size={18} />
                </button>
              ) : null}
            </div>
            <p className={styles.authorNotice}>{t.consultationPointsHint}</p>
            {draft.consultation.points.map((line, index) => (
              <div className={styles.authorCredentialRow} key={index}>
                <input
                  className={styles.authorInput}
                  aria-label={`${t.consultationPoints} ${index + 1}`}
                  value={line}
                  onChange={(e) =>
                    setDraft((prev) => {
                      const points = [...prev.consultation.points];
                      points[index] = e.target.value;
                      return { ...prev, consultation: { ...prev.consultation, points } };
                    })
                  }
                />
                {draft.consultation.points.length > 1 ? (
                  <button
                    type="button"
                    className={styles.authorIconAction}
                    aria-label={t.consultationPointRemove}
                    title={t.consultationPointRemove}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        consultation: {
                          ...prev.consultation,
                          points: prev.consultation.points.filter((_, i) => i !== index),
                        },
                      }))
                    }
                  >
                    <Icon name="close" size={18} />
                  </button>
                ) : null}
              </div>
            ))}
            <div className={styles.authorField}>
              <span className={styles.authorFieldLabel}>
                <label htmlFor={contactId}>{t.consultationContactLabel}</label>
                <RequiredMark tooltip={t.consultationRequired} />
              </span>
              <input
                id={contactId}
                className={styles.authorInput}
                type="url"
                inputMode="url"
                value={draft.consultation.contactUrl}
                required
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    consultation: { ...prev.consultation, contactUrl: e.target.value },
                  }))
                }
              />
            </div>
          </>
        ) : null}
      </div>
    </details>
  );
}
