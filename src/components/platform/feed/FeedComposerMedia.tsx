"use client";

/**
 * What a post carries besides words, in the composer (2026-10-17): the photo
 * strip, the YouTube link and the audio — recorded here or picked from a file.
 * The limits are the server's (`@/lib/feed/media`); the composer says them
 * before an upload is wasted, the server still decides.
 *
 * UPLOADS SHOW THEIR BYTES. `uploadFeedMedia` is `fetch`, which has no upload
 * progress, and a phone photo on a slow line is a long silence. So the same
 * POST goes through `XMLHttpRequest` with the session's token, and on a 401 —
 * the one case `authorizedFetch` retries after a refresh — the file goes once
 * more through `uploadFeedMedia`, which does that refresh.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import { accessToken } from "@/components/auth/authorizedFetch";
import { PhotoViewer } from "@/components/platform/PhotoViewer";
import { youtubeIdFrom } from "@/lms-core";
import {
  FEED_AUDIO_MAX_BYTES,
  FEED_AUDIO_MAX_SECONDS,
  FEED_AUDIO_TYPES,
  FEED_CLIP_MAX_BYTES,
  FEED_CLIP_MAX_LONG,
  FEED_CLIP_MAX_SECONDS,
  FEED_CLIP_MAX_SHORT,
  FEED_CLIP_TYPES,
} from "@/lib/feed/media";
import type { UploadedMedia } from "@/lib/feed/upload";

import { clockOf, composerCopy } from "./composerCopy";
import { ComposerPopover } from "./FeedComposerMenus";
import { shrinkPhoto } from "./shrinkPhoto";
import { signClip, uploadFeedMedia, type FeedResult } from "./feedApi";
import styles from "./FeedComposer.module.css";

/* ─────────────────────────── state ─────────────────────────── */

export type PhotoItem = {
  key: string;
  /** What the strip shows: the local file while it uploads, the stored one after. */
  preview: string;
  status: "uploading" | "done" | "failed";
  /** 0…1 while uploading. */
  progress: number;
  file?: File;
  path?: string;
  w?: number;
  h?: number;
  spoiler: boolean;
  error?: string;
};

export type ClipItem = {
  status: "uploading" | "done" | "failed";
  progress: number;
  /** The local file while it uploads, the stored one after. */
  preview: string;
  durationSec: number;
  w: number;
  h: number;
  file?: File;
  path?: string;
  mime?: string;
  error?: string;
};

export type AudioItem = {
  status: "uploading" | "done" | "failed";
  progress: number;
  preview: string;
  durationSec: number;
  file?: File;
  path?: string;
  mime?: string;
  /** The recording's loudness, measured before upload; the player's waveform. */
  peaks?: number[];
  /** The waveform is still being measured; publishing waits for it. */
  measuring?: boolean;
  error?: string;
};

export type VideoItem = { youtubeId: string };

/* ─────────────────────────── upload ─────────────────────────── */

export async function uploadWithProgress(
  original: File,
  onProgress: (fraction: number) => void,
  asPlatform = false,
): Promise<FeedResult<UploadedMedia>> {
  const token = await accessToken().catch(() => null);
  const file = await shrinkPhoto(original);
  const first = await new Promise<FeedResult<UploadedMedia>>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", asPlatform ? "/api/feed/media?as=platform" : "/api/feed/media");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(0.98, event.loaded / event.total));
    };
    xhr.onload = () => {
      let payload: (UploadedMedia & { error?: string }) | null = null;
      try {
        payload = JSON.parse(xhr.responseText) as UploadedMedia & { error?: string };
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload) resolve({ ok: true, data: payload });
      else resolve({ ok: false, code: String(payload?.error ?? xhr.status), status: xhr.status });
    };
    xhr.onerror = () => resolve({ ok: false, code: "network", status: 0 });
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
  if (!first.ok && first.status === 401 && token) return uploadFeedMedia(file, "upload", asPlatform);
  if (first.ok) onProgress(1);
  return first;
}

export function mediaError(code: string, fallback: string): string {
  return composerCopy.errors[code] ?? fallback;
}

/* ─────────────────────────── the strip ─────────────────────────── */

function Thumb({
  item,
  index,
  onView,
  onSpoiler,
  onTag,
  onRemove,
  onRetry,
}: {
  item: PhotoItem;
  index: number;
  onView: () => void;
  onSpoiler: () => void;
  /** «Позначити авторів» (mockup v3): opens the post's «з …» menu. Absent with nobody to name. */
  onTag?: () => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const more = useRef<HTMLButtonElement>(null);

  const n = index + 1;
  return (
    <figure
      className={styles.thumb}
      data-spoiler={item.spoiler || undefined}
      data-status={item.status}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu) {
          // The dialog closes on Escape too; this one press only closes the menu.
          event.preventDefault();
          event.stopPropagation();
          setMenu(false);
        }
      }}
    >
      {/* A blob: or a storage address the author just made; nothing to optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.preview} alt={composerCopy.photoAlt(n)} />
      {item.spoiler ? (
        <span className={styles.spoilerBadge}>
          <Icon name="spoiler" size={20} />
          {composerCopy.spoilerBadge}
        </span>
      ) : null}
      {item.status === "uploading" ? (
        <span
          className={styles.thumbProgress}
          role="progressbar"
          aria-label={composerCopy.photoUploading}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(item.progress * 100)}
        >
          <span style={{ inlineSize: `${Math.max(6, item.progress * 100)}%` }} />
        </span>
      ) : null}
      {item.status === "failed" ? (
        <button className={styles.thumbRetryAction} type="button" onClick={onRetry} title={item.error}>
          {composerCopy.retry}
        </button>
      ) : null}
      <button
        ref={more}
        className={styles.thumbMenuAction}
        type="button"
        aria-label={composerCopy.photoActions(n)}
        aria-expanded={menu}
        aria-haspopup="menu"
        onClick={() => setMenu((current) => !current)}
      >
        <span className={styles.moreBadge} aria-hidden="true">
          <Icon name="more" size={20} />
        </span>
      </button>
      <ComposerPopover
        open={menu}
        onClose={() => setMenu(false)}
        anchor={more}
        label={composerCopy.photoActions(n)}
        width={240}
        role="menu"
      >
        <button
          className={styles.menuItemAction}
          type="button"
          role="menuitem"
          onClick={() => {
            setMenu(false);
            onView();
          }}
        >
          {composerCopy.viewPhoto}
          <Icon name="expand" size={20} />
        </button>
        <button
          className={styles.menuItemAction}
          type="button"
          role="menuitem"
          disabled={item.status !== "done"}
          onClick={() => {
            onSpoiler();
            setMenu(false);
          }}
        >
          {item.spoiler ? composerCopy.spoilerOff : composerCopy.spoilerOn}
          <Icon name={item.spoiler ? "eye" : "spoiler"} size={20} />
        </button>
        {onTag ? (
          <button
            className={styles.menuItemAction}
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              onTag();
            }}
          >
            {composerCopy.tagLabel}
            <Icon name="user-add" size={20} />
          </button>
        ) : null}
        <button
          className={styles.menuItemAction}
          type="button"
          role="menuitem"
          onClick={() => {
            setMenu(false);
            onRemove();
          }}
        >
          {composerCopy.removePhoto}
          <Icon name="trash" size={20} />
        </button>
      </ComposerPopover>
    </figure>
  );
}

/**
 * Everything a post carries as a file, in one row of equal tiles (G 17.10:
 * «однозначно уніфіковано додавати різні типи файлів»): photos, then the
 * video, then the audio. Each tile is pressed for its «⋯» menu; nothing about
 * a file is spread into the field as if it were part of the text.
 */
export function MediaStrip({
  photos,
  video,
  clip,
  audio,
  onSpoiler,
  onTag,
  onRemove,
  onRetry,
  onRemoveVideo,
  onRemoveClip,
  onRetryClip,
  onRemoveAudio,
  onRetryAudio,
}: {
  photos: PhotoItem[];
  video: VideoItem | null;
  clip: ClipItem | null;
  audio: AudioItem | null;
  onSpoiler: (key: string) => void;
  onTag?: () => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  onRemoveVideo: () => void;
  onRemoveClip: () => void;
  onRetryClip: () => void;
  onRemoveAudio: () => void;
  onRetryAudio: () => void;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  if (photos.length === 0 && !video && !clip && !audio) return null;
  return (
    <div className={`${styles.strip} cw-scroll-rail`}>
      {viewing !== null && photos[viewing] ? (
        <PhotoViewer
          photos={photos.map((photo, index) => ({
            src: photo.preview,
            alt: `Фото ${index + 1}`,
            w: photo.w,
            h: photo.h,
          }))}
          start={viewing}
          onClose={() => setViewing(null)}
        />
      ) : null}
      {photos.map((item, index) => (
        <Thumb
          key={item.key}
          item={item}
          index={index}
          onView={() => setViewing(index)}
          onSpoiler={() => onSpoiler(item.key)}
          onTag={onTag}
          onRemove={() => onRemove(item.key)}
          onRetry={() => onRetry(item.key)}
        />
      ))}
      {video ? <VideoTile video={video} onRemove={onRemoveVideo} /> : null}
      {clip ? <ClipTile clip={clip} onRemove={onRemoveClip} onRetry={onRetryClip} /> : null}
      {audio ? <AudioTile audio={audio} onRemove={onRemoveAudio} onRetry={onRetryAudio} /> : null}
    </div>
  );
}

/** A tile's frame and its «⋯» menu — the photo's, for the other kinds. */
function Tile({
  kind,
  label,
  status,
  children,
  menu: items,
}: {
  kind: "video" | "audio";
  label: string;
  status?: string;
  children: ReactNode;
  menu: { label: string; icon: "trash" | "play" | "close"; onSelect: () => void }[];
}) {
  const [menu, setMenu] = useState(false);
  const more = useRef<HTMLButtonElement>(null);
  return (
    <figure
      className={styles.thumb}
      data-kind={kind}
      data-status={status}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu) {
          event.preventDefault();
          event.stopPropagation();
          setMenu(false);
        }
      }}
    >
      {children}
      <button
        ref={more}
        className={styles.thumbMenuAction}
        type="button"
        aria-label={label}
        aria-expanded={menu}
        aria-haspopup="menu"
        onClick={() => setMenu((current) => !current)}
      >
        <span className={styles.moreBadge} aria-hidden="true">
          <Icon name="more" size={20} />
        </span>
      </button>
      <ComposerPopover open={menu} onClose={() => setMenu(false)} anchor={more} label={label} width={240} role="menu">
        {items.map((item) => (
          <button
            key={item.label}
            className={styles.menuItemAction}
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              item.onSelect();
            }}
          >
            {item.label}
            <Icon name={item.icon} size={20} />
          </button>
        ))}
      </ComposerPopover>
    </figure>
  );
}

/** The linked video as a tile: YouTube's own still, with the video mark on it. */
function VideoTile({ video, onRemove }: { video: VideoItem; onRemove: () => void }) {
  // A private or removed video has no still: the mark alone says what it is.
  const [still, setStill] = useState(true);
  return (
    <Tile
      kind="video"
      label={composerCopy.videoActions}
      menu={[{ label: composerCopy.videoRemove, icon: "trash", onSelect: onRemove }]}
    >
      {still ? (
        /* YouTube's still for the id; only the author sees it, before publishing. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={`https://i.ytimg.com/vi/${video.youtubeId}/mqdefault.jpg`}
          alt={composerCopy.videoChip}
          onError={() => setStill(false)}
        />
      ) : null}
      <span className={styles.tileMark} data-alone={still ? undefined : ""} aria-hidden="true">
        <Icon name="video" size={20} />
      </span>
    </Tile>
  );
}

/** The author's own clip as a tile: its first frame, its length; «⋯» takes it off. */
function ClipTile({ clip, onRemove, onRetry }: { clip: ClipItem; onRemove: () => void; onRetry: () => void }) {
  return (
    <Tile
      kind="video"
      label={composerCopy.videoActions}
      status={clip.status}
      menu={[{ label: composerCopy.videoRemove, icon: "trash", onSelect: onRemove }]}
    >
      {/* The still is the file's own first frame; the author sees it before publishing. */}
      <video src={`${clip.preview}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
      <span className={styles.tileMark} aria-hidden="true">
        <Icon name="video" size={20} />
      </span>
      <span className={styles.tileClock}>{clockOf(clip.durationSec)}</span>
      {clip.status === "uploading" ? (
        <span
          className={styles.thumbProgress}
          role="progressbar"
          aria-label={composerCopy.clipUploading}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clip.progress * 100)}
        >
          <span style={{ inlineSize: `${Math.max(6, clip.progress * 100)}%` }} />
        </span>
      ) : null}
      {clip.status === "failed" ? (
        <button className={styles.thumbRetryAction} type="button" onClick={onRetry} title={clip.error}>
          {composerCopy.retry}
        </button>
      ) : null}
    </Tile>
  );
}

/** The audio as a tile: the microphone and its length; «⋯» plays it or takes it off. */
function AudioTile({ audio, onRemove, onRetry }: { audio: AudioItem; onRemove: () => void; onRetry: () => void }) {
  const player = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  function toggle() {
    const node = player.current;
    if (!node) return;
    if (node.paused) void node.play();
    else node.pause();
  }
  return (
    <Tile
      kind="audio"
      label={composerCopy.audioActions}
      status={audio.status}
      menu={[
        ...(audio.status === "done"
          ? [
              {
                label: playing ? composerCopy.audioPause : composerCopy.audioPlay,
                icon: "play" as const,
                onSelect: toggle,
              },
            ]
          : []),
        { label: composerCopy.audioRemove, icon: "trash", onSelect: onRemove },
      ]}
    >
      <span className={styles.tileAudio}>
        <Icon name="mic" size={24} />
        <span className={styles.tileClock}>{clockOf(audio.durationSec)}</span>
      </span>
      <audio
        ref={player}
        src={audio.preview}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      {audio.status === "uploading" ? (
        <span
          className={styles.thumbProgress}
          role="progressbar"
          aria-label={composerCopy.audioUploading}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(audio.progress * 100)}
        >
          <span style={{ inlineSize: `${Math.max(6, audio.progress * 100)}%` }} />
        </span>
      ) : null}
      {audio.status === "failed" ? (
        <button className={styles.thumbRetryAction} type="button" onClick={onRetry} title={audio.error}>
          {composerCopy.retry}
        </button>
      ) : null}
    </Tile>
  );
}

/* ─────────────────────────── video ─────────────────────────── */

/** The link field, in the menu of the video tool; a pasted link is checked as it would be on the server. */
export function VideoField({
  onAdd,
  onFile,
  onCancel,
}: {
  onAdd: (video: VideoItem) => void;
  /** The author's own file instead of a link. */
  onFile: (file: File) => void;
  onCancel: () => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  function add() {
    const youtubeId = youtubeIdFrom(value.trim());
    if (!youtubeId) {
      setError(composerCopy.videoInvalid);
      return;
    }
    onAdd({ youtubeId });
  }

  return (
    <div className={styles.inlineForm}>
      <div className={styles.inlineRow}>
        <input
          ref={input}
          className={styles.inlineInput}
          type="url"
          inputMode="url"
          value={value}
          aria-label={composerCopy.videoPlaceholder}
          placeholder={composerCopy.videoPlaceholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              add();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
          }}
        />
        <button className={styles.inlineAction} type="button" onClick={add}>
          {composerCopy.videoAdd}
        </button>
      </div>
      {error ? <p className={styles.fieldError}>{error}</p> : null}
      <button className={styles.inlineAction} type="button" onClick={() => picker.current?.click()}>
        {composerCopy.videoFile}
      </button>
      <p className={styles.fieldHint}>{composerCopy.videoFileHint}</p>
      <input
        ref={picker}
        className={styles.hiddenInput}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

/* ─────────────────────────── clip ─────────────────────────── */

/** A clip file's type as the server reads it, or null when the feed does not take it. */
function clipTypeOf(file: File): string | null {
  const bare = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (FEED_CLIP_TYPES[bare]) return bare;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "mp4" || ext === "m4v") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  return null;
}

export type ClipCheck =
  { ok: true; mime: string; durationSec: number; w: number; h: number; preview: string } | { ok: false; error: string };

/**
 * Whether a file is a clip the feed takes — type, size, length, frame — read
 * by the browser before a byte is sent. The server cannot read a video, so
 * this is where «до 30 с, Full HD» is actually looked at; the bucket's own
 * limits are what hold the line behind it.
 */
export function checkClipFile(file: File): Promise<ClipCheck> {
  const mime = clipTypeOf(file);
  if (!mime) return Promise.resolve({ ok: false, error: composerCopy.clipType });
  if (file.size > FEED_CLIP_MAX_BYTES) return Promise.resolve({ ok: false, error: composerCopy.clipBig });
  const preview = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const fail = (error: string) => {
      URL.revokeObjectURL(preview);
      video.removeAttribute("src");
      resolve({ ok: false, error });
    };
    video.onerror = () => fail(composerCopy.clipUnreadable);
    video.onloadedmetadata = () => {
      const { duration, videoWidth: w, videoHeight: h } = video;
      if (!Number.isFinite(duration) || duration <= 0 || !w || !h) return fail(composerCopy.clipUnreadable);
      if (duration > FEED_CLIP_MAX_SECONDS + 0.5) return fail(composerCopy.clipLong);
      if (Math.max(w, h) > FEED_CLIP_MAX_LONG || Math.min(w, h) > FEED_CLIP_MAX_SHORT) {
        return fail(composerCopy.clipLarge);
      }
      video.removeAttribute("src");
      resolve({ ok: true, mime, durationSec: Math.min(duration, FEED_CLIP_MAX_SECONDS), w, h, preview });
    };
    video.src = preview;
  });
}

/**
 * Sends a checked clip: asks for the one-time address, then puts the file
 * there with progress. Answers the path the post names.
 */
export async function uploadClip(
  file: File,
  mime: string,
  onProgress: (fraction: number) => void,
  asPlatform = false,
): Promise<FeedResult<{ path: string }>> {
  const signed = await signClip(mime, file.size, asPlatform);
  if (!signed.ok) return signed;
  const { path, uploadUrl } = signed.data;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sent = await new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("x-upsert", "false");
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(0.98, event.loaded / event.total));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.ontimeout = () => resolve(false);
    // The storage API's signed upload takes the file as a form, as its own client sends it.
    const form = new FormData();
    form.append("cacheControl", "31536000");
    form.append("", new File([file], "clip", { type: mime }));
    xhr.send(form);
  });
  if (!sent) return { ok: false, status: 502, code: "clip_upload_failed" };
  onProgress(1);
  return { ok: true, data: { path } };
}

/* ─────────────────────────── audio ─────────────────────────── */

/** What the browser records in, best first; the server takes the bare type. */
const RECORD_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];

function recordType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return RECORD_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

/** A file's type as the server reads it, or null when the feed does not take it. */
function audioTypeOf(file: File): string | null {
  const bare = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (FEED_AUDIO_TYPES[bare]) return bare;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "m4a") return "audio/mp4";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "webm") return "audio/webm";
  if (ext === "ogg" || ext === "oga") return "audio/ogg";
  return null;
}

/** The length of an audio file, read by the browser; null when it cannot say. */
function durationOf(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (value: number | null) => {
      audio.removeAttribute("src");
      resolve(value);
    };
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

/**
 * A file ready to upload, with its length — or the reason it is not one. The
 * bare type goes on the file: a recorder writes «audio/webm;codecs=opus», the
 * server's list holds «audio/webm».
 */
export async function prepareAudio(
  source: Blob,
  name: string,
  knownSeconds?: number,
): Promise<{ file: File; preview: string; durationSec: number } | { error: string }> {
  const asFile = source instanceof File ? source : new File([source], name, { type: source.type });
  const mime = audioTypeOf(asFile);
  if (!mime) return { error: composerCopy.audioType };
  if (asFile.size > FEED_AUDIO_MAX_BYTES) return { error: composerCopy.audioTooBig };
  const file = new File([asFile], name, { type: mime });
  const preview = URL.createObjectURL(file);
  const measured = knownSeconds ?? (await durationOf(preview));
  const durationSec = Math.max(1, Math.round(measured ?? 1));
  if (durationSec > FEED_AUDIO_MAX_SECONDS) {
    URL.revokeObjectURL(preview);
    return { error: composerCopy.audioTooLong };
  }
  return { file, preview, durationSec };
}

/**
 * Record from the microphone or pick a file. Recording stops itself at ten
 * minutes, the server's limit, rather than letting the author speak past it.
 */
export function AudioField({
  onReady,
  onError,
  onRecording,
}: {
  onReady: (audio: { file: File; preview: string; durationSec: number }) => void;
  onError: (message: string) => void;
  /** While it records, the menu around it must not close on a stray press. */
  onRecording?: (on: boolean) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const started = useRef(0);
  const picker = useRef<HTMLInputElement>(null);
  const canRecord = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && recordType() !== null;

  useEffect(() => onRecording?.(recording), [recording, onRecording]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const elapsed = (Date.now() - started.current) / 1000;
      setSeconds(elapsed);
      if (elapsed >= FEED_AUDIO_MAX_SECONDS) recorder.current?.stop();
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(
    () => () => {
      // Closing the composer mid-recording lets the microphone go.
      if (recorder.current?.state === "recording") {
        recorder.current.ondataavailable = null;
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function start() {
    if (!canRecord) {
      onError(composerCopy.micMissing);
      return;
    }
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError(composerCopy.micDenied);
      return;
    }
    stream.current = media;
    const type = recordType() || undefined;
    const rec = new MediaRecorder(media, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    rec.onstop = async () => {
      setRecording(false);
      media.getTracks().forEach((track) => track.stop());
      stream.current = null;
      const elapsed = (Date.now() - started.current) / 1000;
      const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      // A recorder's webm carries no duration in its header, so the clock is the length.
      const ready = await prepareAudio(blob, `audio.${ext}`, Math.min(elapsed, FEED_AUDIO_MAX_SECONDS));
      if ("error" in ready) onError(ready.error);
      else onReady(ready);
    };
    recorder.current = rec;
    started.current = Date.now();
    setSeconds(0);
    rec.start(1000);
    setRecording(true);
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    const ready = await prepareAudio(file, file.name || "audio");
    if ("error" in ready) onError(ready.error);
    else onReady(ready);
  }

  return (
    <div className={styles.inlineForm}>
      <div className={styles.inlineRow}>
        {recording ? (
          <>
            <span className={styles.recDot} aria-hidden="true" />
            <span className={styles.recClock} aria-live="polite">
              {composerCopy.audioRecording} {clockOf(seconds)}
            </span>
            <button className={styles.inlineAction} type="button" onClick={() => recorder.current?.stop()}>
              {composerCopy.audioStop}
            </button>
          </>
        ) : (
          <>
            {canRecord ? (
              <button className={styles.inlineAction} type="button" onClick={() => void start()}>
                {composerCopy.audioRecord}
              </button>
            ) : null}
            <button className={styles.inlineAction} type="button" onClick={() => picker.current?.click()}>
              {composerCopy.audioPick}
            </button>
            <span className={styles.muted}>{composerCopy.audioLimitHint}</span>
          </>
        )}
      </div>
      <input
        ref={picker}
        className={styles.hiddenInput}
        type="file"
        accept="audio/mp4,audio/x-m4a,audio/mpeg,audio/webm,audio/ogg,.m4a,.mp3,.webm,.ogg"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
