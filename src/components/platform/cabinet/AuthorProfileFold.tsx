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
import type { Author, AuthorProfileBlock } from "@/lms-core";
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
  facts: string[];
  profileBlocks: AuthorProfileBlock[];
  experienceBadge: string;
  achievementBadge: string;
  consultation: { enabled: boolean; title: string; summary: string; points: string[]; contactUrl: string };
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
    facts: author?.facts ?? [],
    profileBlocks: author?.profileBlocks ?? [],
    experienceBadge: author?.experienceBadge ?? "",
    achievementBadge: author?.achievementBadge ?? "",
    consultation: { enabled: author?.consultation?.enabled ?? false, title: author?.consultation?.title ?? "", summary: author?.consultation?.summary ?? "", points: author?.consultation?.points ?? [], contactUrl: author?.consultation?.contactUrl ?? "" },
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
    facts: "6 головних фактів про себе",
    profileBlocks: "Блоки сторінки автора",
    profileBlockAdd: "Додати блок",
    profileBlockRemove: "Прибрати блок",
    profileBlockKind: "Формат блока",
    profileBlockLabel: "Надзаголовок",
    profileBlockTitle: "Заголовок",
    profileBlockBody: "Текст блока",
    profileBlockItems: "Пункти — кожен з нового рядка",
    profileBlockText: "Текст",
    profileBlockList: "Список",
    profileBlockTimeline: "Шлях / хронологія",
    experienceBadge: "Бейдж досвіду (обов’язково для картки)",
    achievementBadge: "Головне досягнення (обов’язково для картки)",
    consultation: "Консультація",
    consultationEnabled: "Приймаю запити на консультацію",
    consultationTitle: "Назва консультації",
    consultationSummary: "Кому і з чим допомагаю",
    consultationPoints: "3 головні пункти",
    consultationContact: "Посилання для домовленості",
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
    facts: "6 key facts about you",
    profileBlocks: "Author page blocks",
    profileBlockAdd: "Add block",
    profileBlockRemove: "Remove block",
    profileBlockKind: "Block format",
    profileBlockLabel: "Eyebrow",
    profileBlockTitle: "Heading",
    profileBlockBody: "Block text",
    profileBlockItems: "Items — one per line",
    profileBlockText: "Text",
    profileBlockList: "List",
    profileBlockTimeline: "Path / timeline",
    experienceBadge: "Experience badge (required on cards)",
    achievementBadge: "Key achievement (required on cards)",
    consultation: "Consultation",
    consultationEnabled: "Accept consultation requests",
    consultationTitle: "Consultation title",
    consultationSummary: "Who you help and with what",
    consultationPoints: "3 key points",
    consultationContact: "Contact link",
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
  const [open, setOpen] = useState(false);

  // Re-syncs only when the SAVED row changes underneath — not on every render,
  // which would erase whatever the author is mid-typing.
  useEffect(() => {
    setDraft(draftFromAuthor(author));
  }, [author]);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#author") setOpen(true);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

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
      facts: draft.facts.map((line) => line.trim()).filter(Boolean).slice(0, 6),
      profileBlocks: draft.profileBlocks.flatMap((block) => {
        const title = block.title.trim();
        const body = block.body?.trim();
        const items = block.items?.map((line) => line.trim()).filter(Boolean).slice(0, 30);
        if (!title || (!body && !items?.length)) return [];
        return [{
          id: block.id,
          kind: block.kind,
          ...(block.label?.trim() ? { label: block.label.trim() } : {}),
          title,
          ...(body ? { body } : {}),
          ...(items?.length ? { items } : {}),
        }];
      }),
      experienceBadge: draft.experienceBadge.trim() || undefined,
      achievementBadge: draft.achievementBadge.trim() || undefined,
      consultation: {
        enabled: draft.consultation.enabled,
        title: draft.consultation.title.trim() || undefined,
        summary: draft.consultation.summary.trim() || undefined,
        points: draft.consultation.points.map((line) => line.trim()).filter(Boolean).slice(0, 3),
        contactUrl: draft.consultation.contactUrl.trim() || undefined,
      },
      photo,
      background: draft.background?.src ? { src: draft.background.src } : undefined,
      listed: draft.listed,
      slug: draft.slug.trim() || undefined,
    });
    if (ok) toast.success(t.saved);
    else toast.error(t.error);
  }

  return (
    <details id="author" className={styles.fold} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
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

          <div className={`${styles.authorField} ${styles.authorFactsField}`}>
            <span>{t.facts}</span>
            {Array.from({ length: 6 }, (_, index) => (
              <input key={index} className={styles.authorInput} value={draft.facts[index] ?? ""}
                onChange={(e) => setDraft((prev) => { const facts = [...prev.facts]; facts[index] = e.target.value; return { ...prev, facts }; })} />
            ))}
          </div>
          <div className={`${styles.authorField} ${styles.authorProfileBlocksField}`}>
            <span>{t.profileBlocks}</span>
            {draft.profileBlocks.map((block, index) => (
              <fieldset className={styles.authorProfileBlockEditor} key={block.id}>
                <div className={styles.authorProfileBlockHead}>
                  <span>{index + 1}</span>
                  <button
                    type="button"
                    className={styles.authorIconAction}
                    aria-label={t.profileBlockRemove}
                    title={t.profileBlockRemove}
                    onClick={() => setDraft((prev) => ({
                      ...prev,
                      profileBlocks: prev.profileBlocks.filter((item) => item.id !== block.id),
                    }))}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>
                <label className={styles.authorField}>
                  <span>{t.profileBlockKind}</span>
                  <select
                    className={styles.authorInput}
                    value={block.kind}
                    onChange={(event) => setDraft((prev) => ({
                      ...prev,
                      profileBlocks: prev.profileBlocks.map((item) => item.id === block.id
                        ? { ...item, kind: event.target.value as AuthorProfileBlock["kind"] }
                        : item),
                    }))}
                  >
                    <option value="text">{t.profileBlockText}</option>
                    <option value="list">{t.profileBlockList}</option>
                    <option value="timeline">{t.profileBlockTimeline}</option>
                  </select>
                </label>
                <label className={styles.authorField}>
                  <span>{t.profileBlockLabel}</span>
                  <input className={styles.authorInput} value={block.label ?? ""} onChange={(event) => setDraft((prev) => ({
                    ...prev,
                    profileBlocks: prev.profileBlocks.map((item) => item.id === block.id ? { ...item, label: event.target.value } : item),
                  }))} />
                </label>
                <label className={styles.authorField}>
                  <span>{t.profileBlockTitle}</span>
                  <input className={styles.authorInput} value={block.title} required onChange={(event) => setDraft((prev) => ({
                    ...prev,
                    profileBlocks: prev.profileBlocks.map((item) => item.id === block.id ? { ...item, title: event.target.value } : item),
                  }))} />
                </label>
                {block.kind === "text" ? (
                  <label className={styles.authorField}>
                    <span>{t.profileBlockBody}</span>
                    <textarea className={styles.authorTextarea} rows={6} value={block.body ?? ""} required onChange={(event) => setDraft((prev) => ({
                      ...prev,
                      profileBlocks: prev.profileBlocks.map((item) => item.id === block.id ? { ...item, body: event.target.value } : item),
                    }))} />
                  </label>
                ) : (
                  <label className={styles.authorField}>
                    <span>{t.profileBlockItems}</span>
                    <textarea className={styles.authorTextarea} rows={7} value={(block.items ?? []).join("\n")} required onChange={(event) => setDraft((prev) => ({
                      ...prev,
                      profileBlocks: prev.profileBlocks.map((item) => item.id === block.id ? { ...item, items: event.target.value.split("\n") } : item),
                    }))} />
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
                onClick={() => setDraft((prev) => ({
                  ...prev,
                  profileBlocks: [...prev.profileBlocks, {
                    id: `section-${Date.now()}`,
                    kind: "text",
                    title: "",
                    body: "",
                  }],
                }))}
              >
                <Icon name="plus" size={20} />
                <span>{t.profileBlockAdd}</span>
              </button>
            ) : null}
          </div>
          <label className={`${styles.authorField} ${styles.authorExperienceField}`}><span>{t.experienceBadge}</span><input className={styles.authorInput} value={draft.experienceBadge} required={draft.listed} onChange={(e) => setDraft((prev) => ({ ...prev, experienceBadge: e.target.value }))} /></label>
          <label className={`${styles.authorField} ${styles.authorAchievementField}`}><span>{t.achievementBadge}</span><input className={styles.authorInput} value={draft.achievementBadge} required={draft.listed} onChange={(e) => setDraft((prev) => ({ ...prev, achievementBadge: e.target.value }))} /></label>
          <fieldset className={`${styles.authorField} ${styles.authorConsultationField}`}>
            <legend>{t.consultation}</legend>
            <label className={styles.authorVisibilityRow}><input className={styles.authorVisibilityInput} type="checkbox" checked={draft.consultation.enabled} onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, enabled: e.target.checked } }))} /><span className={styles.authorVisibilityMark} aria-hidden="true"><Icon name="check" size={14} /></span><span>{t.consultationEnabled}</span></label>
            <input className={styles.authorInput} placeholder={t.consultationTitle} value={draft.consultation.title} onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, title: e.target.value } }))} />
            <textarea className={styles.authorTextarea} rows={3} placeholder={t.consultationSummary} value={draft.consultation.summary} onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, summary: e.target.value } }))} />
            <span>{t.consultationPoints}</span>
            {Array.from({ length: 3 }, (_, index) => <input key={index} className={styles.authorInput} value={draft.consultation.points[index] ?? ""} onChange={(e) => setDraft((prev) => { const points = [...prev.consultation.points]; points[index] = e.target.value; return { ...prev, consultation: { ...prev.consultation, points } }; })} />)}
            <input className={styles.authorInput} placeholder={t.consultationContact} value={draft.consultation.contactUrl} onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, contactUrl: e.target.value } }))} />
          </fieldset>

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
