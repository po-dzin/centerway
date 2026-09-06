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

import { useEffect, useId, useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import type { Author, AuthorProfileBlock } from "@/lms-core";
import type { ProfileLang } from "@/components/platform/profile/types";
import { AUTHOR_AVATAR_CROP_DEFAULT, AUTHOR_BANNER_CROP_DEFAULT, AUTHOR_CARD_CROP_DEFAULT } from "@/lib/lms/authorPhoto";
import { CropEditor } from "@/components/media/CropEditor";
import { CROP_SCALE_MIN, cropStyle } from "@/lib/media/imageCrop";
import { shrinkForUpload } from "@/lib/media/shrinkForUpload";
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
  consultation: { enabled: boolean; title: string; summary: string; points: string[]; contactUrl: string };
  photo: NonNullable<Author["photo"]> | null;
  background: NonNullable<Author["background"]> | null;
  listed: boolean;
  slug: string;
};

type PhotoCropShape = "card" | "avatar" | "banner";

const PHOTO_CROP_FRAME: Record<PhotoCropShape, { className: "photoCropCard" | "photoCropAvatar" | "photoCropBanner" }> = {
  card: { className: "photoCropCard" },
  avatar: { className: "photoCropAvatar" },
  /* The backdrop band on the author's own page — a 6:1 letterbox, which is why
     it needs aiming more than either of the other two: a portrait handed to it
     loses about five sixths of its height to `cover`. */
  banner: { className: "photoCropBanner" },
};

/**
 * HEIC AND HEIF ARE ON THE LIST NOW, and the upload route still does not take
 * them. That is not a contradiction: an iPhone left on "keep originals" hands
 * over `image/heic`, `shrinkForUpload` re-encodes anything the browser can
 * decode into JPEG, and JPEG is what the route sees. Leaving them off the list
 * did not protect anything — it made the picker grey out the photograph the
 * author was pointing at.
 */
const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif";

/**
 * THE RESTING FRAME — the picture as the page will print it, and the way in.
 *
 * It used to be the editor too: you dragged the photograph inside this box and
 * a slider under it magnified. That made the one place an author chooses a crop
 * the one place they could not see what the crop discards, and at scale 1 the
 * `cover` fit is flush on one axis, so half the drags moved nothing at all.
 *
 * So it stopped editing and went back to being what it is best at: the exact
 * frame `/expert/[slug]` and `AuthorCard` draw, in the composition they draw it
 * in, so this fold still reads as a preview of the page it writes. Pressing it
 * opens `CropEditor`, which shows the whole photograph with this frame over it.
 * The frame hands its own `aspect-ratio` and `border-radius` to that editor, so
 * the shape stays declared once — in CSS — for both.
 */
function PhotoCropPreview({
  src,
  alt,
  shape,
  x,
  y,
  scale,
  label,
  busy,
  onOpen,
}: {
  src: string;
  alt: string;
  shape: PhotoCropShape;
  x: number;
  y: number;
  /** 1–4, the frame's magnification about its own focus point. */
  scale: number;
  label: string;
  /** An upload is in flight for THIS frame's image. */
  busy?: boolean;
  onOpen: (frame: HTMLElement) => void;
}) {
  const frameClass = PHOTO_CROP_FRAME[shape].className;
  return (
    <button
      type="button"
      className={styles[frameClass]}
      /* ON THE PICTURE, BECAUSE THAT IS WHERE THE EYE IS. The only sign an
         upload was running used to be a line of text below the crop grid and
         the alt field — on a phone, a screen and a half under the thumb that
         just picked the file. */
      data-busy={busy || undefined}
      disabled={busy}
      aria-label={label}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the cabinet's own upload, any public host */}
      <img src={src} alt={alt} style={cropStyle({ x, y, scale }, { x: 50, y: 50 })} draggable={false} />
      {/* The affordance, in the one corner the replace/remove pair never takes.
          A frame that opens an editor has to say so: without a mark it is a
          photograph, and photographs are not usually buttons. */}
      <span className={styles.photoCropOpen} aria-hidden="true">
        <Icon name="edit" size={15} />
      </span>
    </button>
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
            accept={PHOTO_ACCEPT}
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
              accept={PHOTO_ACCEPT}
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
  const id = useId();
  /* A NAME PER MARK. `anchor-name` written once in the stylesheet gives every
     mark on the page the SAME name, and a popover then anchors to the last
     element carrying it — measured 227px away, beside a different field.
     The name has to be per instance, so it comes from `useId` here; the
     stylesheet keeps the geometry. */
  const anchor = `--cw-required-${id.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <>
      <button
        type="button"
        className={styles.authorRequiredMark}
        style={{ anchorName: anchor } as CSSProperties}
        popoverTarget={id}
        aria-label={tooltip}
      >
        *
      </button>
      <span
        className={styles.authorRequiredHint}
        style={{ positionAnchor: anchor } as CSSProperties}
        popover="auto"
        id={id}
      >
        {tooltip}
      </span>
    </>
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
    /* ONE FIELD, NOT TWO. «Головне досягнення» was a separate input that the
       card printed as a badge while this list printed underneath it — two
       places to say the same kind of thing, and the badge was the one that
       blocked publishing. The list's first row is the badge now. An existing
       profile filled both, so the stored badge is seeded as row one: without
       that, the first save after this change would overwrite it with whatever
       happened to be first in the list. */
    credentials: (() => {
      const stored = author?.credentials ?? [];
      const badge = author?.achievementBadge?.trim();
      const rest = stored.filter((line) => line.trim() !== badge);
      const rows = badge ? [badge, ...rest] : stored;
      return rows.length ? rows : [""];
    })(),
    facts: author?.facts?.length ? author.facts : [""],
    profileBlocks: author?.profileBlocks ?? [],
    experienceBadge: author?.experienceBadge ?? "",
    consultation: {
      enabled: author?.consultation?.enabled ?? false,
      title: author?.consultation?.title ?? "",
      summary: author?.consultation?.summary ?? "",
      points: author?.consultation?.points?.length ? author.consultation.points : [""],
      contactUrl: author?.consultation?.contactUrl ?? "",
    },
    /* THE DRAFT OPENS ON WHAT IS STORED, AND SEEDS NOTHING. A zoom was briefly
       seeded here so both axes had room to drag; it meant opening the cabinet
       and pressing save re-cropped every photograph already published by 15% of
       its edge. The editor shows the whole picture now, so a flush axis is
       visible rather than felt as a dead gesture, and this stays a copy. */
    photo: author?.photo ? { ...author.photo } : null,
    background: author?.background
      ? { ...author.background }
      : null,
    listed: author?.listed ?? false,
    slug: author?.slug ?? "",
  };
}

/**
 * THE DRAFT AS AN `Author` — one normalisation, in one place.
 *
 * WHY IT IS ONE FUNCTION. The trimming, the slicing and the "row one of the
 * credentials is the badge" rule used to live inside `handleSubmit`, which then
 * listed the fields of its payload by hand — and a hand-written list is how
 * both crop scales came to be edited, drawn on screen and then silently dropped
 * on save (2026-09-06). The draft becomes the platform's own `Author` here, so
 * a field that exists on the type reaches the row without anyone remembering to
 * add a line.
 *
 * `base` carries the identifiers a draft has no opinion about — the row's id
 * and the slug the server assigned.
 */
function authorFromDraft(draft: Draft, base: Author | null): Author {
  const credentialLines = draft.credentials.map((line) => line.trim()).filter(Boolean);
  /* Row one is the badge, the remainder is the list — sending row one in both
     would print the same sentence twice on `/expert`, once in the hero badge
     row and once in the starred list under it. */
  const [achievementBadge, ...credentials] = credentialLines;
  const alt = draft.photo?.alt.trim();
  const photo = draft.photo?.src && alt
    ? {
        src: draft.photo.src,
        alt,
        ...(draft.photo.cropX !== undefined ? { cropX: draft.photo.cropX } : {}),
        ...(draft.photo.cropY !== undefined ? { cropY: draft.photo.cropY } : {}),
        ...(draft.photo.avatarCropX !== undefined ? { avatarCropX: draft.photo.avatarCropX } : {}),
        ...(draft.photo.avatarCropY !== undefined ? { avatarCropY: draft.photo.avatarCropY } : {}),
        /* `> CROP_SCALE_MIN`, not `!== undefined` — absent means "no zoom"
           everywhere else in the crop model (src/lib/media/imageCrop.ts), and
           writing a literal 1 would freeze today's default into the row. */
        ...(draft.photo.cropScale !== undefined && draft.photo.cropScale > CROP_SCALE_MIN
          ? { cropScale: draft.photo.cropScale }
          : {}),
        ...(draft.photo.avatarCropScale !== undefined && draft.photo.avatarCropScale > CROP_SCALE_MIN
          ? { avatarCropScale: draft.photo.avatarCropScale }
          : {}),
      }
    : undefined;

  const background = draft.background?.src
    ? {
        src: draft.background.src,
        ...(draft.background.cropX !== undefined ? { cropX: draft.background.cropX } : {}),
        ...(draft.background.cropY !== undefined ? { cropY: draft.background.cropY } : {}),
        ...(draft.background.cropScale !== undefined && draft.background.cropScale > CROP_SCALE_MIN
          ? { cropScale: draft.background.cropScale }
          : {}),
      }
    : undefined;

  return {
    id: base?.id ?? "draft",
    slug: draft.slug.trim() || base?.slug || "",
    name: draft.name.trim(),
    ...(draft.role.trim() ? { role: draft.role.trim() } : {}),
    ...(draft.bio.trim() ? { bio: draft.bio.trim() } : {}),
    ...(draft.quote.trim() ? { quote: draft.quote.trim() } : {}),
    ...(credentials.length > 0 ? { credentials } : {}),
    facts: draft.facts.map((line) => line.trim()).filter(Boolean).slice(0, 6),
    /* A block with a title and nothing under it is not a block — the page
       would draw a heading over an empty panel. */
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
    ...(draft.experienceBadge.trim() ? { experienceBadge: draft.experienceBadge.trim() } : {}),
    ...(achievementBadge ? { achievementBadge } : {}),
    consultation: {
      enabled: draft.consultation.enabled,
      ...(draft.consultation.title.trim() ? { title: draft.consultation.title.trim() } : {}),
      ...(draft.consultation.summary.trim() ? { summary: draft.consultation.summary.trim() } : {}),
      points: draft.consultation.points.map((line) => line.trim()).filter(Boolean).slice(0, 3),
      ...(draft.consultation.contactUrl.trim() ? { contactUrl: draft.consultation.contactUrl.trim() } : {}),
    },
    ...(photo ? { photo } : {}),
    /* NORMALISED THE SAME WAY THE PHOTO IS, and it was not: this passed the
       draft object through raw, so the band wrote `cropScale: 1` into the row —
       the literal default the photo branch above exists to keep out. One frame
       storing "no zoom" as absence and the other as 1 is two answers to one
       question, and the reader of the row cannot tell which means what. */
    ...(background ? { background } : {}),
    listed: draft.listed,
  };
}

const STRINGS = {
  uk: {
    title: "Профіль автора",
    lead: "Ім'я, фото і біографія тут — вони підуть на кожен ваш курс і, якщо публічний, на власну сторінку.",
    name: "Ім'я",
    role: "Роль (один рядок)",
    bio: "Біографія",
    quote: "Цитата від першої особи",
    credentials: "Досягнення",
    credentialAdd: "Додати досягнення",
    credentialRemove: "Прибрати досягнення",
    credentialRequired: "Перший рядок потрібен, щоб сторінку було видно",
    credentialsHint: "Перше — головне: саме воно стоїть бейджем на картці.",
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
    requiredForCard: "Обов’язково для публічної картки",
    consultation: "Консультація",
    consultationEnabled: "Приймаю запити на консультацію",
    consultationPoints: "Головні пункти",
    consultationPointsHint: "До 3.",
    consultationPointAdd: "Додати пункт",
    consultationPointRemove: "Прибрати пункт",
    photo: "Фото",
    photoUpload: "Завантажити фото",
    photoReplace: "Замінити фото",
    photoRemove: "Прибрати фото",
    photoUploading: "Завантаження…",
    /* ONE MESSAGE PER REASON. The upload used to answer every failure with the
       form's generic «Не вдалося зберегти» — which on a phone, where the file
       is large and the connection is not, read as "it silently did nothing".
       The route already distinguishes these; the form now repeats it. */
    uploadTooLarge: "Файл завеликий — до 20 МБ.",
    uploadBadType: "Такий формат не підтримується. JPEG, PNG, WebP, AVIF або GIF.",
    uploadTooOften: "Забагато завантажень поспіль. Спробуйте за хвилину.",
    uploadFailed: "Не вдалося завантажити фото. Спробуйте ще раз.",
    sectionYou: "Ви",
    sectionYouNote: "Фото, ім'я і роль — друкуються під кожним вашим курсом, навіть поки сторінка прихована.",
    sectionAbout: "Про себе",
    sectionAboutNote: "Текст і факти. Перші три факти та бейджі показуються на картці автора.",
    sectionPage: "Ваша сторінка",
    sectionPageNote: "Чи є вона, за якою адресою, і з чого складається.",
    photoAltRequired: "Без опису фото не збережеться",
    consultationTitleLabel: "Назва консультації",
    consultationSummaryLabel: "Кому і з чим допомагаю",
    consultationContactLabel: "Посилання для домовленості",
    consultationRequired: "Потрібно, поки консультації увімкнено",
    /* The stage, not the frame: what the hand moves here is the window over the
       whole photograph, and telling someone to drag the photo would be telling
       them to drag the one thing on this screen that stays still. */
    cropFocus: "Ціла світлина. Перетягуйте рамку або використовуйте стрілки. Ctrl і колесо — масштаб.",
    cropOpen: "Обрати кадр",
    cropDone: "Готово",
    cropZoom: "Масштаб",
    cropFocusAt: "Фокус: {x}% по горизонталі, {y}% по вертикалі",
    nameRequired: "Ім'я потрібне завжди — воно стоїть під кожним курсом",
    blockNumber: "Блок",
    photoAlt: "Опис фото (для читачів екрана)",
    mediaDrop: "Відпустіть, щоб завантажити",
    photoCropCardTitle: "Картка",
    photoCropCardNote: "Головна · консультації · директорія авторів",
    /* Named by its job, not by its shape (2026-09-06): portraits left the
       circle, and a caption that says «кругла» over a soft-rect preview teaches
       the author a shape the product no longer draws. */
    photoCropAvatarTitle: "Аватарка",
    photoCropAvatarNote: "Сторінка автора · автор курсу",
    photoCropCenter: "По центру",
    background: "Фон публічної сторінки",
    backgroundHint: "Друкується тільки на вашій сторінці, під портретом.",
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
    title: "Author profile",
    lead: "Name, photo and bio live here — they follow every course you write, and your own page if it's public.",
    name: "Name",
    role: "Role (one line)",
    bio: "Bio",
    quote: "A quote, in your own voice",
    credentials: "Credentials",
    credentialAdd: "Add credential",
    credentialRemove: "Remove credential",
    credentialRequired: "The first line is needed for the page to be visible",
    credentialsHint: "The first one is the main one — it stands as the badge on your card.",
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
    requiredForCard: "Required for the public card",
    consultation: "Consultation",
    consultationEnabled: "Accept consultation requests",
    consultationPoints: "Key points",
    consultationPointsHint: "Up to 3.",
    consultationPointAdd: "Add point",
    consultationPointRemove: "Remove point",
    photo: "Photo",
    photoUpload: "Upload photo",
    photoReplace: "Replace photo",
    photoRemove: "Remove photo",
    photoUploading: "Uploading…",
    uploadTooLarge: "File is too large — 20 MB maximum.",
    uploadBadType: "That format is not supported. JPEG, PNG, WebP, AVIF or GIF.",
    uploadTooOften: "Too many uploads in a row. Try again in a minute.",
    uploadFailed: "Could not upload the photo. Try again.",
    sectionYou: "You",
    sectionYouNote: "Photo, name and role — printed under every course you write, even while your page is hidden.",
    sectionAbout: "About you",
    sectionAboutNote: "The text and the facts. The first three facts and both badges show on your card.",
    sectionPage: "Your page",
    sectionPageNote: "Whether it exists, at what address, and what it is made of.",
    photoAltRequired: "Without a description the photo is not saved",
    consultationTitleLabel: "Consultation title",
    consultationSummaryLabel: "Who you help, and with what",
    consultationContactLabel: "Link for arranging it",
    consultationRequired: "Needed while consultations are on",
    cropFocus: "The whole photograph. Drag the frame, or use the arrow keys. Ctrl and the wheel zoom.",
    cropOpen: "Choose the frame",
    cropDone: "Done",
    cropZoom: "Zoom",
    cropFocusAt: "Focus: {x}% across, {y}% down",
    nameRequired: "Always needed — it prints under every course",
    blockNumber: "Block",
    photoAlt: "Photo description (for screen readers)",
    mediaDrop: "Drop to upload",
    photoCropCardTitle: "Card",
    photoCropCardNote: "Home · consultations · author directory",
    photoCropAvatarTitle: "Avatar",
    photoCropAvatarNote: "Author's own page · course byline",
    photoCropCenter: "Centre",
    background: "Public page background",
    backgroundHint: "Prints on your own page only, behind the portrait.",
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
  const cropPosition = (x: number, y: number) =>
    t.cropFocusAt.replace("{x}", String(Math.round(x))).replace("{y}", String(Math.round(y)));
  const [draft, setDraft] = useState<Draft>(() => draftFromAuthor(author));
  /* WHICH FRAME IS BEING AIMED, and in what shape. The shape is snapshotted off
     the frame that opened the editor — its computed `aspect-ratio` and
     `border-radius` — so the window laid over the whole photograph is literally
     the frame the page will draw, and no ratio is retyped in TypeScript. */
  const [cropping, setCropping] = useState<{ shape: PhotoCropShape; ratio: string; radius: string } | null>(null);
  const openCrop = (shape: PhotoCropShape) => (frame: HTMLElement) => {
    const box = getComputedStyle(frame);
    setCropping({ shape, ratio: box.aspectRatio, radius: box.borderRadius });
  };

  /* THE ONE FRAME UNDER THE EDITOR, resolved from the draft: where it reads,
     where it writes, what to call it, and what "centre it again" means for that
     particular shape. Written out here rather than inside the dialog, because
     the dialog has no business knowing that a card and a round avatar keep two
     focal points on one photograph while the band keeps its own picture. */
  const cropTarget = (() => {
    if (!cropping) return null;
    const patchPhoto = (patch: Partial<NonNullable<Draft["photo"]>>) =>
      setDraft((prev) => (prev.photo ? { ...prev, photo: { ...prev.photo, ...patch } } : prev));
    const patchBackground = (patch: Partial<NonNullable<Draft["background"]>>) =>
      setDraft((prev) => (prev.background ? { ...prev, background: { ...prev.background, ...patch } } : prev));

    if (cropping.shape === "banner") {
      const background = draft.background;
      if (!background?.src) return null;
      return {
        ...cropping,
        src: background.src,
        title: t.background,
        note: t.backgroundHint,
        x: background.cropX ?? AUTHOR_BANNER_CROP_DEFAULT.x,
        y: background.cropY ?? AUTHOR_BANNER_CROP_DEFAULT.y,
        scale: background.cropScale ?? CROP_SCALE_MIN,
        onChange: (x: number, y: number) => patchBackground({ cropX: x, cropY: y }),
        onScaleChange: (scale: number) => patchBackground({ cropScale: scale }),
        onReset: () =>
          patchBackground({
            cropX: AUTHOR_BANNER_CROP_DEFAULT.x,
            cropY: AUTHOR_BANNER_CROP_DEFAULT.y,
            cropScale: CROP_SCALE_MIN,
          }),
      };
    }

    const photo = draft.photo;
    if (!photo?.src) return null;
    if (cropping.shape === "avatar") {
      return {
        ...cropping,
        src: photo.src,
        title: t.photoCropAvatarTitle,
        note: t.photoCropAvatarNote,
        x: photo.avatarCropX ?? AUTHOR_AVATAR_CROP_DEFAULT.x,
        y: photo.avatarCropY ?? AUTHOR_AVATAR_CROP_DEFAULT.y,
        scale: photo.avatarCropScale ?? CROP_SCALE_MIN,
        onChange: (x: number, y: number) => patchPhoto({ avatarCropX: x, avatarCropY: y }),
        onScaleChange: (scale: number) => patchPhoto({ avatarCropScale: scale }),
        onReset: () =>
          patchPhoto({
            avatarCropX: AUTHOR_AVATAR_CROP_DEFAULT.x,
            avatarCropY: AUTHOR_AVATAR_CROP_DEFAULT.y,
            avatarCropScale: CROP_SCALE_MIN,
          }),
      };
    }
    return {
      ...cropping,
      src: photo.src,
      title: t.photoCropCardTitle,
      note: t.photoCropCardNote,
      x: photo.cropX ?? AUTHOR_CARD_CROP_DEFAULT.x,
      y: photo.cropY ?? AUTHOR_CARD_CROP_DEFAULT.y,
      scale: photo.cropScale ?? CROP_SCALE_MIN,
      onChange: (x: number, y: number) => patchPhoto({ cropX: x, cropY: y }),
      onScaleChange: (scale: number) => patchPhoto({ cropScale: scale }),
      onReset: () =>
        patchPhoto({
          cropX: AUTHOR_CARD_CROP_DEFAULT.x,
          cropY: AUTHOR_CARD_CROP_DEFAULT.y,
          cropScale: CROP_SCALE_MIN,
        }),
    };
  })();
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

  /* The two upload fields were the same fifteen lines twice, and they had
     already drifted once. The shape of a failure belongs to the endpoint, not
     to the field calling it. */
  function uploadErrorFor(status: number): string {
    if (status === 413) return t.uploadTooLarge;
    if (status === 415) return t.uploadBadType;
    if (status === 429) return t.uploadTooOften;
    return t.uploadFailed;
  }

  async function upload(target: "photo" | "background", file: File): Promise<string | null> {
    setUploading(true);
    setUploadError(null);
    setUploadTarget(target);
    try {
      /* Before the bytes leave the device — see shrinkForUpload. This is why
         the same replacement that used to sit silent for most of a minute on a
         phone now finishes in a few seconds. */
      const prepared = await shrinkForUpload(file);
      const form = new FormData();
      form.append("file", prepared);
      const res = await fetch(`/api/lms/authors/me/${target}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      if (!res.ok) {
        setUploadError(uploadErrorFor(res.status));
        return null;
      }
      const body = (await res.json()) as { src: string };
      return body.src;
    } catch {
      setUploadError(t.uploadFailed);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handlePhoto(file: File) {
    const src = await upload("photo", file);
    if (!src) return;
    /* A NEW PICTURE, THE SAME AIM — as for the backdrop below. An author
       swapping one portrait for another has not said anything about where the
       card should look; the recentre button beside each frame is one click
       away when they have. */
    setDraft((prev) => ({
      ...prev,
      photo: {
        ...prev.photo,
        src,
        alt: prev.photo?.alt ?? prev.name,
      },
    }));
  }

  async function handleBackground(file: File) {
    const src = await upload("background", file);
    if (!src) return;
    setDraft((prev) => ({
      ...prev,
      background: { ...prev.background, src },
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    /* One normalisation — see `authorFromDraft`. */
    const next = authorFromDraft(draft, author);

    const ok = await save({
      name: next.name,
      role: next.role,
      bio: next.bio,
      quote: next.quote,
      credentials: next.credentials,
      facts: next.facts,
      profileBlocks: next.profileBlocks,
      experienceBadge: next.experienceBadge,
      achievementBadge: next.achievementBadge,
      consultation: next.consultation,
      photo: next.photo,
      background: next.background,
      listed: next.listed,
      slug: next.slug || undefined,
    });
    if (ok) toast.success(t.saved);
    else toast.error(t.error);
  }

  return (
    <details id="author" className={styles.fold} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={styles.foldHead}>
        <div className={styles.foldText}>
          {/* No eyebrow: `label` and `title` were the same string, byte for
              byte, in both languages — the heading was being announced by a
              smaller copy of itself. */}
          <h2 className={styles.sectionTitle}>{t.title}</h2>
          <span className={styles.sectionLead}>{t.lead}</span>
        </div>
        <Icon className={styles.foldChevron} name="chevron-down" size={20} />
      </summary>
      <div className={styles.foldBody}>
        <form
          className={styles.authorForm}
          {...matte}
          onSubmit={handleSubmit}
          /* A REQUIRED FIELD INSIDE A CLOSED SECTION IS NOT FOCUSABLE, and a
             browser that cannot focus the control it wants to complain about
             gives up silently: no message, no submit, a dead «Зберегти».
             `invalid` bubbles and fires before that focus attempt, so opening
             every `details` above the offending control here is what keeps the
             sections collapsible at all. */
          onInvalid={(event) => {
            let node = (event.target as HTMLElement).parentElement;
            while (node) {
              if (node instanceof HTMLDetailsElement) node.open = true;
              node = node.parentElement;
            }
          }}
        >
          {/* GROUPED BY WHAT THE AUTHOR IS EDITING, not by which surface
              renders it. The first split was by consumer — byline / card /
              page / offer — which is true of the data and wrong for the
              hand: it put the background two sections away from the photo,
              the credentials away from the facts, and cut one page into a
              "publish it" band and a "fill it" band. Where a field actually
              prints is said in the field's own hint, which is where someone
              filling it in is already looking. */}
          <details className={styles.authorSection} open>
            <summary className={styles.authorSectionHead}>
              <div className={styles.authorSectionHeadText}>
                <h3 className={styles.authorSectionTitle}>{t.sectionYou}</h3>
                <p className={styles.authorSectionNote}>{t.sectionYouNote}</p>
              </div>
              <Icon className={styles.authorSectionChevron} name="chevron-down" size={20} />
            </summary>
            <div className={styles.authorSectionBody}>
              {/* ── The section is the shape of the page it writes (2026-09-06) ──
                  IT USED TO BE A LIST OF PICTURES: three frames in a row with a
                  name field somewhere under them. Every control was present and
                  the arrangement belonged to no surface — so the author could
                  not tell from this form what their page would look like, and
                  found out by saving it and opening the page in another tab.

                  The band, the round portrait over its lower edge, and the name
                  and role beside that portrait ARE the composition of
                  `/expert/[slug]`'s own header (`AuthorProfileShowcase`). Laid
                  out the same way here, each field sits where its text prints
                  and each crop frame is the picture it will be — the form is
                  the preview. Under it, kept apart because the page header does
                  not hold it, is the other surface this photograph is read
                  through: the card beneath every course. */}
              <div className={styles.authorHero}>
                {/* THE BAND FIRST, because it is first on the page and because
                    the portrait is read against it — choosing the two a screen
                    apart is choosing them blind. */}
                <div className={`${styles.authorField} ${styles.authorBackgroundField}`}>
                  <span>{t.background}</span>
                  <p className={styles.authorNotice}>{t.backgroundHint}</p>
                  {draft.background?.src ? (
                    <div className={styles.photoCropAside}>
                      <div className={styles.photoCropFrame}>
                        <PhotoCropPreview
                          src={draft.background.src}
                          alt=""
                          shape="banner"
                          label={`${t.cropOpen} — ${t.background}`}
                          x={draft.background.cropX ?? AUTHOR_BANNER_CROP_DEFAULT.x}
                          y={draft.background.cropY ?? AUTHOR_BANNER_CROP_DEFAULT.y}
                          scale={draft.background.cropScale ?? CROP_SCALE_MIN}
                          busy={uploading && uploadTarget === "background"}
                          onOpen={openCrop("banner")}
                        />
                        <div className={styles.authorMediaActions}>
                          <label className={styles.authorPhotoToolbarAction} aria-label={t.backgroundReplace} title={t.backgroundReplace}>
                            <input
                              className={styles.visuallyHidden}
                              type="file"
                              aria-label={t.backgroundReplace}
                              accept={PHOTO_ACCEPT}
                              disabled={uploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) void handleBackground(file);
                              }}
                            />
                            <Icon name="edit" size={18} />
                          </label>
                          <button
                            type="button"
                            className={styles.authorPhotoToolbarAction}
                            aria-label={t.backgroundRemove}
                            title={t.backgroundRemove}
                            onClick={() => setDraft((prev) => ({ ...prev, background: null }))}
                          >
                            <Icon name="close" size={18} />
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.authorIconAction}
                        aria-label={`${t.photoCropCenter} — ${t.background}`}
                        title={t.photoCropCenter}
                        onClick={() =>
                          setDraft((prev) =>
                            prev.background
                              ? {
                                  ...prev,
                                  background: {
                                    ...prev.background,
                                    cropX: AUTHOR_BANNER_CROP_DEFAULT.x,
                                    cropY: AUTHOR_BANNER_CROP_DEFAULT.y,
                                    cropScale: CROP_SCALE_MIN,
                                  },
                                }
                              : prev
                          )
                        }
                      >
                        <Icon name="undo" size={20} />
                      </button>
                    </div>
                  ) : (
                    <AuthorMediaSlot
                      src={undefined}
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
                  )}
                  {uploading && uploadTarget === "background" ? <span className={styles.authorNotice} role="status">{t.photoUploading}</span> : null}
                  {uploadError && uploadTarget === "background" ? <span className={styles.authorNoticeError} role="alert">{uploadError}</span> : null}
                </div>

                <div className={styles.authorHeroIdentity}>
                  {/* The portrait overlaps the band's lower edge, exactly as it
                      does on the page. Same round frame — this one drags. */}
                  <div className={styles.authorHeroAvatar}>
                    {draft.photo?.src ? (
                      <>
                        <PhotoCropPreview
                          src={draft.photo.src}
                          alt=""
                          shape="avatar"
                          label={`${t.cropOpen} — ${t.photoCropAvatarTitle}`}
                          x={draft.photo.avatarCropX ?? AUTHOR_AVATAR_CROP_DEFAULT.x}
                          y={draft.photo.avatarCropY ?? AUTHOR_AVATAR_CROP_DEFAULT.y}
                          scale={draft.photo.avatarCropScale ?? CROP_SCALE_MIN}
                          busy={uploading && uploadTarget === "photo"}
                          onOpen={openCrop("avatar")}
                        />
                        {/* The frame's name and its recentre on one line under
                            the portrait: a heading above it would sit on the
                            band the portrait is there to overlap. */}
                        <div className={styles.authorHeroCaptionRow}>
                          <p className={styles.authorHeroCaption}>{t.photoCropAvatarNote}</p>
                          <button
                              type="button"
                              className={styles.authorIconAction}
                              aria-label={`${t.photoCropCenter} — ${t.photoCropAvatarTitle}`}
                              title={t.photoCropCenter}
                              onClick={() =>
                                setDraft((prev) =>
                                  prev.photo
                                    ? {
                                        ...prev,
                                        photo: {
                                          ...prev.photo,
                                          avatarCropX: AUTHOR_AVATAR_CROP_DEFAULT.x,
                                          avatarCropY: AUTHOR_AVATAR_CROP_DEFAULT.y,
                                          avatarCropScale: CROP_SCALE_MIN,
                                        },
                                      }
                                    : prev
                                )
                              }
                            >
                              <Icon name="undo" size={20} />
                            </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className={styles.authorHeroFields}>
                    <label className={`${styles.authorField} ${styles.authorFieldPhrase}`}>
                      <span>
                        {t.name}
                        <RequiredMark tooltip={t.nameRequired} />
                      </span>
                      <input
                        className={styles.authorInput}
                        value={draft.name}
                        autoComplete="name"
                        required
                        onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </label>
                    <label className={`${styles.authorField} ${styles.authorFieldPhrase}`}>
                      <span>{t.role}</span>
                      <input
                        className={styles.authorInput}
                        value={draft.role}
                        onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.authorField}>
                {draft.photo?.src ? (
                  <div className={styles.authorCardRow}>
                    <section className={styles.photoCropPanel} aria-labelledby="author-photo-crop-card-title">
                      <div className={styles.photoCropHead}>
                        <h4 id="author-photo-crop-card-title">{t.photoCropCardTitle}</h4>
                        <p>{t.photoCropCardNote}</p>
                      </div>
                      <div className={styles.photoCropAside}>
                        {/* ON THE PICTURE, because that is what they change.
                            In the field's heading they were an inch of
                            nothing away from the photograph, next to a
                            label; here they are the same corner pair the
                            background slot has carried all along
                            (`.authorMediaActions`). `stopPropagation`
                            because the frame under them owns the drag. */}
                        <div className={styles.photoCropFrame}>
                            <PhotoCropPreview
                              src={draft.photo.src}
                              alt=""
                              shape="card"
                            label={`${t.cropOpen} — ${t.photoCropCardTitle}`}
                            x={draft.photo.cropX ?? AUTHOR_CARD_CROP_DEFAULT.x}
                            y={draft.photo.cropY ?? AUTHOR_CARD_CROP_DEFAULT.y}
                            scale={draft.photo.cropScale ?? CROP_SCALE_MIN}
                            busy={uploading && uploadTarget === "photo"}
                            onOpen={openCrop("card")}
                          />
                          <div className={styles.authorMediaActions}>
                            <label className={styles.authorPhotoToolbarAction} aria-label={t.photoReplace} title={t.photoReplace}>
                              <input
                                className={styles.visuallyHidden}
                                type="file"
                                aria-label={t.photoReplace}
                                accept={PHOTO_ACCEPT}
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
                        </div>
                        <button
                            type="button"
                            className={styles.authorIconAction}
                            aria-label={`${t.photoCropCenter} — ${t.photoCropCardTitle}`}
                            title={t.photoCropCenter}
                            onClick={() =>
                              setDraft((prev) =>
                                prev.photo
                                  ? {
                                      ...prev,
                                      photo: {
                                        ...prev.photo,
                                        cropX: AUTHOR_CARD_CROP_DEFAULT.x,
                                        cropY: AUTHOR_CARD_CROP_DEFAULT.y,
                                        /* Recentring undoes the whole crop, zoom
                                           included — a frame recentred but still
                                           at 2.4× is not the frame the button's
                                           icon promises to give back. */
                                        cropScale: CROP_SCALE_MIN,
                                      },
                                    }
                                  : prev
                              )
                            }
                          >
                            <Icon name="undo" size={20} />
                          </button>
                      </div>
                    </section>
                    {/* A LABEL, NOT A PLACEHOLDER, AND REQUIRED — a placeholder
                        is gone the moment you type into the field, and this
                        particular field decides whether the photograph beside
                        it is kept at all. */}
                    <label className={styles.authorField}>
                      <span>
                        {t.photoAlt}
                        <RequiredMark tooltip={t.photoAltRequired} />
                      </span>
                      <input
                        className={styles.authorInput}
                        value={draft.photo.alt}
                        required
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            photo: prev.photo ? { ...prev.photo, alt: e.target.value } : prev.photo,
                          }))
                        }
                      />
                    </label>
                  </div>
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
                {uploading && uploadTarget === "photo" ? <span className={styles.authorNotice} role="status">{t.photoUploading}</span> : null}
                {uploadError && uploadTarget === "photo" ? <span className={styles.authorNoticeError} role="alert">{uploadError}</span> : null}
              </div>
            </div>
          </details>

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
                <input className={styles.authorInput} value={draft.experienceBadge} required={draft.listed} onChange={(e) => setDraft((prev) => ({ ...prev, experienceBadge: e.target.value }))} />
              </label>
            </div>
          </details>

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
                      <legend className={styles.authorProfileBlockNumber}>{t.blockNumber} {index + 1}</legend>
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
                        id: `section-${crypto.randomUUID()}`,
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
            </div>
          </details>

          <details className={`${styles.authorSection} ${styles.authorConsultationField}`} open>
            <summary className={styles.authorSectionHead}>
              <div className={styles.authorSectionHeadText}>
                <h3 className={styles.authorSectionTitle}>{t.consultation}</h3>
              </div>
              <Icon className={styles.authorSectionChevron} name="chevron-down" size={20} />
            </summary>
            <div className={styles.authorSectionBody}>
                <label className={styles.authorVisibilityRow}><input className={styles.authorVisibilityInput} type="checkbox" checked={draft.consultation.enabled} onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, enabled: e.target.checked } }))} /><span className={styles.authorVisibilityMark} aria-hidden="true"><Icon name="check" size={14} /></span><span>{t.consultationEnabled}</span></label>
                {draft.consultation.enabled ? (
                  <>
                  {/* `upsertAuthorProfile` REFUSES the whole save when consultations
                      are on and any of these three is blank (`authors.ts` returns
                      `invalid_profile`). They were optional, unlabelled placeholders
                      here — so the one rule that actually blocks the form was the one
                      thing the form never said, and the author got a dead button and a
                      generic toast. Labelled, marked, and required in the markup, which
                      also routes them through the `onInvalid` reopener above. */}
                  <label className={styles.authorField}>
                    <span>
                      {t.consultationTitleLabel}
                      <RequiredMark tooltip={t.consultationRequired} />
                    </span>
                    <input className={styles.authorInput} value={draft.consultation.title} required onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, title: e.target.value } }))} />
                  </label>
                  <label className={styles.authorField}>
                    <span>
                      {t.consultationSummaryLabel}
                      <RequiredMark tooltip={t.consultationRequired} />
                    </span>
                    <textarea className={styles.authorTextarea} rows={3} value={draft.consultation.summary} required onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, summary: e.target.value } }))} />
                  </label>
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
                  <label className={styles.authorField}>
                    <span>
                      {t.consultationContactLabel}
                      <RequiredMark tooltip={t.consultationRequired} />
                    </span>
                    <input className={styles.authorInput} type="url" inputMode="url" value={draft.consultation.contactUrl} required onChange={(e) => setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, contactUrl: e.target.value } }))} />
                  </label>
                  </>
                ) : null}
            </div>
          </details>

            <div className={styles.actions}>
              <button className={styles.actionPrimary} type="submit" disabled={saving || uploading}>
                {saving ? t.saving : uploading ? t.photoUploading : t.save}
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
      {/* OUTSIDE THE FORM'S FIELDS, INSIDE ITS STATE. One editor serves all three
          frames: which shape it wears, where it reads and where it writes are
          the only differences between them, and three copies of a dialog is how
          two of them fall behind the third. It edits the DRAFT, like every other
          control here — nothing is written until the author saves. */}
      {cropTarget ? (
        <CropEditor
          src={cropTarget.src}
          alt=""
          title={cropTarget.title}
          note={cropTarget.note}
          ratio={cropTarget.ratio}
          radius={cropTarget.radius}
          x={cropTarget.x}
          y={cropTarget.y}
          scale={cropTarget.scale}
          onChange={cropTarget.onChange}
          onScaleChange={cropTarget.onScaleChange}
          onReset={cropTarget.onReset}
          onClose={() => setCropping(null)}
          labels={{
            stage: t.cropFocus,
            zoom: t.cropZoom,
            reset: t.photoCropCenter,
            done: t.cropDone,
            position: (x, y) => cropPosition(x, y),
          }}
        />
      ) : null}
    </details>
  );
}
