"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { CROP_SCALE_MIN, cropStyle } from "@/lib/media/imageCrop";
import type { Course } from "@/lms-core";
import { BuilderImageField, type ImageSpec } from "./BuilderImageField";
import styles from "./Builder.module.css";

/* Lazy for the reason the cabinet loads it lazily: it is a dialog behind a
   press, and an author who never crops a cover should not carry it. */
const CropEditor = dynamic(() => import("@/components/media/CropEditor").then((m) => m.CropEditor), { ssr: false });

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
  landscape: {
    className: "coverPreviewLandscape",
    axis: "both",
    note: "16:9 · картки і hero до 16:9",
    label: "Горизонтальний",
  },
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

/**
 * THE FRAME RESTS, THE EDITOR EDITS (2026-09-11).
 *
 * This box used to be both: the author dragged the photograph inside it and a
 * slider under it magnified. The cabinet abandoned exactly that arrangement on
 * 2026-09-06 and wrote down why — a frame filled by `cover` shows only what
 * SURVIVES the crop, so the one place a crop is chosen was the one place its
 * discards were invisible; and at 1× the fit is flush on one axis, so half the
 * drags moved nothing and were reported as a broken control. The course cover
 * kept the old tool, which meant the product had two answers to one question
 * and the better one was in the smaller surface.
 *
 * So this is now the resting frame — the picture exactly as the card, the hero
 * or the phone will print it — and pressing it opens `CropEditor`, the same
 * dialog the profile opens, which shows the WHOLE photograph with this frame
 * over it as a bright window. The shape is not retyped here either: the ratio
 * and the radius are read off this element, so the frame's CSS remains the one
 * declaration both the preview and the editor obey.
 */
function CropFrame({
  src,
  alt,
  format,
  x,
  y,
  scale,
  onOpen,
  onReset,
  reset,
}: {
  src: string;
  alt: string;
  format: CropFormat;
  x: number;
  y: number;
  scale: number;
  onOpen: (shape: { ratio: string; radius: string }) => void;
  /** Back to the middle at 1× — the default answer for a frame that owns its crop. */
  onReset: () => void;
  /** A frame that FOLLOWS another says so instead, and resets by forgetting. */
  reset?: { label: string; onReset: () => void };
}) {
  const frameRef = useRef<HTMLButtonElement | null>(null);
  const frame = FRAME[format];

  return (
    <div className={styles.coverPreviewStack}>
      <button
        ref={frameRef}
        className={styles[frame.className]}
        type="button"
        aria-label={`${frame.label} кадр. Відкрити кадрування.`}
        onClick={() => {
          const el = frameRef.current;
          if (!el) return;
          const css = getComputedStyle(el);
          onOpen({ ratio: css.aspectRatio, radius: css.borderRadius });
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- authored cover may use any public host */}
        <img src={src} alt={alt} style={cropStyle({ x, y, scale }, { x: 50, y: 50 })} draggable={false} />
      </button>
      <div className={styles.coverPreviewTools}>
        <span>{frame.note}</span>
        <button className={styles.coverResetAction} type="button" onClick={reset ? reset.onReset : onReset}>
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
  /* Which frame is being cropped, and the shape it handed over. One dialog for
     all three, like the cabinet's: three copies of an editor is how two of them
     fall behind the third. */
  const [cropping, setCropping] = useState<{
    format: CropFormat;
    ratio: string;
    radius: string;
  } | null>(null);

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
            <CropFrame
              src={cover.src}
              alt=""
              format="landscape"
              x={landscapeX}
              y={landscapeY}
              scale={landscapeScale}
              onOpen={(shape) => setCropping({ format: "landscape", ...shape })}
              onReset={() => {
                writeLandscapeCrop(50, 50);
                writeScale("cropScale")(CROP_SCALE_MIN);
              }}
            />
            <div className={styles.coverWideBlock}>
              <div className={styles.coverFormatHead}>
                <div>
                  <h4 id="cover-wide-title">Ширший за 16:9 екран</h4>
                  <p>Тут кадр ріже зверху і знизу — оберіть, що лишити</p>
                </div>
                <span className={styles.formatBadge}>{wideIsOwn ? "Свій кадр" : "Як основний"}</span>
              </div>
              <CropFrame
                src={cover.src}
                alt=""
                format="wide"
                x={landscapeX}
                y={wideY}
                scale={wideScale}
                onOpen={(shape) => setCropping({ format: "wide", ...shape })}
                onReset={clearWideCrop}
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
            <CropFrame
              src={cover.mobileSrc ?? cover.src}
              alt=""
              format="portrait"
              x={portraitX}
              y={portraitY}
              scale={portraitScale}
              onOpen={(shape) => setCropping({ format: "portrait", ...shape })}
              onReset={() => {
                writePortraitCrop(50, 50);
                writeScale("mobileCropScale")(CROP_SCALE_MIN);
              }}
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

      {/* THE SAME DIALOG THE CABINET OPENS. `axis="y"` for the ultra-wide hero:
          its horizontal crop is the card's by contract, so the window may only
          move up and down — an editor that let the hand drag x would be moving
          a number `writeWideCrop` then refuses to store. */}
      {cropping && cover?.src ? (
        <CropEditor
          src={cropping.format === "portrait" ? (cover.mobileSrc ?? cover.src) : cover.src}
          alt=""
          title={`${FRAME[cropping.format].label} кадр`}
          note={FRAME[cropping.format].note}
          ratio={cropping.ratio}
          radius={cropping.radius}
          axis={FRAME[cropping.format].axis === "y" ? "y" : "both"}
          x={cropping.format === "portrait" ? portraitX : landscapeX}
          y={cropping.format === "portrait" ? portraitY : cropping.format === "wide" ? wideY : landscapeY}
          scale={
            cropping.format === "portrait" ? portraitScale : cropping.format === "wide" ? wideScale : landscapeScale
          }
          onChange={
            cropping.format === "portrait"
              ? writePortraitCrop
              : cropping.format === "wide"
                ? writeWideCrop
                : writeLandscapeCrop
          }
          onScaleChange={writeScale(
            cropping.format === "portrait"
              ? "mobileCropScale"
              : cropping.format === "wide"
                ? "wideCropScale"
                : "cropScale",
          )}
          onReset={() => {
            if (cropping.format === "wide") {
              clearWideCrop();
              return;
            }
            if (cropping.format === "portrait") {
              writePortraitCrop(50, 50);
              writeScale("mobileCropScale")(CROP_SCALE_MIN);
              return;
            }
            writeLandscapeCrop(50, 50);
            writeScale("cropScale")(CROP_SCALE_MIN);
          }}
          onClose={() => setCropping(null)}
          labels={{
            stage: "Кадр. Перетягуйте вікно по фото або стрілками. Ctrl і колесо — масштаб.",
            zoom: "Масштаб",
            reset: cropping.format === "wide" ? "Як основний" : "По центру",
            done: "Готово",
            position: (x, y) => `Фокус: ${x}% по горизонталі, ${y}% по вертикалі`,
          }}
        />
      ) : null}
    </div>
  );
}
