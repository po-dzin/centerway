"use client";

/**
 * «About» — bio, quote, facts, credentials and the experience badge.
 *
 * Split out of AuthorProfileFold.tsx (1,163 lines) on 2026-09-13; the markup
 * is unchanged.
 */

import { Icon } from "@/components/Icon";
import styles from "./Cabinet.module.css";
import { RequiredMark } from "./AuthorProfileMedia";
import type { AuthorSectionProps } from "./authorProfileTypes";

export function AuthorSectionAbout({ draft, setDraft, t }: AuthorSectionProps) {
  return (
    <details className={styles.authorSection} open>
      <summary className={styles.authorSectionHead}>
        <div className={styles.authorSectionHeadText}>
          <h3 className={styles.authorSectionTitle}>{t.sectionAbout}</h3>
          <p className={styles.authorSectionNote}>{t.sectionAboutNote}</p>
        </div>
        <Icon className={styles.authorSectionChevron} name="chevron-down" size={20} />
      </summary>
      <div className={styles.authorSectionBody}>
        <label className={styles.authorField}>
          <span>{t.bio}</span>
          <textarea
            className={styles.authorTextarea}
            value={draft.bio}
            rows={4}
            onChange={(e) => setDraft((prev) => ({ ...prev, bio: e.target.value }))}
          />
        </label>
        <label className={styles.authorField}>
          <span>{t.quote}</span>
          <textarea
            className={styles.authorTextarea}
            value={draft.quote}
            rows={2}
            onChange={(e) => setDraft((prev) => ({ ...prev, quote: e.target.value }))}
          />
        </label>
        <div className={styles.authorField}>
          <div className={styles.authorFieldHead}>
            <span>
              {t.facts}
              {draft.listed ? <RequiredMark tooltip={t.requiredForCard} /> : null}
            </span>
            {draft.facts.length < 6 ? (
              <button
                type="button"
                className={styles.authorAddIcon}
                aria-label={t.factAdd}
                title={t.factAdd}
                onClick={() => setDraft((prev) => ({ ...prev, facts: [...prev.facts, ""] }))}
              >
                <Icon name="plus" size={18} />
              </button>
            ) : null}
          </div>
          <p className={styles.authorNotice}>{t.factsHint}</p>
          {draft.facts.map((line, index) => (
            <div className={styles.authorCredentialRow} key={index}>
              <input
                className={styles.authorInput}
                value={line}
                required={index === 0 && draft.listed}
                onChange={(e) =>
                  setDraft((prev) => {
                    const facts = [...prev.facts];
                    facts[index] = e.target.value;
                    return { ...prev, facts };
                  })
                }
              />
              {draft.facts.length > 1 ? (
                <button
                  type="button"
                  className={styles.authorIconAction}
                  aria-label={t.factRemove}
                  title={t.factRemove}
                  onClick={() => setDraft((prev) => ({ ...prev, facts: prev.facts.filter((_, i) => i !== index) }))}
                >
                  <Icon name="close" size={18} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <div className={styles.authorField}>
          <div className={styles.authorFieldHead}>
            <span>
              {t.credentials}
              {draft.listed ? <RequiredMark tooltip={t.credentialRequired} /> : null}
            </span>
            <button
              type="button"
              className={styles.authorAddIcon}
              aria-label={t.credentialAdd}
              title={t.credentialAdd}
              onClick={() => setDraft((prev) => ({ ...prev, credentials: [...prev.credentials, ""] }))}
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
          <p className={styles.authorNotice}>{t.credentialsHint}</p>
          {draft.credentials.map((line, index) => (
            <div className={styles.authorCredentialRow} key={index}>
              <input
                className={styles.authorInput}
                value={line}
                required={index === 0 && draft.listed}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    credentials: prev.credentials.map((v, i) => (i === index ? e.target.value : v)),
                  }))
                }
              />
              {index > 0 ? (
                <button
                  type="button"
                  className={styles.authorIconAction}
                  aria-label={t.credentialRemove}
                  title={t.credentialRemove}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, credentials: prev.credentials.filter((_, i) => i !== index) }))
                  }
                >
                  <Icon name="close" size={18} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {/* A BADGE IS A PHRASE — it prints as one line on a card, and a
            35rem input for «12 років практики» promises a paragraph the
            card has no room for. `--ds-field-md`, the same step the name
            and role take. */}
        <label className={`${styles.authorField} ${styles.authorFieldPhrase}`}>
          <span>
            {t.experienceBadge}
            {draft.listed ? <RequiredMark tooltip={t.requiredForCard} /> : null}
          </span>
          <input
            className={styles.authorInput}
            value={draft.experienceBadge}
            required={draft.listed}
            onChange={(e) => setDraft((prev) => ({ ...prev, experienceBadge: e.target.value }))}
          />
        </label>
      </div>
    </details>
  );
}
