"use client";

/**
 * «You» — the band, the portrait, the name and role, and the course card's
 * crop of the same photograph.
 *
 * Split out of AuthorProfileFold.tsx (1,163 lines) on 2026-09-13; the markup
 * is unchanged.
 */

import { Icon } from "@/components/Icon";
import {
  AUTHOR_AVATAR_CROP_DEFAULT,
  AUTHOR_BANNER_CROP_DEFAULT,
  AUTHOR_CARD_CROP_DEFAULT,
} from "@/lib/lms/authorPhoto";
import { CROP_SCALE_MIN } from "@/lib/media/imageCrop";
import styles from "./Cabinet.module.css";
import {
  AuthorMediaSlot,
  PHOTO_ACCEPT,
  PhotoCropPreview,
  RequiredMark,
  type PhotoCropShape,
} from "./AuthorProfileMedia";
import type { AuthorSectionProps, AuthorUploadTarget } from "./authorProfileTypes";

export function AuthorSectionYou({
  draft,
  setDraft,
  t,
  uploading,
  uploadError,
  uploadTarget,
  openCrop,
  onPhoto,
  onBackground,
}: AuthorSectionProps & {
  uploading: boolean;
  uploadError: string | null;
  uploadTarget: AuthorUploadTarget | null;
  openCrop: (shape: PhotoCropShape) => (frame: HTMLElement) => void;
  onPhoto: (file: File) => Promise<void>;
  onBackground: (file: File) => Promise<void>;
}) {
  return (
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
                          if (file) void onBackground(file);
                        }}
                      />
                      <Icon name="import" size={18} />
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
                onFile={(file) => void onBackground(file)}
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
                            if (file) void onPhoto(file);
                          }}
                        />
                        <Icon name="import" size={18} />
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
              onFile={(file) => void onPhoto(file)}
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
  );
}
