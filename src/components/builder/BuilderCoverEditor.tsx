"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Icon } from "@/components/Icon";
import type { Course } from "@/lms-core";
import { BuilderImageField } from "./BuilderImageField";
import styles from "./Builder.module.css";

type CropPreviewProps = {
  src: string;
  alt: string;
  format: "landscape" | "portrait";
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function CropPreview({ src, alt, format, x, y, onChange }: CropPreviewProps) {
  const activePointer = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const moveByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 2;
    if (event.key === "ArrowLeft") onChange(clamp(x - step), y);
    else if (event.key === "ArrowRight") onChange(clamp(x + step), y);
    else if (event.key === "ArrowUp") onChange(x, clamp(y - step));
    else if (event.key === "ArrowDown") onChange(x, clamp(y + step));
    else return;
    event.preventDefault();
  };

  const placeFocus = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onChange(
      clamp(((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 100),
      clamp(((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 100)
    );
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
        className={format === "landscape" ? styles.coverPreviewLandscape : styles.coverPreviewPortrait}
        data-dragging={dragging || undefined}
        tabIndex={0}
        aria-label={`${format === "landscape" ? "Горизонтальний" : "Вертикальний"} кадр. Перетягуйте точку фокуса або використовуйте стрілки.`}
        onKeyDown={moveByKey}
        onPointerDown={beginDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- authored cover may use any public host */}
        <img src={src} alt={alt} style={{ objectPosition: `${x}% ${y}%` }} draggable={false} />
        <span className={styles.coverFocusHandle} style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true">
          <Icon name="grip" size={20} />
        </span>
      </div>
      <div className={styles.coverPreviewTools}>
        <span>{format === "landscape" ? "16:9 · усі картки" : "9:16 · hero на mobile"}</span>
        <button className={styles.coverResetAction} type="button" onClick={() => onChange(50, 50)}>
          По центру
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

  const writeLandscapeCrop = (x: number, y: number) => {
    onChange(["cover", "cropX"], x);
    onChange(["cover", "cropY"], y);
  };

  const writePortraitCrop = (x: number, y: number) => {
    onChange(["cover", "mobileCropX"], x);
    onChange(["cover", "mobileCropY"], y);
  };

  return (
    <div className={styles.coverEditor}>
      <BuilderImageField
        label="Горизонтальна обкладинка"
        hint="Основний файл для вітрини, білдера, бібліотеки та профілю. Рекомендовано 1600×900 або більше."
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
                <p>Вітрина · білдер · бібліотека · профіль</p>
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
