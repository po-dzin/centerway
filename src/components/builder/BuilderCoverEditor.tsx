"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Icon } from "@/components/Icon";
import { CropZoom, cropKeyZoom, cropWheelZoom } from "@/components/media/CropZoom";
import { CROP_SCALE_MIN, cropStyle } from "@/lib/media/imageCrop";
import type { Course } from "@/lms-core";
import { BuilderImageField, type ImageSpec } from "./BuilderImageField";
import styles from "./Builder.module.css";

type CropPreviewProps = {
  src: string;
  alt: string;
  format: CropFormat;
  x: number;
  y: number;
  /** 1–4. The frame's own magnification — see src/lib/media/imageCrop.ts. */
  scale: number;
  onChange: (x: number, y: number) => void;
  onScaleChange: (scale: number) => void;
};

/**
 * The frames an authored cover is actually read through, and the platform's own
 * hero framing contract decides which is which (PlatformBlocksOrientation.module.css):
 *
 *  - `landscape`  the 16:9 card, and the desktop hero up to 16:9
 *  - `wide`       the same hero past 16:9, where the crop turns vertical hard
 *                 enough to need its own answer — so this frame moves y only
 *  - `portrait`   the mobile hero, on the portrait master where there is one
 *
 * Showing all three is the point. One 16:9 box was a promise the platform does
 * not keep: `cover` picks the axis it crops from the shape of the screen, and a
 * focal point that centres the subject on a laptop can push it off an ultra-wide.
 */
type CropFormat = "landscape" | "wide" | "portrait";

const FRAME = {
  landscape: { className: "coverPreviewLandscape", axis: "both", note: "16:9 · картки і hero до 16:9", label: "Горизонтальний" },
  wide: { className: "coverPreviewWide", axis: "y", note: "21:9 · hero на широкому екрані", label: "Широкий" },
  portrait: { className: "coverPreviewPortrait", axis: "both", note: "9:16 · hero на mobile", label: "Вертикальний" },
} as const;

/**
 * What each master actually has to be, and why those numbers.
 *
 * MODULE-LEVEL, not written inline at the call site — the field measures the
 * image in an effect keyed on this object, and a fresh literal every render
 * would re-measure the same file forever.
 *
 * 1600 is not a preference: it is `FULL_WIDTH` in `mediaPipeline.ts`, the
 * widest rendition the upload route produces, and it never enlarges. Asking for
 * more is asking for a file the pipeline will throw away; accepting less is
 * accepting a soft hero on any laptop.
 */
const LANDSCAPE_SPEC: ImageSpec = { minWidth: 1600, ratio: 16 / 9, recommended: "1600×900" };

/* The portrait master is bounded by the same 1600px ceiling, so its useful
   height caps around 1920 at 9:16 — «1080×1920» is what an author's phone
   actually produces and is comfortably above the floor. */
const PORTRAIT_SPEC: ImageSpec = { minWidth: 1080, ratio: 9 / 16, recommended: "1080×1920" };

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function CropPreview({ src, alt, format, x, y, scale, onChange, onScaleChange, reset }: CropPreviewProps & { reset?: { label: string; onReset: () => void } }) {
  const activePointer = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const frame = FRAME[format];
  const horizontal = frame.axis === "both";

  const moveByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 2;
    if (cropKeyZoom(scale, event.key, onScaleChange)) {
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft" && horizontal) onChange(clamp(x - step), y);
    else if (event.key === "ArrowRight" && horizontal) onChange(clamp(x + step), y);
    else if (event.key === "ArrowUp") onChange(x, clamp(y - step));
    else if (event.key === "ArrowDown") onChange(x, clamp(y + step));
    else return;
    event.preventDefault();
  };

  const placeFocus = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextY = clamp(((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 100);
    if (!horizontal) {
      onChange(x, nextY);
      return;
    }
    onChange(clamp(((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 100), nextY);
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

  return (
    <div className={styles.coverPreviewStack}>
      <div
        className={styles[frame.className]}
        data-dragging={dragging || undefined}
        tabIndex={0}
        aria-label={`${frame.label} кадр. Перетягуйте точку фокуса або використовуйте стрілки. Ctrl і колесо — масштаб.`}
        onKeyDown={moveByKey}
        onWheel={(event) => cropWheelZoom(scale, event, onScaleChange)}
        onPointerDown={beginDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- authored cover may use any public host */}
        <img src={src} alt={alt} style={cropStyle({ x, y, scale }, { x: 50, y: 50 })} draggable={false} />
        <span
          className={styles.coverFocusHandle}
          style={{ left: horizontal ? `${x}%` : "50%", top: `${y}%` }}
          aria-hidden="true"
        >
          <Icon name="grip" size={20} />
        </span>
      </div>
      {/* THE ZOOM SITS UNDER ITS OWN FRAME, not once for the editor. A course
          reads through three shapes and an author zooms for a reason that
          belongs to one of them — pulling the wide hero in on a face does not
          mean pulling the card in on the same face. One slider governing all
          three would be a fourth answer none of the three asked for. */}
      <CropZoom
        value={scale}
        onChange={onScaleChange}
        label={`Масштаб — ${frame.label.toLowerCase()} кадр`}
        classes={{ row: styles.coverZoomRow, input: styles.coverZoomInput, value: styles.coverZoomValue }}
      />
      <div className={styles.coverPreviewTools}>
        <span>{frame.note}</span>
        <button
          className={styles.coverResetAction}
          type="button"
          onClick={
            reset
              ? reset.onReset
              : () => {
                  onChange(50, 50);
                  onScaleChange(CROP_SCALE_MIN);
                }
          }
        >
          {reset ? reset.label : "По центру"}
        </button>
      </div>
    </div>
  );
}

export function BuilderCoverEditor({
  course,
  onChange,
}: {
  course: Course;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  const cover = course.cover;
  const landscapeX = cover?.cropX ?? 50;
  const landscapeY = cover?.cropY ?? 50;
  const portraitX = cover?.mobileCropX ?? landscapeX;
  const portraitY = cover?.mobileCropY ?? landscapeY;
  const wideY = cover?.wideCropY ?? landscapeY;
  const landscapeScale = cover?.cropScale ?? CROP_SCALE_MIN;
  const portraitScale = cover?.mobileCropScale ?? landscapeScale;
  const wideScale = cover?.wideCropScale ?? landscapeScale;
  const wideIsOwn = cover?.wideCropY !== undefined || cover?.wideCropScale !== undefined;

  const writeLandscapeCrop = (x: number, y: number) => {
    onChange(["cover", "cropX"], x);
    onChange(["cover", "cropY"], y);
  };

  /* Undefined, not the current number: absent means "follow the main frame", and
     writing the number instead would freeze today's value into the file and stop
     following it the next time the author moves the main focus. */
  const writeWideCrop = (_x: number, y: number) => onChange(["cover", "wideCropY"], y);
  const clearWideCrop = () => {
    onChange(["cover", "wideCropY"], undefined);
    onChange(["cover", "wideCropScale"], undefined);
  };

  const writePortraitCrop = (x: number, y: number) => {
    onChange(["cover", "mobileCropX"], x);
    onChange(["cover", "mobileCropY"], y);
  };

  /* `undefined` at 1× rather than the number 1, for the reason `writeWideCrop`
     gives above and one more: a cover whose scale is stored as 1 is a cover
     that has opted out of ever following a changed default. Absent is the only
     value that keeps meaning "no zoom" instead of "this much zoom, forever". */
  const writeScale = (key: "cropScale" | "wideCropScale" | "mobileCropScale") => (scale: number) =>
    onChange(["cover", key], scale > CROP_SCALE_MIN ? scale : undefined);

  return (
    <div className={styles.coverEditor}>
      <BuilderImageField
        label="Горизонтальна обкладинка"
        hint="Основний файл для вітрини, майстерні, бібліотеки та кабінету. Рекомендовано 1600×900 або більше; JPEG, PNG, WebP, AVIF або GIF, до 20 МБ. Ширші за 1600 px стискаються — це нормально."
        courseSlug={course.slug}
        src={cover?.src}
        alt={cover?.alt}
        spec={LANDSCAPE_SPEC}
        required
        showPreview={false}
        onChange={(next) => onChange(["cover", "src"], next)}
      />

      {cover?.src ? (
        <div className={styles.coverFormatGrid}>
          <section className={styles.coverFormatPanel} aria-labelledby="cover-landscape-title">
            <div className={styles.coverFormatHead}>
              <div>
                <h4 id="cover-landscape-title">Картки</h4>
                <p>Вітрина · майстерня · бібліотека · кабінет</p>
              </div>
              <span className={styles.formatBadge}>Основний</span>
            </div>
            <CropPreview
              src={cover.src}
              alt=""
              format="landscape"
              x={landscapeX}
              y={landscapeY}
              scale={landscapeScale}
              onChange={writeLandscapeCrop}
              onScaleChange={writeScale("cropScale")}
            />
            <div className={styles.coverWideBlock}>
              <div className={styles.coverFormatHead}>
                <div>
                  <h4 id="cover-wide-title">Ширший за 16:9 екран</h4>
                  <p>Тут кадр ріже зверху і знизу — оберіть, що лишити</p>
                </div>
                <span className={styles.formatBadge}>{wideIsOwn ? "Свій кадр" : "Як основний"}</span>
              </div>
              <CropPreview
                src={cover.src}
                alt=""
                format="wide"
                x={landscapeX}
                y={wideY}
                scale={wideScale}
                onChange={writeWideCrop}
                onScaleChange={writeScale("wideCropScale")}
                reset={{ label: "Як основний", onReset: clearWideCrop }}
              />
            </div>
          </section>

          <section className={styles.coverFormatPanel} aria-labelledby="cover-portrait-title">
            <div className={styles.coverFormatHead}>
              <div>
                <h4 id="cover-portrait-title">Сторінка курсу на mobile</h4>
                <p>{cover.mobileSrc ? "Окремий вертикальний файл" : "Автокроп основної обкладинки"}</p>
              </div>
              <span className={styles.formatBadge}>{cover.mobileSrc ? "Окреме фото" : "Автокроп"}</span>
            </div>
            <CropPreview
              src={cover.mobileSrc ?? cover.src}
              alt=""
              format="portrait"
              x={portraitX}
              y={portraitY}
              scale={portraitScale}
              onChange={writePortraitCrop}
              onScaleChange={writeScale("mobileCropScale")}
            />
            <BuilderImageField
              label="Окреме вертикальне фото — необовʼязково"
              hint="Якщо не завантажувати, hero автоматично кадрує горизонтальну обкладинку. Рекомендовано 1080×1920."
              courseSlug={course.slug}
              src={cover.mobileSrc}
              alt={cover.alt}
              spec={PORTRAIT_SPEC}
              showPreview={false}
              onChange={(next) => onChange(["cover", "mobileSrc"], next)}
            />
          </section>
        </div>
      ) : (
        <p className={styles.coverEditorEmpty}>Додайте основне фото — тут одразу зʼявляться два редаговані формати.</p>
      )}
    </div>
  );
}
