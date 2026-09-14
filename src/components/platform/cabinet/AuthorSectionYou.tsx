"use client";

/**
 * «You» — who you are, your photograph, and the background of your page.
 *
 * Split out of AuthorProfileFold.tsx (1,163 lines) on 2026-09-13.
 *
 * GROUPED BY WHAT IS EDITED (2026-09-14), not laid out as the page header. It
 * was the `/expert/[slug]` lockup — band, portrait, name beside it — with the
 * course card under it as a second copy of the same photograph. Three sizing
 * systems met in that lockup and left four right edges, and one photograph was
 * split across two groups: its avatar in the header, its replace, remove and
 * required description beside the card only, so × on «Картка» silently took
 * the avatar with it. See `.authorSectionBodyGroups` in Cabinet.module.css.
 *
 * Every group is now the form's one grammar — label, hint, control — and a
 * command sits with the thing it acts on: file commands in the group's head,
 * the crop behind the frame itself (and «По центру» inside the crop dialog).
 */

import { useId, type ChangeEvent } from "react";
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

/**
 * Replace and remove for a whole file — in the group's head, beside its label.
 * On a frame they read as that frame's own commands; the file has two frames.
 */
function FileActions({
  replaceLabel,
  removeLabel,
  uploading,
  onFile,
  onRemove,
}: {
  replaceLabel: string;
  removeLabel: string;
  uploading: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFile(file);
  };
  return (
    <div className={styles.authorPhotoActions}>
      <label className={styles.authorFileAction} aria-label={replaceLabel} title={replaceLabel}>
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
      <button
        type="button"
        className={styles.authorIconAction}
        aria-label={removeLabel}
        title={removeLabel}
        onClick={onRemove}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

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
  /* EXPLICIT `for`, NOT A WRAPPING LABEL. `RequiredMark` is a button, and a
     `<label>` wrapping one labels its FIRST labelable descendant — the
     asterisk, not the input. The name field was announced without its name,
     and clicking the word «Ім'я» opened the tooltip instead of the field. */
  const nameId = useId();
  const roleId = useId();
  const altId = useId();

  return (
    <details className={styles.authorSection} open>
      <summary className={styles.authorSectionHead}>
        <div className={styles.authorSectionHeadText}>
          <h3 className={styles.authorSectionTitle}>{t.sectionYou}</h3>
          <p className={styles.authorSectionNote}>{t.sectionYouNote}</p>
        </div>
        <Icon className={styles.authorSectionChevron} name="chevron-down" size={20} />
      </summary>
      <div className={`${styles.authorSectionBody} ${styles.authorSectionBodyGroups}`}>
        {/* WHO. The two lines printed under every course, on one line — a name
            and a role are one fact in two parts (`.authorFieldRow`). */}
        <div className={styles.authorFieldRow}>
          <div className={`${styles.authorField} ${styles.authorFieldPhrase}`}>
            <span className={styles.authorFieldLabel}>
              <label htmlFor={nameId}>{t.name}</label>
              <RequiredMark tooltip={t.nameRequired} />
            </span>
            <input
              id={nameId}
              className={styles.authorInput}
              value={draft.name}
              autoComplete="name"
              required
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className={`${styles.authorField} ${styles.authorFieldPhrase}`}>
            <span className={styles.authorFieldLabel}>
              <label htmlFor={roleId}>{t.role}</label>
            </span>
            <input
              id={roleId}
              className={styles.authorInput}
              value={draft.role}
              onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
            />
          </div>
        </div>

        {/* THE PHOTOGRAPH — one file, its two frames, its description. The
            frames are named and sit side by side, so it is visible that the
            avatar and the card are the same picture aimed twice; the file's
            own commands and the description it needs belong to the group, not
            to whichever frame happened to be drawn last. */}
        <div className={styles.authorMediaGroup}>
          <div className={styles.authorField}>
            <div className={styles.authorFieldHead}>
              <span>{t.photo}</span>
              {draft.photo?.src ? (
                <FileActions
                  replaceLabel={t.photoReplace}
                  removeLabel={t.photoRemove}
                  uploading={uploading}
                  onFile={(file) => void onPhoto(file)}
                  onRemove={() => setDraft((prev) => ({ ...prev, photo: null }))}
                />
              ) : null}
            </div>
            <p className={styles.authorNotice}>{t.photoHint}</p>
          </div>

          {draft.photo?.src ? (
            <div className={styles.photoCropGrid}>
              <div className={styles.photoCropPanel}>
                <div className={styles.authorField}>
                  <span>{t.photoCropAvatarTitle}</span>
                  <p className={styles.authorNotice}>{t.photoCropAvatarNote}</p>
                </div>
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
              </div>
              <div className={styles.photoCropPanel}>
                <div className={styles.authorField}>
                  <span>{t.photoCropCardTitle}</span>
                  <p className={styles.authorNotice}>{t.photoCropCardNote}</p>
                </div>
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
              </div>
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

          {/* A LABEL, NOT A PLACEHOLDER, AND REQUIRED — this field decides
              whether the photograph is kept at all, so it sits in the
              photograph's own group, under both of its frames. */}
          {draft.photo?.src ? (
            <div className={styles.authorField}>
              <span className={styles.authorFieldLabel}>
                <label htmlFor={altId}>{t.photoAlt}</label>
                <RequiredMark tooltip={t.photoAltRequired} />
              </span>
              <input
                id={altId}
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
            </div>
          ) : null}
        </div>

        {/* THE PAGE'S BACKGROUND, LAST. The section's note is about what prints
            under every course; this is the one thing here that prints only on
            the author's own page, so it no longer opens the section. */}
        <div className={`${styles.authorMediaGroup} ${styles.authorBackgroundField}`}>
          <div className={styles.authorField}>
            <div className={styles.authorFieldHead}>
              <span>{t.background}</span>
              {draft.background?.src ? (
                <FileActions
                  replaceLabel={t.backgroundReplace}
                  removeLabel={t.backgroundRemove}
                  uploading={uploading}
                  onFile={(file) => void onBackground(file)}
                  onRemove={() => setDraft((prev) => ({ ...prev, background: null }))}
                />
              ) : null}
            </div>
            <p className={styles.authorNotice}>{t.backgroundHint}</p>
          </div>
          {draft.background?.src ? (
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
      </div>
    </details>
  );
}
