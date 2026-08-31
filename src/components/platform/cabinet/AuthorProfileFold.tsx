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
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
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
  background: { src: string } | null;
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
    background: author?.background ?? null,
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
    credentialAdd: "Додати досягнення",
    credentialRemove: "Прибрати досягнення",
    photo: "Фото",
    photoUpload: "Завантажити фото",
    photoReplace: "Замінити фото",
    photoRemove: "Прибрати фото",
    photoUploading: "Завантаження…",
    photoAlt: "Опис фото (для читачів екрана)",
    background: "Фон публічної сторінки",
    backgroundUpload: "Завантажити фон",
    backgroundReplace: "Замінити фон",
    backgroundRemove: "Прибрати фон",
    listed: "Публічна сторінка",
    listedOn: "Сторінку /expert видно всім",
    listedOff: "Сторінка прихована — видно лише в описі курсу",
    slug: "Адреса сторінки",
    save: "Зберегти",
    saving: "Зберігаємо…",
    saved: "Збережено",
    viewPublic: "Відкрити",
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
    credentialAdd: "Add credential",
    credentialRemove: "Remove credential",
    photo: "Photo",
    photoUpload: "Upload photo",
    photoReplace: "Replace photo",
    photoRemove: "Remove photo",
    photoUploading: "Uploading…",
    photoAlt: "Photo description (for screen readers)",
    background: "Public page background",
    backgroundUpload: "Upload background",
    backgroundReplace: "Replace background",
    backgroundRemove: "Remove background",
    listed: "Public page",
    listedOn: "The /expert page is visible to everyone",
    listedOff: "Hidden — shown only as a course byline",
    slug: "Page address",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    viewPublic: "Preview",
    error: "Could not save. Check the fields and try again.",
  },
} as const;

export function AuthorProfileFold({
  session,
  author,
  saving,
  save,
  lang,
}: {
  session: Session;
  author: Author | null;
  saving: boolean;
  save: (input: AuthorProfileInput) => Promise<boolean>;
  lang: ProfileLang;
}) {
  const t = STRINGS[lang];
  const [draft, setDraft] = useState<Draft>(() => draftFromAuthor(author));
  const toast = useToast();
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

  async function handleBackground(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/lms/authors/me/background", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      if (!res.ok) {
        setUploadError(t.error);
        return;
      }
      const body = (await res.json()) as { src: string };
      setDraft((prev) => ({ ...prev, background: { src: body.src } }));
    } catch {
      setUploadError(t.error);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const credentials = draft.credentials.map((line) => line.trim()).filter(Boolean);
    const photo = draft.photo?.src && draft.photo.alt.trim() ? { src: draft.photo.src, alt: draft.photo.alt.trim() } : undefined;

    const ok = await save({
      name: draft.name.trim(),
      role: draft.role.trim() || undefined,
      bio: draft.bio.trim() || undefined,
      quote: draft.quote.trim() || undefined,
      credentials: credentials.length > 0 ? credentials : undefined,
      photo,
      background: draft.background?.src ? { src: draft.background.src } : undefined,
      listed: draft.listed,
      slug: draft.slug.trim() || undefined,
    });
    if (ok) toast.success(t.saved);
    else toast.error(t.error);
  }

  return (
    <details className={styles.fold}>
      <summary className={styles.foldHead}>
        <span className={styles.foldText}>
          <span className={styles.sectionLabel}>{t.label}</span>
          <h2 className={styles.sectionTitle}>{t.title}</h2>
          <span className={styles.sectionLead}>{t.lead}</span>
        </span>
        <Icon className={styles.foldChevron} name="chevron-down" size={20} />
      </summary>
      <div className={styles.foldBody}>
        <form className={styles.authorForm} {...matte} onSubmit={handleSubmit}>
          <label className={`${styles.authorField} ${styles.authorNameField}`}>
            <span>{t.name}</span>
            <input
              className={styles.authorInput}
              value={draft.name}
              required
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <label className={`${styles.authorField} ${styles.authorRoleField}`}>
            <span>{t.role}</span>
            <input
              className={styles.authorInput}
              value={draft.role}
              onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
            />
          </label>

          <label className={`${styles.authorField} ${styles.authorBioField}`}>
            <span>{t.bio}</span>
            <textarea
              className={styles.authorTextarea}
              value={draft.bio}
              rows={4}
              onChange={(e) => setDraft((prev) => ({ ...prev, bio: e.target.value }))}
            />
          </label>

          <label className={`${styles.authorField} ${styles.authorQuoteField}`}>
            <span>{t.quote}</span>
            <textarea
              className={styles.authorTextarea}
              value={draft.quote}
              rows={2}
              onChange={(e) => setDraft((prev) => ({ ...prev, quote: e.target.value }))}
            />
          </label>

          <div className={`${styles.authorField} ${styles.authorCredentialsField}`}>
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
                  className={styles.authorIconAction}
                  aria-label={t.credentialRemove}
                  title={t.credentialRemove}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, credentials: prev.credentials.filter((_, i) => i !== index) }))
                  }
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.authorAddRow}
              aria-label={t.credentialAdd}
              title={t.credentialAdd}
              onClick={() => setDraft((prev) => ({ ...prev, credentials: [...prev.credentials, ""] }))}
            >
              <Icon name="plus" size={20} />
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
          <div className={`${styles.authorField} ${styles.authorPhotoField}`}>
            <span>{t.photo}</span>
            <div className={styles.authorMediaFrame}>
              {draft.photo?.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.authorPhotoPreview} src={draft.photo.src} alt="" />
              ) : (
                <span className={styles.authorPhotoEmpty} aria-hidden="true" />
              )}
              <div className={styles.authorMediaActions}>
              <label className={styles.authorMediaAction} aria-label={draft.photo?.src ? t.photoReplace : t.photoUpload} title={draft.photo?.src ? t.photoReplace : t.photoUpload}>
                <input
                  className={styles.visuallyHidden}
                  type="file"
                  aria-label={draft.photo?.src ? t.photoReplace : t.photoUpload}
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handlePhoto(file);
                  }}
                />
                <Icon name="edit" size={18} />
              </label>
              {draft.photo ? (
                <button type="button" className={styles.authorMediaAction} aria-label={t.photoRemove} title={t.photoRemove} onClick={() => setDraft((prev) => ({ ...prev, photo: null }))}>
                  <Icon name="close" size={18} />
                </button>
              ) : null}
              </div>
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

          <div className={`${styles.authorField} ${styles.authorBackgroundField}`}>
            <span>{t.background}</span>
            <div className={styles.authorMediaFrame}>
              {draft.background?.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.authorBackgroundPreview} src={draft.background.src} alt="" />
              ) : (
                <span className={styles.authorBackgroundEmpty} aria-hidden="true" />
              )}
              <div className={styles.authorMediaActions}>
              <label className={styles.authorMediaAction} aria-label={draft.background?.src ? t.backgroundReplace : t.backgroundUpload} title={draft.background?.src ? t.backgroundReplace : t.backgroundUpload}>
                <input
                  className={styles.visuallyHidden}
                  type="file"
                  aria-label={draft.background?.src ? t.backgroundReplace : t.backgroundUpload}
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleBackground(file);
                  }}
                />
                <Icon name="edit" size={18} />
              </label>
              {draft.background ? (
                <button type="button" className={styles.authorMediaAction} aria-label={t.backgroundRemove} title={t.backgroundRemove} onClick={() => setDraft((prev) => ({ ...prev, background: null }))}>
                  <Icon name="close" size={18} />
                </button>
              ) : null}
              </div>
            </div>
          </div>

          <label className={`${styles.authorField} ${styles.authorSlugField}`}>
            <span>{t.slug}</span>
            <input
              className={styles.authorInput}
              value={draft.slug}
              placeholder="/expert/…"
              onChange={(e) => setDraft((prev) => ({ ...prev, slug: e.target.value }))}
            />
          </label>

          {/* A system checkbox sits before the setting it controls. The copy is
              one readable unit, not a paragraph with a detached box. */}
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

          <div className={`${styles.actions} ${styles.authorFormActions}`}>
            <button className={styles.actionPrimary} type="submit" disabled={saving || uploading}>
              {saving ? t.saving : t.save}
            </button>
            {author?.listed && author.slug ? (
              <Link className={styles.actionGhost} href={`/expert/${author.slug}`} target="_blank" rel="noopener noreferrer">
                <span>{t.viewPublic}</span>
                <Icon name="arrow-right" size={18} />
              </Link>
            ) : null}
          </div>

        </form>
      </div>
    </details>
  );
}
