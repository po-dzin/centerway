"use client";

/**
 * «The page» — whether the author is listed, their slug, and the free-form
 * profile blocks under `/expert/[slug]`.
 *
 * Split out of AuthorProfileFold.tsx (1,163 lines) on 2026-09-13; the markup
 * is unchanged.
 */

import { Icon } from "@/components/Icon";
import type { AuthorProfileBlock } from "@/lms-core";
import styles from "./Cabinet.module.css";
import type { AuthorSectionProps } from "./authorProfileTypes";

export function AuthorSectionPage({ draft, setDraft, t }: AuthorSectionProps) {
  return (
    <details className={styles.authorSection} open>
      <summary className={styles.authorSectionHead}>
        <div className={styles.authorSectionHeadText}>
          <h3 className={styles.authorSectionTitle}>{t.sectionPage}</h3>
          <p className={styles.authorSectionNote}>{t.sectionPageNote}</p>
        </div>
        <Icon className={styles.authorSectionChevron} name="chevron-down" size={20} />
      </summary>
      <div className={styles.authorSectionBody}>
        <label className={styles.authorVisibilityRow}>
          <input
            className={styles.authorVisibilityInput}
            type="checkbox"
            checked={draft.listed}
            onChange={(e) => setDraft((prev) => ({ ...prev, listed: e.target.checked }))}
          />
          <span className={styles.authorVisibilityMark} aria-hidden="true">
            <Icon name="check" size={14} />
          </span>
          <span className={styles.authorVisibilityCopy}>
            <strong>{t.listed}</strong>
            <span className={styles.authorVisibilityNote}>{draft.listed ? t.listedOn : t.listedOff}</span>
          </span>
        </label>
        <label className={`${styles.authorField} ${styles.authorFieldPhrase}`}>
          <span>{t.slug}</span>
          <input
            className={styles.authorInput}
            value={draft.slug}
            placeholder="/expert/…"
            onChange={(e) => setDraft((prev) => ({ ...prev, slug: e.target.value }))}
          />
        </label>
        <div className={`${styles.authorField} ${styles.authorProfileBlocksField}`}>
          <span>{t.profileBlocks}</span>
          {draft.profileBlocks.map((block, index) => (
            <fieldset className={styles.authorProfileBlockEditor} key={block.id}>
              <div className={styles.authorProfileBlockHead}>
                {/* A `fieldset` with no `legend` announces as an unnamed
                    group, and every field inside carries the same label as
                    its counterpart in every other block — nothing told a
                    screen reader which block it was in. */}
                <legend className={styles.authorProfileBlockNumber}>
                  {t.blockNumber} {index + 1}
                </legend>
                <button
                  type="button"
                  className={styles.authorIconAction}
                  aria-label={t.profileBlockRemove}
                  title={t.profileBlockRemove}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      profileBlocks: prev.profileBlocks.filter((item) => item.id !== block.id),
                    }))
                  }
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
              <label className={styles.authorField}>
                <span>{t.profileBlockKind}</span>
                <select
                  className={styles.authorInput}
                  value={block.kind}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      profileBlocks: prev.profileBlocks.map((item) =>
                        item.id === block.id
                          ? { ...item, kind: event.target.value as AuthorProfileBlock["kind"] }
                          : item,
                      ),
                    }))
                  }
                >
                  <option value="text">{t.profileBlockText}</option>
                  <option value="list">{t.profileBlockList}</option>
                  <option value="timeline">{t.profileBlockTimeline}</option>
                </select>
              </label>
              <label className={styles.authorField}>
                <span>{t.profileBlockLabel}</span>
                <input
                  className={styles.authorInput}
                  value={block.label ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      profileBlocks: prev.profileBlocks.map((item) =>
                        item.id === block.id ? { ...item, label: event.target.value } : item,
                      ),
                    }))
                  }
                />
              </label>
              <label className={styles.authorField}>
                <span>{t.profileBlockTitle}</span>
                <input
                  className={styles.authorInput}
                  value={block.title}
                  required
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      profileBlocks: prev.profileBlocks.map((item) =>
                        item.id === block.id ? { ...item, title: event.target.value } : item,
                      ),
                    }))
                  }
                />
              </label>
              {block.kind === "text" ? (
                <label className={styles.authorField}>
                  <span>{t.profileBlockBody}</span>
                  <textarea
                    className={styles.authorTextarea}
                    rows={6}
                    value={block.body ?? ""}
                    required
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        profileBlocks: prev.profileBlocks.map((item) =>
                          item.id === block.id ? { ...item, body: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                </label>
              ) : (
                <label className={styles.authorField}>
                  <span>{t.profileBlockItems}</span>
                  <textarea
                    className={styles.authorTextarea}
                    rows={7}
                    value={(block.items ?? []).join("\n")}
                    required
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        profileBlocks: prev.profileBlocks.map((item) =>
                          item.id === block.id ? { ...item, items: event.target.value.split("\n") } : item,
                        ),
                      }))
                    }
                  />
                </label>
              )}
            </fieldset>
          ))}
          {draft.profileBlocks.length < 12 ? (
            <button
              type="button"
              className={styles.authorBlockAdd}
              aria-label={t.profileBlockAdd}
              title={t.profileBlockAdd}
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  profileBlocks: [
                    ...prev.profileBlocks,
                    {
                      id: `section-${crypto.randomUUID()}`,
                      kind: "text",
                      title: "",
                      body: "",
                    },
                  ],
                }))
              }
            >
              <Icon name="plus" size={20} />
              <span>{t.profileBlockAdd}</span>
            </button>
          ) : null}
        </div>
      </div>
    </details>
  );
}
