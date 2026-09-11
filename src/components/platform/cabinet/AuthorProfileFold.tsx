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
import {
  AUTHOR_AVATAR_CROP_DEFAULT,
  AUTHOR_BANNER_CROP_DEFAULT,
  AUTHOR_CARD_CROP_DEFAULT,
} from "@/lib/lms/authorPhoto";
import dynamic from "next/dynamic";
import { CROP_SCALE_MIN } from "@/lib/media/imageCrop";
import { shrinkForUpload } from "@/lib/media/shrinkForUpload";
import type { AuthorProfileInput } from "./useCabinet";
import styles from "./Cabinet.module.css";
import { matte } from "./CourseCard";
import {
  AuthorMediaSlot,
  PHOTO_ACCEPT,
  PhotoCropPreview,
  RequiredMark,
  type PhotoCropShape,
} from "./AuthorProfileMedia";
import { authorFromDraft, draftFromAuthor, type Draft } from "./authorProfileDraft";
import { STRINGS } from "./authorProfileStrings";

const CropEditor = dynamic(() => import("@/components/media/CropEditor").then((m) => m.CropEditor), { ssr: false });

export const PHOTO_CROP_FRAME: Record<
  PhotoCropShape,
  { className: "photoCropCard" | "photoCropAvatar" | "photoCropBanner" }
> = {
  card: { className: "photoCropCard" },
  avatar: { className: "photoCropAvatar" },
  /* The backdrop band on the author's own page — a 6:1 letterbox, which is why
     it needs aiming more than either of the other two: a portrait handed to it
     loses about five sixths of its height to `cover`. */
  banner: { className: "photoCropBanner" },
};

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
                          <label
                            className={styles.authorPhotoToolbarAction}
                            aria-label={t.backgroundReplace}
                            title={t.backgroundReplace}
                          >
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
                              : prev,
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
                  {uploading && uploadTarget === "background" ? (
                    <span className={styles.authorNotice} role="status">
                      {t.photoUploading}
                    </span>
                  ) : null}
                  {uploadError && uploadTarget === "background" ? (
                    <span className={styles.authorNoticeError} role="alert">
                      {uploadError}
                    </span>
                  ) : null}
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
                                  : prev,
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
                            <label
                              className={styles.authorPhotoToolbarAction}
                              aria-label={t.photoReplace}
                              title={t.photoReplace}
                            >
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
                                : prev,
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
                {uploading && uploadTarget === "photo" ? (
                  <span className={styles.authorNotice} role="status">
                    {t.photoUploading}
                  </span>
                ) : null}
                {uploadError && uploadTarget === "photo" ? (
                  <span className={styles.authorNoticeError} role="alert">
                    {uploadError}
                  </span>
                ) : null}
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
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, facts: prev.facts.filter((_, i) => i !== index) }))
                        }
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
                      also routes them through the `onInvalid` reopener above. */}
                  <label className={styles.authorField}>
                    <span>
                      {t.consultationTitleLabel}
                      <RequiredMark tooltip={t.consultationRequired} />
                    </span>
                    <input
                      className={styles.authorInput}
                      value={draft.consultation.title}
                      required
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, consultation: { ...prev.consultation, title: e.target.value } }))
                      }
                    />
                  </label>
                  <label className={styles.authorField}>
                    <span>
                      {t.consultationSummaryLabel}
                      <RequiredMark tooltip={t.consultationRequired} />
                    </span>
                    <textarea
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
                  <label className={styles.authorField}>
                    <span>
                      {t.consultationContactLabel}
                      <RequiredMark tooltip={t.consultationRequired} />
                    </span>
                    <input
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
              <Link
                className={styles.actionGhost}
                href={`/expert/${author.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
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
