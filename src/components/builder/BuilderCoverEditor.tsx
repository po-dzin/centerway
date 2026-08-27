"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Icon } from "@/components/Icon";
import type { Course } from "@/lms-core";
import { BuilderImageField } from "./BuilderImageField";
import styles from "./Builder.module.css";

type CropPreviewProps = {
  src: string;
  alt: string;
  format: CropFormat;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
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

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function CropPreview({ src, alt, format, x, y, onChange, reset }: CropPreviewProps & { reset?: { label: string; onReset: () => void } }) {
  const activePointer = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const frame = FRAME[format];
  const horizontal = frame.axis === "both";

  const moveByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 2;
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
        aria-label={`${frame.label} кадр. Перетягуйте точку фокуса або використовуйте стрілки.`}
        onKeyDown={moveByKey}
        onPointerDown={beginDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- authored cover may use any public host */}
        <img src={src} alt={alt} style={{ objectPosition: `${x}% ${y}%` }} draggable={false} />
        <span
          className={styles.coverFocusHandle}
          style={{ left: horizontal ? `${x}%` : "50%", top: `${y}%` }}
          aria-hidden="true"
        >
          <Icon name="grip" size={20} />
        </span>
      </div>
      <div className={styles.coverPreviewTools}>
        <span>{frame.note}</span>
        <button
          className={styles.coverResetAction}
          type="button"
          onClick={reset ? reset.onReset : () => onChange(50, 50)}
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
  const wideIsOwn = cover?.wideCropY !== undefined;

  const writeLandscapeCrop = (x: number, y: number) => {
    onChange(["cover", "cropX"], x);
    onChange(["cover", "cropY"], y);
  };

  /* Undefined, not the current number: absent means "follow the main frame", and
     writing the number instead would freeze today's value into the file and stop
     following it the next time the author moves the main focus. */
  const writeWideCrop = (_x: number, y: number) => onChange(["cover", "wideCropY"], y);
  const clearWideCrop = () => onChange(["cover", "wideCropY"], undefined);

  const writePortraitCrop = (x: number, y: number) => {
    onChange(["cover", "mobileCropX"], x);
    onChange(["cover", "mobileCropY"], y);
  };

  return (
    <div className={styles.coverEditor}>
      <BuilderImageField
        label="Горизонтальна обкладинка"
        hint="Основний файл для вітрини, майстерні, бібліотеки та профілю. Рекомендовано 1600×900 або більше."
        courseSlug={course.slug}
        src={cover?.src}
        alt={cover?.alt}
        showPreview={false}
        onChange={(next) => onChange(["cover", "src"], next)}
      />

      {cover?.src ? (
        <div className={styles.coverFormatGrid}>
          <section className={styles.coverFormatPanel} aria-labelledby="cover-landscape-title">
            <div className={styles.coverFormatHead}>
              <div>
                <h4 id="cover-landscape-title">Картки</h4>
                <p>Вітрина · майстерня · бібліотека · профіль</p>
              </div>
              <span className={styles.formatBadge}>Основний</span>
            </div>
            <CropPreview
              src={cover.src}
              alt=""
              format="landscape"
              x={landscapeX}
              y={landscapeY}
              onChange={writeLandscapeCrop}
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
                onChange={writeWideCrop}
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
              onChange={writePortraitCrop}
            />
            <BuilderImageField
              label="Окреме вертикальне фото — необовʼязково"
              hint="Якщо не завантажувати, hero автоматично кадрує горизонтальну обкладинку. Рекомендовано 1080×1920."
              courseSlug={course.slug}
              src={cover.mobileSrc}
              alt={cover.alt}
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
