"use client";

/**
 * The author-profile editor, folded into the cabinet.
 *
 * WHAT THIS WRITES. `lms_authors` — the same row `getCourseAuthor` reads for
 * every course's byline and `getAuthor`/`listListedAuthors` read for the
 * public `/expert/[slug]` page and the `/experts` directory. There is no
 * second copy of a bio anywhere: this is the one place it is written, so a
 * change here is a change everywhere the name appears.
 *
 * WHY IT DOES NOT LIVE IN THE BUILDER. `BuilderCourseSettings` already keeps
 * `authorNote` — the one sentence that changes per course — deliberately
 * apart from the person's bio and photo, which do not. Adding a second editor
 * for the same fields there would mean two forms writing one row, agreeing
 * only until one of them changes shape.
 */

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";

import type { Author } from "@/lms-core";
import type { ProfileLang } from "@/components/platform/profile/types";
import type { AuthorProfileInput } from "./useCabinet";
import styles from "./Cabinet.module.css";
import { matte } from "./CourseCard";

type Draft = {
  name: string;
  role: string;
  bio: string;
  quote: string;
  credentials: string[];
  photo: { src: string; alt: string } | null;
  listed: boolean;
  slug: string;
};

function draftFromAuthor(author: Author | null): Draft {
  return {
    name: author?.name ?? "",
    role: author?.role ?? "",
    bio: author?.bio ?? "",
    quote: author?.quote ?? "",
    credentials: author?.credentials ?? [],
    photo: author?.photo ?? null,
    listed: author?.listed ?? false,
    slug: author?.slug ?? "",
  };
}

const STRINGS = {
  uk: {
    label: "Профіль автора",
    title: "Профіль автора",
    lead: "Ім'я, фото і біографія тут — вони підуть на кожен ваш курс і, якщо публічний, на власну сторінку.",
    name: "Ім'я",
    role: "Роль (один рядок)",
    bio: "Біографія",
    quote: "Цитата від першої особи",
    credentials: "Досягнення",
    credentialAdd: "Додати рядок",
    credentialRemove: "Прибрати",
    photo: "Фото",
    photoUpload: "Завантажити фото",
    photoReplace: "Замінити фото",
    photoUploading: "Завантаження…",
    photoAlt: "Опис фото (для читачів екрана)",
    listed: "Публічна сторінка",
    listedOn: "Сторінку /expert видно всім",
    listedOff: "Сторінка прихована — видно лише в описі курсу",
    slug: "Адреса сторінки",
    save: "Зберегти",
    saving: "Зберігаємо…",
    saved: "Збережено",
    error: "Не вдалося зберегти. Перевірте поля і спробуйте ще раз.",
  },
  en: {
    label: "Author profile",
    title: "Author profile",
    lead: "Name, photo and bio live here — they follow every course you write, and your own page if it's public.",
    name: "Name",
    role: "Role (one line)",
    bio: "Bio",
    quote: "A quote, in your own voice",
    credentials: "Credentials",
    credentialAdd: "Add a line",
    credentialRemove: "Remove",
    photo: "Photo",
    photoUpload: "Upload photo",
    photoReplace: "Replace photo",
    photoUploading: "Uploading…",
    photoAlt: "Photo description (for screen readers)",
    listed: "Public page",
    listedOn: "The /expert page is visible to everyone",
    listedOff: "Hidden — shown only as a course byline",
    slug: "Page address",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    error: "Could not save. Check the fields and try again.",
  },
} as const;

export function AuthorProfileFold({
  session,
  author,
  saving,
  saveError,
  save,
  lang,
}: {
  session: Session;
  author: Author | null;
  saving: boolean;
  saveError: string | null;
  save: (input: AuthorProfileInput) => Promise<boolean>;
  lang: ProfileLang;
}) {
  const t = STRINGS[lang];
  const [draft, setDraft] = useState<Draft>(() => draftFromAuthor(author));
  const [savedOnce, setSavedOnce] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Re-syncs only when the SAVED row changes underneath — not on every render,
  // which would erase whatever the author is mid-typing.
  useEffect(() => {
    setDraft(draftFromAuthor(author));
  }, [author]);

  async function handlePhoto(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/lms/authors/me/photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      if (!res.ok) {
        setUploadError(t.error);
        return;
      }
      const body = (await res.json()) as { src: string };
      setDraft((prev) => ({ ...prev, photo: { src: body.src, alt: prev.photo?.alt ?? prev.name } }));
    } catch {
      setUploadError(t.error);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSavedOnce(false);

    const credentials = draft.credentials.map((line) => line.trim()).filter(Boolean);
    const photo = draft.photo?.src && draft.photo.alt.trim() ? { src: draft.photo.src, alt: draft.photo.alt.trim() } : undefined;

    const ok = await save({
      name: draft.name.trim(),
      role: draft.role.trim() || undefined,
      bio: draft.bio.trim() || undefined,
      quote: draft.quote.trim() || undefined,
      credentials: credentials.length > 0 ? credentials : undefined,
      photo,
      listed: draft.listed,
      slug: draft.slug.trim() || undefined,
    });
    if (ok) setSavedOnce(true);
  }

  return (
    <details className={styles.fold} open>
      <summary className={styles.foldHead}>
        <span className={styles.foldText}>
          <span className={styles.sectionLabel}>{t.label}</span>
          <h2 className={styles.sectionTitle}>{t.title}</h2>
          <span className={styles.sectionLead}>{t.lead}</span>
        </span>
      </summary>
      <div className={styles.foldBody}>
        <form className={styles.authorForm} {...matte} onSubmit={handleSubmit}>
          <label className={styles.authorField}>
            <span>{t.name}</span>
            <input
              className={styles.authorInput}
              value={draft.name}
              required
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <label className={styles.authorField}>
            <span>{t.role}</span>
            <input
              className={styles.authorInput}
              value={draft.role}
              onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
            />
          </label>

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
            <span>{t.credentials}</span>
            {draft.credentials.map((line, index) => (
              <div className={styles.authorCredentialRow} key={index}>
                <input
                  className={styles.authorInput}
                  value={line}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      credentials: prev.credentials.map((v, i) => (i === index ? e.target.value : v)),
                    }))
                  }
                />
                <button
                  type="button"
                  className={styles.actionGhost}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, credentials: prev.credentials.filter((_, i) => i !== index) }))
                  }
                >
                  {t.credentialRemove}
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.authorAddRow}
              onClick={() => setDraft((prev) => ({ ...prev, credentials: [...prev.credentials, ""] }))}
            >
              {t.credentialAdd}
            </button>
          </div>

          {/* THE PICTURE, THEN THE WAY TO CHANGE IT, THEN WHAT IT SHOWS.
              The alt field used to come FIRST, before there was any image to
              describe — a text box asking «опис фото» above an empty slot. It
              only makes sense once something is there, so it appears with the
              photo and not before.

              The native file input is replaced by its own label: `Choose file /
              No file chosen` is the browser's chrome, in the browser's type, on
              a form where everything else is the product's. The input is still
              a real `<input type="file">` — visually hidden, not removed — so
              the keyboard and the file dialog behave exactly as they do. */}
          <div className={styles.authorField}>
            <span>{t.photo}</span>
            <div className={styles.authorPhotoRow}>
              {draft.photo?.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.authorPhotoPreview} src={draft.photo.src} alt="" />
              ) : (
                <span className={styles.authorPhotoEmpty} aria-hidden="true" />
              )}
              <label className={styles.authorFilePick}>
                <input
                  className={styles.visuallyHidden}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handlePhoto(file);
                  }}
                />
                <span className={styles.authorFilePickFace} data-busy={uploading || undefined}>
                  {uploading ? t.photoUploading : draft.photo?.src ? t.photoReplace : t.photoUpload}
                </span>
              </label>
            </div>
            {draft.photo?.src ? (
              <input
                className={styles.authorInput}
                placeholder={t.photoAlt}
                value={draft.photo.alt}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    photo: prev.photo ? { ...prev.photo, alt: e.target.value } : prev.photo,
                  }))
                }
              />
            ) : null}
            {uploadError ? <span className={styles.authorNotice}>{uploadError}</span> : null}
          </div>

          <label className={styles.authorField}>
            <span>{t.slug}</span>
            <input
              className={styles.authorInput}
              value={draft.slug}
              placeholder="/expert/…"
              onChange={(e) => setDraft((prev) => ({ ...prev, slug: e.target.value }))}
            />
          </label>

          {/* A SETTING, SO IT TAKES A SETTING'S SHAPE — its name at the left,
              its state at the right, the same way the account menu's «Вигляд»
              row does. It was a bare checkbox with two lines of text glued to
              it by a `<br>`, which reads as a paragraph someone put a box in
              front of. */}
          <label className={styles.authorVisibilityRow}>
            <span className={styles.authorVisibilityCopy}>
              <strong>{t.listed}</strong>
              <span className={styles.authorVisibilityNote}>{draft.listed ? t.listedOn : t.listedOff}</span>
            </span>
            <input
              type="checkbox"
              checked={draft.listed}
              onChange={(e) => setDraft((prev) => ({ ...prev, listed: e.target.checked }))}
            />
          </label>

          <div className={styles.actions}>
            <button className={styles.actionPrimary} type="submit" disabled={saving || uploading}>
              {saving ? t.saving : t.save}
            </button>
          </div>

          {/* `role="status"` so the outcome is ANNOUNCED. A form whose only
              feedback is a line of grey text appearing below the fold tells a
              screen-reader user nothing at all. */}
          {saveError ? (
            <p className={styles.authorNotice} role="status">
              {t.error}
            </p>
          ) : null}
          {savedOnce && !saveError ? (
            <p className={styles.authorNotice} role="status">
              {t.saved}
            </p>
          ) : null}
        </form>
      </div>
    </details>
  );
}
