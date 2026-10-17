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

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { accessToken } from "@/components/auth/authorizedFetch";
import { youtubeIdFrom } from "@/lms-core";
import { FEED_AUDIO_MAX_BYTES, FEED_AUDIO_MAX_SECONDS, FEED_AUDIO_TYPES } from "@/lib/feed/media";
import type { UploadedMedia } from "@/lib/feed/upload";

import { clockOf, composerCopy } from "./composerCopy";
import { ComposerPopover } from "./FeedComposerMenus";
import { uploadFeedMedia, type FeedResult } from "./feedApi";
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

export type AudioItem = {
  status: "uploading" | "done" | "failed";
  progress: number;
  preview: string;
  durationSec: number;
  file?: File;
  path?: string;
  mime?: string;
  error?: string;
};

export type VideoItem = { youtubeId: string };

/* ─────────────────────────── upload ─────────────────────────── */

export async function uploadWithProgress(
  file: File,
  onProgress: (fraction: number) => void,
): Promise<FeedResult<UploadedMedia>> {
  const token = await accessToken().catch(() => null);
  const first = await new Promise<FeedResult<UploadedMedia>>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/feed/media");
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
  if (!first.ok && first.status === 401 && token) return uploadFeedMedia(file);
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
  onSpoiler,
  onTag,
  onRemove,
  onRetry,
}: {
  item: PhotoItem;
  index: number;
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

export function PhotoStrip({
  photos,
  onSpoiler,
  onTag,
  onRemove,
  onRetry,
}: {
  photos: PhotoItem[];
  onSpoiler: (key: string) => void;
  onTag?: () => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <div className={`${styles.strip} cw-scroll-rail`}>
      {photos.map((item, index) => (
        <Thumb
          key={item.key}
          item={item}
          index={index}
          onSpoiler={() => onSpoiler(item.key)}
          onTag={onTag}
          onRemove={() => onRemove(item.key)}
          onRetry={() => onRetry(item.key)}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────── video ─────────────────────────── */

/** The link field, opened from the tools row; a pasted link is checked as it would be on the server. */
export function VideoField({ onAdd, onCancel }: { onAdd: (video: VideoItem) => void; onCancel: () => void }) {
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
        <button className={styles.iconAction} type="button" aria-label={composerCopy.close} onClick={onCancel}>
          <Icon name="close" size={20} />
        </button>
      </div>
      {error ? <p className={styles.fieldError}>{error}</p> : null}
    </div>
  );
}

export function VideoChip({ video, onRemove }: { video: VideoItem; onRemove: () => void }) {
  return (
    <div className={styles.mediaChip}>
      <span className={styles.mediaChipIcon} aria-hidden="true">
        <Icon name="video" size={20} />
      </span>
      <span className={styles.mediaChipText}>
        <b>{composerCopy.videoChip}</b>
        <span className={styles.muted}>youtu.be/{video.youtubeId}</span>
      </span>
      <button className={styles.iconAction} type="button" aria-label={composerCopy.videoRemove} onClick={onRemove}>
        <Icon name="close" size={20} />
      </button>
    </div>
  );
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
  onCancel,
  onError,
}: {
  onReady: (audio: { file: File; preview: string; durationSec: number }) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const started = useRef(0);
  const picker = useRef<HTMLInputElement>(null);
  const canRecord = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && recordType() !== null;

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
            <button className={styles.iconAction} type="button" aria-label={composerCopy.close} onClick={onCancel}>
              <Icon name="close" size={20} />
            </button>
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

export function AudioChip({
  audio,
  onRemove,
  onRetry,
}: {
  audio: AudioItem;
  onRemove: () => void;
  onRetry: () => void;
}) {
  return (
    <div className={styles.mediaChip} data-status={audio.status}>
      <span className={styles.mediaChipIcon} aria-hidden="true">
        <Icon name="mic" size={20} />
      </span>
      {audio.status === "done" ? (
        <audio className={styles.player} controls preload="metadata" src={audio.preview} />
      ) : (
        <span className={styles.mediaChipText}>
          <b>{audio.status === "failed" ? (audio.error ?? composerCopy.audioFailed) : composerCopy.audioUploading}</b>
          {audio.status === "uploading" ? (
            <span
              className={styles.barProgress}
              role="progressbar"
              aria-label={composerCopy.audioUploading}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(audio.progress * 100)}
            >
              <span style={{ inlineSize: `${Math.max(4, audio.progress * 100)}%` }} />
            </span>
          ) : null}
        </span>
      )}
      <span className={styles.durationChip}>{clockOf(audio.durationSec)}</span>
      {audio.status === "failed" ? (
        <button className={styles.inlineAction} type="button" onClick={onRetry}>
          {composerCopy.retry}
        </button>
      ) : null}
      <button className={styles.iconAction} type="button" aria-label={composerCopy.audioRemove} onClick={onRemove}>
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}
