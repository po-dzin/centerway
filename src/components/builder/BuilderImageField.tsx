"use client";

/**
 * An image, put in either way an author actually has one.
 *
 * BOTH, NOT ONE. A link covers the image that is already somewhere — a file
 * shipped in `/public`, something on a CDN, a photo the author already hosts —
 * and copying it into a bucket would make a second original that can go stale.
 * An upload covers the case the builder could not serve at all until now: the
 * author has a file on their machine, and the old field answered that with a
 * text box asking for a path, which is asking a person to be a deployer.
 *
 * ONE VALUE UNDERNEATH. Both write the same `src` string, so nothing downstream
 * — the renderer, the export, the validator — has to know which door it came
 * through. The uploaded one is simply a link that this application made.
 *
 * WHAT THE AUTHOR IS TOLD. Since 2026-08-28 the route resizes and re-encodes,
 * so the file that arrives is not the file that is stored. That is worth one
 * line rather than a silent substitution: an author who uploads a 6 MB
 * photograph and later downloads a 180 KB WebP should have been told, once,
 * where the difference went.
 */

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";

import { MEDIA_SIZES, mediaSources } from "@/lib/lms/media";

import { RequiredMark } from "./BuilderFields";
import { uploadMedia } from "./builderClient";
import styles from "./Builder.module.css";

const FAILURES: Record<string, string> = {
  media_missing_file: "Файл не дійшов. Спробуйте ще раз.",
  media_missing_course: "Спершу збережіть курс — зображення кладеться в його теку.",
  media_expected_form_data: "Файл не дійшов. Спробуйте ще раз.",
  media_not_an_image: "Це не зображення — файл пошкоджений або має чуже розширення.",
  // Only an animation can be too big AFTER the pipeline: everything else is
  // re-encoded down. Saying so keeps the message actionable.
  media_encode_too_large: "Зображення не вдалося стиснути. Спробуйте інший файл.",
};

/** Kilobytes under a megabyte, megabytes above it — the way a person reads sizes. */
function weigh(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} КБ` : `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * WHAT THE FRAME NEEDS, checked against what arrived.
 *
 * The upload route already re-encodes to at most 1600px wide and never
 * ENLARGES (`withoutEnlargement`, mediaPipeline.ts), which is the whole reason
 * this check has to exist on the author's side: a 900px photograph is accepted,
 * stored, and quietly serves a hero that wants 1600. Nothing fails. It is just
 * soft on every screen bigger than a phone, and the author finds out from a
 * buyer.
 *
 * A warning, never a refusal. A small file is a real photograph the author has
 * and may have no better copy of — and the page renders. What they may not have
 * is not being told.
 */
export type ImageSpec = {
  /** The narrowest source that still fills its largest frame sharply. */
  minWidth: number;
  /** width ÷ height the frame will crop to, for the "this will be cropped hard" note. */
  ratio?: number;
  /** What to recommend, in the author's words: «1600×900». */
  recommended: string;
};

/** How far from the target ratio is worth mentioning. */
const RATIO_SLACK = 0.35;

function inspect(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const probe = new window.Image();
    probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
    // A cross-origin host that refuses us is not an error the author caused, so
    // it reads as "no measurement" rather than as a bad image.
    probe.onerror = () => resolve(null);
    probe.src = src;
  });
}

/** What is wrong with this file for this frame, or nothing. */
function describe(size: { width: number; height: number }, spec: ImageSpec): string | null {
  if (size.width < spec.minWidth) {
    return `Файл ${size.width}×${size.height} — вузький для цієї рамки. Рекомендовано ${spec.recommended}: інакше на великому екрані буде м'яко.`;
  }
  if (spec.ratio && Math.abs(size.width / size.height - spec.ratio) > RATIO_SLACK) {
    return `Пропорції ${size.width}×${size.height} далекі від рамки — кадр обріже значну частину. Оберіть фокус нижче або візьміть файл ближче до ${spec.recommended}.`;
  }
  return null;
}

function megabytes(detail: string): string {
  const bytes = Number(detail.split(":")[1]);
  return Number.isFinite(bytes) ? (bytes / (1024 * 1024)).toFixed(1) : "?";
}

/** The error codes the route returns carry their cause after a colon. */
function explain(detail: string | undefined): string {
  if (!detail) return "Не вдалося завантажити. Спробуйте ще раз.";
  if (detail.startsWith("media_too_large:")) {
    const mb = megabytes(detail);
    return `Завеликий файл — ${mb} МБ. Межа 20 МБ.`;
  }
  if (detail.startsWith("media_animation_too_large:")) {
    const mb = megabytes(detail);
    return `Анімація зберігається як є, тому межа для неї 5 МБ — а тут ${mb} МБ.`;
  }
  if (detail.startsWith("media_unsupported_type:")) {
    return "Такий формат не приймається. JPEG, PNG, WebP, GIF або AVIF.";
  }
  // Storage said no, or the ledger did. Either way the route removed whatever
  // reached the bucket, so the upload did not half-happen and a retry is the
  // whole of the advice. The cause after the colon is for the server log, not
  // for a person looking at a form.
  if (detail.startsWith("media_upload_failed:") || detail.startsWith("media_ledger_failed:")) {
    return "Сховище не прийняло файл. Спробуйте ще раз.";
  }
  return FAILURES[detail] ?? "Не вдалося завантажити. Спробуйте ще раз.";
}

export function BuilderImageField({
  label,
  hint,
  courseSlug,
  src,
  alt,
  spec,
  required,
  showPreview = true,
  onChange,
}: {
  label: string;
  hint?: string;
  /** Which course's folder an uploaded file lands in. */
  courseSlug: string;
  src: string | undefined;
  /** Rendered in the preview so the author sees what a screen reader will say. */
  alt?: string;
  /** What this particular frame needs. Absent means no measurement is taken. */
  spec?: ImageSpec;
  required?: true;
  /** Some editors render the image in its final frame instead of as an uncropped original. */
  showPreview?: boolean;
  onChange: (src: string | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  /* KEYED TO THE ADDRESS IT DESCRIBES, rather than cleared when the address
     changes. A note about the old file must not survive a new one for the render
     between the change and the measurement — and clearing it synchronously at
     the top of the effect is a cascading render React (and this repo's lint)
     rightly refuses. Storing WHICH src was measured answers both: a stale note
     simply stops matching and stops being rendered. */
  const [measured, setMeasured] = useState<{ src: string; note: string } | null>(null);
  const warning = measured && measured.src === src ? measured.note : null;

  /* MEASURED IN THE BROWSER, not from the upload result, and that is the point:
     half the covers in this builder arrive as a PASTED ADDRESS — a file already
     in /public, a CDN link — and never touch the upload route at all. Those are
     exactly the ones nobody checks. Loading the image is the only thing that
     knows how big it actually is, whichever door it came through. */
  useEffect(() => {
    if (!src || !spec) return;
    let live = true;
    void inspect(src).then((size) => {
      if (!live || !size || size.width === 0) return;
      const note = describe(size, spec);
      if (note) setMeasured({ src, note });
    });
    return () => {
      live = false;
    };
  }, [src, spec]);

  const send = async (file: File) => {
    setBusy(true);
    setNote(null);
    setReport(null);
    const result = await uploadMedia(courseSlug, file);
    setBusy(false);

    if (!result.ok) {
      setNote(explain(result.detail));
      return;
    }
    // Said once, in passing, and only when the pipeline actually changed
    // something worth mentioning — a file that was already small says nothing.
    const { bytes, sourceBytes, width } = result.data;
    if (bytes && sourceBytes && sourceBytes > bytes * 1.2) {
      setReport(`Стиснуто: ${weigh(sourceBytes)} → ${weigh(bytes)}${width ? `, ${width}px` : ""}`);
    }
    onChange(result.data.src);
  };

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {required ? <RequiredMark /> : null}
      </span>

      {src && showPreview ? (
        /* eslint-disable-next-line @next/next/no-img-element -- authored content, arbitrary remote hosts */
        <img
          className={styles.previewImage}
          {...mediaSources(src)}
          sizes={MEDIA_SIZES.figure}
          alt={alt ?? ""}
          decoding="async"
        />
      ) : null}

      <div className={styles.itemRow}>
        <input
          className={styles.input}
          type="text"
          inputMode="url"
          placeholder="/cw/… або https://…"
          aria-label={`${label} — адреса`}
          value={src ?? ""}
          // Empty is ABSENT, the rule every other field follows.
          onChange={(event) => onChange(event.target.value.trim() === "" ? undefined : event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        {src ? (
          <button
            className={styles.iconAction}
            type="button"
            title="Прибрати зображення"
            aria-label={`Прибрати ${label.toLowerCase()}`}
            onClick={() => onChange(undefined)}
          >
            <Icon name="close" size={18} />
          </button>
        ) : null}
      </div>

      {/* The picker is a button, not a bare file input: a native file input
          renders as an unstyleable control with its own English label, and this
          one has to sit in a row with a text field without looking like a
          different application. */}
      <div className={styles.addRow}>
        <button
          className={styles.quietAction}
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? "Завантажуємо…" : "Завантажити файл"}
        </button>
        <span className={styles.fieldHint}>або вставте адресу вище</span>
      </div>

      <input
        ref={input}
        className={styles.visuallyHidden}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared immediately so choosing the SAME file twice still fires a
          // change — the second pick is silently nothing otherwise.
          event.target.value = "";
          if (file) void send(file);
        }}
      />

      {note ? <span className={styles.fieldError}>{note}</span> : null}
      {/* A warning, not an error: the file is stored and the page renders. It
          sits above the hint so that the sentence about THIS file is read before
          the standing advice about files in general. */}
      {warning ? <span className={styles.fieldWarning}>{warning}</span> : null}
      {report ? <span className={styles.fieldHint}>{report}</span> : null}
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </div>
  );
}
