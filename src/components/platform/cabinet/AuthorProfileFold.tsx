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

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import type { Author, AuthorProfileBlock } from "@/lms-core";
import type { ProfileLang } from "@/components/platform/profile/types";
import { AUTHOR_AVATAR_CROP_DEFAULT, AUTHOR_CARD_CROP_DEFAULT } from "@/lib/lms/authorPhoto";
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
  photo: NonNullable<Author["photo"]> | null;
  background: { src: string } | null;
  listed: boolean;
  slug: string;
};

type PhotoCropShape = "card" | "avatar";

const PHOTO_CROP_FRAME: Record<PhotoCropShape, { className: "photoCropCard" | "photoCropAvatar" }> = {
  card: { className: "photoCropCard" },
  avatar: { className: "photoCropAvatar" },
};

const clampCrop = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/**
 * One focal point, dragged or nudged with the keyboard — the same interaction
 * the builder's cover editor uses for a course's own crop (`BuilderCoverEditor`).
 * Reimplemented here rather than shared: the two editors format their frames
 * differently (a course chooses among 16:9/21:9/9:16, an author's photo
 * between one card shape and one round avatar) and neither owns the other.
 */
function PhotoCropPreview({
  src,
  alt,
  shape,
  x,
  y,
  onChange,
  reset,
}: {
  src: string;
  alt: string;
  shape: PhotoCropShape;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  reset: { label: string; onReset: () => void };
}) {
  const activePointer = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const frameClass = PHOTO_CROP_FRAME[shape].className;

  const placeFocus = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onChange(
      clampCrop(((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 100),
      clampCrop(((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 100)
    );
  };

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    setDragging(true);
    placeFocus(event);
  };

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    placeFocus(event);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    setDragging(false);
  };

  const moveByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 2;
    if (event.key === "ArrowLeft") onChange(clampCrop(x - step), y);
    else if (event.key === "ArrowRight") onChange(clampCrop(x + step), y);
    else if (event.key === "ArrowUp") onChange(x, clampCrop(y - step));
    else if (event.key === "ArrowDown") onChange(x, clampCrop(y + step));
    else return;
    event.preventDefault();
  };

  return (
    <div className={styles.photoCropStack}>
      <div className={styles.photoCropFrameWrap} data-shape={shape}>
        <div
          className={styles[frameClass]}
          data-dragging={dragging || undefined}
          tabIndex={0}
          aria-label={`Точка фокуса. Перетягуйте або використовуйте стрілки.`}
          onKeyDown={moveByKey}
          onPointerDown={beginDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- the cabinet's own upload, any public host */}
          <img src={src} alt={alt} style={{ objectPosition: `${x}% ${y}%` }} draggable={false} />
          <span className={styles.photoCropHandle} style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true">
            <Icon name="grip" size={20} />
          </span>
        </div>
        {/* Outside the clipped frame, at its own wrapper's corner — a round
            avatar's circular clip eats anything positioned near the frame's
            corner from inside it. `stopPropagation` on pointerdown: without
            it the frame beneath still owns the drag and every reset starts
            by yanking the focal point under the cursor first. */}
        <button
          type="button"
          className={styles.photoCropReset}
          aria-label={reset.label}
          title={reset.label}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={reset.onReset}
        >
          <Icon name="undo" size={20} />
        </button>
      </div>
    </div>
  );
}

/**
 * The photo and the background share one frame: an image once there is one, a
 * clickable dashed slot before there is — dragged onto or picked through the
 * same hidden input — and a corner replace/remove pair once it is filled.
 *
 * Reused rather than written twice: the two fields used to diverge on exactly
 * this, and the background's empty slot was invisible — its span asked for
 * `width: 100%` inside a `width: fit-content` frame, a circular size neither
 * browser resolves to anything but zero. One component means there is only
 * one place this can go wrong again.
 */
function AuthorMediaSlot({
  src,
  previewClassName,
  emptyClassName,
  uploadLabel,
  replaceLabel,
  removeLabel,
  dropLabel,
  uploading,
  onFile,
  onRemove,
}: {
  src: string | undefined;
  previewClassName: string;
  emptyClassName: string;
  uploadLabel: string;
  replaceLabel: string;
  removeLabel: string;
  dropLabel: string;
  uploading: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFile(file);
  };

  return (
    <div
      className={styles.authorMediaFrame}
      data-drag-over={dragOver || undefined}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={previewClassName} src={src} alt="" />
      ) : (
        <label className={emptyClassName} aria-label={uploadLabel}>
          <input
            className={styles.visuallyHidden}
            type="file"
            aria-label={uploadLabel}
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            disabled={uploading}
            onChange={pick}
          />
          <Icon name="import" size={22} />
          <span>{dragOver ? dropLabel : uploadLabel}</span>
        </label>
      )}
      {src ? (
        <div className={styles.authorMediaActions}>
          <label className={styles.authorMediaAction} aria-label={replaceLabel} title={replaceLabel}>
            <input
              className={styles.visuallyHidden}
              type="file"
              aria-label={replaceLabel}
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              disabled={uploading}
              onChange={pick}
            />
            <Icon name="edit" size={18} />
          </label>
          <button type="button" className={styles.authorMediaAction} aria-label={removeLabel} title={removeLabel} onClick={onRemove}>
            <Icon name="close" size={18} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A field that is only sometimes required — the badges are, once the profile
 * is public — marked once, here, rather than as prose in parentheses after
 * every label that needs it. `title` is a real hover tooltip; the visually
 * hidden text is what a screen reader says instead of a bare asterisk.
 */
function RequiredMark({ tooltip }: { tooltip: string }) {
  return (
    <span className={styles.authorRequiredMark} title={tooltip}>
      <span aria-hidden="true">*</span>
      <span className={styles.visuallyHidden}> — {tooltip}</span>
    </span>
  );
}

function draftFromAuthor(author: Author | null): Draft {
  return {
    name: author?.name ?? "",
    role: author?.role ?? "",
    bio: author?.bio ?? "",
    quote: author?.quote ?? "",
    // A blank starting row rather than an empty list — see `AuthorMediaSlot`'s
    // note on the same instinct: a list with nothing to click but "+" reads as
    // broken, not as "add your first one".
    credentials: author?.credentials?.length ? author.credentials : [""],
    facts: author?.facts?.length ? author.facts : [""],
    profileBlocks: author?.profileBlocks ?? [],
    experienceBadge: author?.experienceBadge ?? "",
    achievementBadge: author?.achievementBadge ?? "",
    consultation: {
      enabled: author?.consultation?.enabled ?? false,
      title: author?.consultation?.title ?? "",
      summary: author?.consultation?.summary ?? "",
      points: author?.consultation?.points?.length ? author.consultation.points : [""],
      contactUrl: author?.consultation?.contactUrl ?? "",
    },
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
    facts: "Головні факти про себе",
    factsHint: "До 6 — перші три показуються на картці.",
    factAdd: "Додати факт",
    factRemove: "Прибрати факт",
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
    experienceBadge: "Бейдж досвіду",
    achievementBadge: "Головне досягнення",
    requiredForCard: "Обов’язково для публічної картки",
    consultation: "Консультація",
    consultationEnabled: "Приймаю запити на консультацію",
    consultationTitle: "Назва консультації",
    consultationSummary: "Кому і з чим допомагаю",
    consultationPoints: "Головні пункти",
    consultationPointsHint: "До 3.",
    consultationPointAdd: "Додати пункт",
    consultationPointRemove: "Прибрати пункт",
    consultationContact: "Посилання для домовленості",
    photo: "Фото",
    photoUpload: "Завантажити фото",
    photoReplace: "Замінити фото",
    photoRemove: "Прибрати фото",
    photoUploading: "Завантаження…",
    photoAlt: "Опис фото (для читачів екрана)",
    mediaDrop: "Відпустіть, щоб завантажити",
    photoCropCardTitle: "Картка",
    photoCropCardNote: "Головна · консультації · директорія авторів",
    photoCropAvatarTitle: "Кругла аватарка",
    photoCropAvatarNote: "Сторінка автора · автор курсу",
    photoCropCenter: "По центру",
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
    facts: "Key facts about you",
    factsHint: "Up to 6 — the first three show on the card.",
    factAdd: "Add fact",
    factRemove: "Remove fact",
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
    experienceBadge: "Experience badge",
    achievementBadge: "Key achievement",
    requiredForCard: "Required for the public card",
    consultation: "Consultation",
    consultationEnabled: "Accept consultation requests",
    consultationTitle: "Consultation title",
    consultationSummary: "Who you help and with what",
    consultationPoints: "Key points",
    consultationPointsHint: "Up to 3.",
    consultationPointAdd: "Add point",
    consultationPointRemove: "Remove point",
    consultationContact: "Contact link",
    photo: "Photo",
    photoUpload: "Upload photo",
    photoReplace: "Replace photo",
    photoRemove: "Remove photo",
    photoUploading: "Uploading…",
    photoAlt: "Photo description (for screen readers)",
    mediaDrop: "Drop to upload",
    photoCropCardTitle: "Card",
    photoCropCardNote: "Home · consultations · author directory",
    photoCropAvatarTitle: "Round avatar",
    photoCropAvatarNote: "Author's own page · course byline",
    photoCropCenter: "Centre",
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
  const [uploadTarget, setUploadTarget] = useState<"photo" | "background" | null>(null);
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
    setUploadTarget("photo");
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
    setUploadTarget("background");
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
    const photo = draft.photo?.src && draft.photo.alt.trim()
      ? {
          src: draft.photo.src,
          alt: draft.photo.alt.trim(),
          ...(draft.photo.cropX !== undefined ? { cropX: draft.photo.cropX } : {}),
          ...(draft.photo.cropY !== undefined ? { cropY: draft.photo.cropY } : {}),
          ...(draft.photo.avatarCropX !== undefined ? { avatarCropX: draft.photo.avatarCropX } : {}),
          ...(draft.photo.avatarCropY !== undefined ? { avatarCropY: draft.photo.avatarCropY } : {}),
        }
      : undefined;

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
          {/* THE PICTURE FIRST — an author reaches for it before anything
              else, and it used to sit below the bio, the credentials, the
              facts, every profile block and the consultation settings before
              it ever appeared. It also has to stand alone: on desktop this is
              the only field group that runs down its own column, and a grid
              row is only ever as short as its shortest cell — pairing it with
              a text field left that field waiting on the photo's height
              every time the crop tools grew. */}
          <div className={styles.authorFormMedia}>
            {/* ONE UPLOAD, SHOWN THROUGH ITS OWN TWO FRAMES. A separate full
                preview above the crop cards used to repeat the same photo a
                third time for no reason a crop card doesn't already serve —
                each one already shows the image, in the shape it is actually
                used in, and lets you drag to refocus it. So the plain preview
                only appears before there is anything to crop; once a photo
                lands, the crop cards are the photo. */}
            <div className={`${styles.authorField} ${styles.authorPhotoField}`}>
              <span>{t.photo}</span>
              {draft.photo?.src ? (
                <>
                  <div className={styles.photoCropGrid}>
                    <section className={styles.photoCropPanel} aria-labelledby="author-photo-crop-card-title">
                      <div className={styles.photoCropHead}>
                        <h4 id="author-photo-crop-card-title">{t.photoCropCardTitle}</h4>
                        <p>{t.photoCropCardNote}</p>
                      </div>
                      <PhotoCropPreview
                        src={draft.photo.src}
                        alt=""
                        shape="card"
                        x={draft.photo.cropX ?? AUTHOR_CARD_CROP_DEFAULT.x}
                        y={draft.photo.cropY ?? AUTHOR_CARD_CROP_DEFAULT.y}
                        onChange={(x, y) =>
                          setDraft((prev) => (prev.photo ? { ...prev, photo: { ...prev.photo, cropX: x, cropY: y } } : prev))
                        }
                        reset={{
                          label: t.photoCropCenter,
                          onReset: () =>
                            setDraft((prev) =>
                              prev.photo
                                ? { ...prev, photo: { ...prev.photo, cropX: AUTHOR_CARD_CROP_DEFAULT.x, cropY: AUTHOR_CARD_CROP_DEFAULT.y } }
                                : prev
                            ),
                        }}
                      />
                    </section>
                    <section className={styles.photoCropPanel} aria-labelledby="author-photo-crop-avatar-title">
                      <div className={styles.photoCropHead}>
                        <h4 id="author-photo-crop-avatar-title">{t.photoCropAvatarTitle}</h4>
                        <p>{t.photoCropAvatarNote}</p>
                      </div>
                      <PhotoCropPreview
                        src={draft.photo.src}
                        alt=""
                        shape="avatar"
                        x={draft.photo.avatarCropX ?? AUTHOR_AVATAR_CROP_DEFAULT.x}
                        y={draft.photo.avatarCropY ?? AUTHOR_AVATAR_CROP_DEFAULT.y}
                        onChange={(x, y) =>
                          setDraft((prev) => (prev.photo ? { ...prev, photo: { ...prev.photo, avatarCropX: x, avatarCropY: y } } : prev))
                        }
                        reset={{
                          label: t.photoCropCenter,
                          onReset: () =>
                            setDraft((prev) =>
                              prev.photo
                                ? { ...prev, photo: { ...prev.photo, avatarCropX: AUTHOR_AVATAR_CROP_DEFAULT.x, avatarCropY: AUTHOR_AVATAR_CROP_DEFAULT.y } }
                                : prev
                            ),
                        }}
                      />
                    </section>
                  </div>
                  <div className={styles.authorPhotoToolbar}>
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
                    <label className={styles.authorPhotoToolbarAction} aria-label={t.photoReplace} title={t.photoReplace}>
                      <input
                        className={styles.visuallyHidden}
                        type="file"
                        aria-label={t.photoReplace}
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void handlePhoto(file);
                        }}
                      />
                      <Icon name="edit" size={18} />
                    </label>
                    <button
                      type="button"
                      className={styles.authorPhotoToolbarAction}
                      aria-label={t.photoRemove}
                      title={t.photoRemove}
                      onClick={() => setDraft((prev) => ({ ...prev, photo: null }))}
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <AuthorMediaSlot
                  src={undefined}
                  uploading={uploading}
                  uploadLabel={t.photoUpload}
                  replaceLabel={t.photoReplace}
                  removeLabel={t.photoRemove}
                  dropLabel={t.mediaDrop}
                  previewClassName={styles.authorPhotoPreview}
                  emptyClassName={styles.authorPhotoEmpty}
                  onFile={(file) => void handlePhoto(file)}
                  onRemove={() => setDraft((prev) => ({ ...prev, photo: null }))}
                />
              )}
              {uploadError && uploadTarget === "photo" ? <span className={styles.authorNotice}>{uploadError}</span> : null}
            </div>

            <div className={`${styles.authorField} ${styles.authorBackgroundField}`}>
              <span>{t.background}</span>
              <AuthorMediaSlot
                src={draft.background?.src}
                uploading={uploading}
                uploadLabel={t.backgroundUpload}
                replaceLabel={t.backgroundReplace}
                removeLabel={t.backgroundRemove}
                dropLabel={t.mediaDrop}
                previewClassName={styles.authorBackgroundPreview}
                emptyClassName={styles.authorBackgroundEmpty}
                onFile={(file) => void handleBackground(file)}
                onRemove={() => setDraft((prev) => ({ ...prev, background: null }))}
              />
              {uploadError && uploadTarget === "background" ? <span className={styles.authorNotice}>{uploadError}</span> : null}
            </div>
          </div>

          {/* THE OTHER COLUMN, AS ONE ELEMENT. Both sides have to be single
              grid items for the two to flow independently: a CSS grid row is
              as tall as its tallest cell, so while the text fields were
              direct children of the form, whichever one shared a row with the
              media column still waited on the photo's full height — the gap
              under «Ім'я» that started all this. Two children, two columns,
              no shared rows. */}
          <div className={styles.authorFormText}>
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
              <div className={styles.authorFieldHead}>
                <span>{t.credentials}</span>
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
            </div>

            {/* Six is a recommendation, not a shape the form forces on an author
                who has three good facts and no use for the other three slots —
                the field used to draw all six as empty inputs regardless. One row
                stays (the list a card can print from cannot go to none), the rest
                are added and removed like every other list in this form. */}
            <div className={`${styles.authorField} ${styles.authorFactsField}`}>
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
            <label className={`${styles.authorField} ${styles.authorExperienceField}`}>
              <span>
                {t.experienceBadge}
                {draft.listed ? <RequiredMark tooltip={t.requiredForCard} /> : null}
              </span>
              <input className={styles.authorInput} value={draft.experienceBadge} required={draft.listed} onChange={(e) => setDraft((prev) => ({ ...prev, experienceBadge: e.target.value }))} />
            </label>
            <label className={`${styles.authorField} ${styles.authorAchievementField}`}>
              <span>
                {t.achievementBadge}
                {draft.listed ? <RequiredMark tooltip={t.requiredForCard} /> : null}
              </span>
              <input className={styles.authorInput} value={draft.achievementBadge} required={draft.listed} onChange={(e) => setDraft((prev) => ({ ...prev, achievementBadge: e.target.value }))} />
            </label>
            <fieldset className={`${styles.authorField} ${styles.authorConsultationField}`}>
              <legend>{t.consultation}</legend>
              <label className={styles.authorVisibilityRow}><input className={styles.authorVisibilityInput} type="checkbox" checked={draft.consultation.enabled} onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, enabled: e.target.checked } }))} /><span className={styles.authorVisibilityMark} aria-hidden="true"><Icon name="check" size={14} /></span><span>{t.consultationEnabled}</span></label>
              <input className={styles.authorInput} placeholder={t.consultationTitle} value={draft.consultation.title} onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, title: e.target.value } }))} />
              <textarea className={styles.authorTextarea} rows={3} placeholder={t.consultationSummary} value={draft.consultation.summary} onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, summary: e.target.value } }))} />
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
                          consultation: { ...prev.consultation, points: prev.consultation.points.filter((_, i) => i !== index) },
                        }))
                      }
                    >
                      <Icon name="close" size={18} />
                    </button>
                  ) : null}
                </div>
              ))}
              <input className={styles.authorInput} placeholder={t.consultationContact} value={draft.consultation.contactUrl} onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, contactUrl: e.target.value } }))} />
            </fieldset>


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
          </div>

        </form>
      </div>
    </details>
  );
}
