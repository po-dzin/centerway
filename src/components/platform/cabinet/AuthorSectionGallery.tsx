"use client";

/**
 * «Галерея» — the photographs and videos printed on the author's own page.
 *
 * Photographs upload through the same path as the portrait
 * (`useAuthorUpload`, target "gallery"). A video is a pasted YouTube link,
 * kept as its id — the same way a lesson keeps one — so nothing heavy is
 * stored here. Like every other section it only edits the draft: nothing is
 * written until the fold's «Зберегти».
 */

import { useState, type ChangeEvent } from "react";
import { Icon } from "@/components/Icon";
import { AUTHOR_GALLERY_MAX, youtubeIdFrom, type AuthorGalleryItem } from "@/lms-core";
import styles from "./Cabinet.module.css";
import { PHOTO_ACCEPT } from "./AuthorProfileMedia";
import type { AuthorSectionProps } from "./authorProfileTypes";
import { youtubePoster } from "@/lib/media/youtube";

export function AuthorSectionGallery({
  draft,
  setDraft,
  t,
  uploading,
  uploadError,
  onFiles,
}: AuthorSectionProps & {
  uploading: boolean;
  uploadError: string | null;
  onFiles: (files: File[]) => void;
}) {
  const [videoUrl, setVideoUrl] = useState("");
  const [videoInvalid, setVideoInvalid] = useState(false);
  const full = draft.gallery.length >= AUTHOR_GALLERY_MAX;

  const update = (id: string, change: (item: AuthorGalleryItem) => AuthorGalleryItem) =>
    setDraft((prev) => ({ ...prev, gallery: prev.gallery.map((item) => (item.id === id ? change(item) : item)) }));

  const move = (index: number, step: -1 | 1) =>
    setDraft((prev) => {
      const target = index + step;
      if (target < 0 || target >= prev.gallery.length) return prev;
      const gallery = [...prev.gallery];
      [gallery[index], gallery[target]] = [gallery[target]!, gallery[index]!];
      return { ...prev, gallery };
    });

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, AUTHOR_GALLERY_MAX - draft.gallery.length);
    event.target.value = "";
    if (files.length) onFiles(files);
  };

  const addVideo = () => {
    const videoId = youtubeIdFrom(videoUrl);
    if (!videoId) {
      setVideoInvalid(true);
      return;
    }
    setVideoInvalid(false);
    setVideoUrl("");
    setDraft((prev) =>
      prev.gallery.length >= AUTHOR_GALLERY_MAX
        ? prev
        : {
            ...prev,
            gallery: [...prev.gallery, { id: `g-${crypto.randomUUID()}`, kind: "video", provider: "youtube", videoId }],
          },
    );
  };

  return (
    <details className={styles.authorSection} open>
      <summary className={styles.authorSectionHead}>
        <div className={styles.authorSectionHeadText}>
          <h3 className={styles.authorSectionTitle}>{t.sectionGallery}</h3>
          <p className={styles.authorSectionNote}>{t.sectionGalleryNote}</p>
        </div>
        <Icon className={styles.authorSectionChevron} name="chevron-down" size={20} />
      </summary>
      <div className={styles.authorSectionBody}>
        {draft.gallery.length > 0 ? (
          <ol className={styles.authorGalleryList}>
            {draft.gallery.map((item, index) => (
              <li className={styles.authorGalleryItem} key={item.id}>
                <div className={styles.authorGalleryThumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the cabinet's own upload or YouTube's still */}
                  <img src={item.kind === "image" ? item.src : youtubePoster(item.videoId)} alt="" />
                  {item.kind === "video" ? (
                    <span className={styles.authorGalleryVideoMark} aria-label={t.galleryVideo}>
                      <Icon name="play" size={20} />
                    </span>
                  ) : null}
                  <div className={styles.authorMediaActions}>
                    <button
                      type="button"
                      className={styles.authorMediaAction}
                      aria-label={t.galleryRemove}
                      title={t.galleryRemove}
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, gallery: prev.gallery.filter((entry) => entry.id !== item.id) }))
                      }
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </div>
                </div>
                <div className={styles.authorGalleryControls}>
                  <button
                    type="button"
                    className={styles.authorIconAction}
                    aria-label={t.galleryMoveEarlier}
                    title={t.galleryMoveEarlier}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <Icon name="arrow-left" size={18} />
                  </button>
                  <input
                    className={styles.authorInput}
                    value={item.caption ?? ""}
                    placeholder={t.galleryCaption}
                    aria-label={`${t.galleryCaption} ${index + 1}`}
                    onChange={(event) => update(item.id, (entry) => ({ ...entry, caption: event.target.value }))}
                  />
                  <button
                    type="button"
                    className={styles.authorIconAction}
                    aria-label={t.galleryMoveLater}
                    title={t.galleryMoveLater}
                    disabled={index === draft.gallery.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <Icon name="arrow-right" size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {full ? (
          <p className={styles.authorNotice}>{t.galleryFull}</p>
        ) : (
          <div className={styles.authorGalleryAdd}>
            <label className={styles.authorBlockAdd} aria-disabled={uploading || undefined}>
              <input
                className={styles.visuallyHidden}
                type="file"
                multiple
                accept={PHOTO_ACCEPT}
                disabled={uploading}
                onChange={pick}
              />
              <Icon name="import" size={20} />
              <span>{uploading ? t.photoUploading : t.galleryAddPhoto}</span>
            </label>
            <div className={styles.authorGalleryVideo}>
              <input
                className={styles.authorInput}
                /* Text, not `url`: a half-pasted link in a `url` field would
                   make the browser refuse the whole profile's save. */
                type="text"
                inputMode="url"
                value={videoUrl}
                placeholder="https://youtu.be/…"
                aria-label={t.galleryVideoUrl}
                aria-invalid={videoInvalid || undefined}
                onChange={(event) => {
                  setVideoUrl(event.target.value);
                  setVideoInvalid(false);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  // Enter here means «add this video», not «save the whole profile».
                  event.preventDefault();
                  addVideo();
                }}
              />
              <button type="button" className={styles.authorBlockAdd} onClick={addVideo} disabled={!videoUrl.trim()}>
                <Icon name="play" size={20} />
                <span>{t.galleryAddVideo}</span>
              </button>
            </div>
          </div>
        )}
        {videoInvalid ? (
          <p className={styles.authorNoticeError} role="alert">
            {t.galleryVideoInvalid}
          </p>
        ) : null}
        {uploadError ? (
          <p className={styles.authorNoticeError} role="alert">
            {uploadError}
          </p>
        ) : null}
      </div>
    </details>
  );
}
