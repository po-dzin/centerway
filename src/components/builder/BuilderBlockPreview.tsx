"use client";

/**
 * What the field table cannot show.
 *
 * Most blocks ARE their fields — a paragraph typed into a textarea looks like
 * the paragraph. Three do not, and each fails differently:
 *
 *   · a video is an eleven-character id, and the only way to know it is the
 *     right video is to see the video;
 *   · an image is a path, and a path that 404s looks exactly like one that
 *     works until someone loads it;
 *   · a table read as «Рядок 2, колонка 3» twelve times over is not a table
 *     an author can check — the whole point of the shape is the grid.
 *
 * So the preview is scoped to those three. A full lesson preview is a different
 * feature and a bigger one: it would need the learner's renderer, the learner's
 * stylesheet and the learner's progress state, and half a preview — right text,
 * wrong material — is a worse guide than none.
 *
 * Nothing is loaded for a value still carrying `[ЗАПОВНИ`. A marker is not a
 * path, and firing a request at one produces a broken-image icon that reads as
 * "your image is wrong" when the truth is "you have not chosen one yet".
 */

import { inlineToPlainText, PLACEHOLDER_MARKER, type LessonBlock } from "@/lms-core";
import styles from "./Builder.module.css";

function unfilled(value: string | undefined): boolean {
  return !value || value.includes(PLACEHOLDER_MARKER);
}

export function BlockPreview({ block }: { block: LessonBlock }) {
  if (block.type === "video") {
    if (unfilled(block.videoId)) {
      return <p className={styles.previewEmpty}>Вкажіть ID відео — тут з&apos;явиться програвач.</p>;
    }
    return (
      <iframe
        className={styles.previewMedia}
        src={`https://www.youtube-nocookie.com/embed/${block.videoId}`}
        title={block.title ? inlineToPlainText(block.title) : "Відео уроку"}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    );
  }

  if (block.type === "image") {
    if (unfilled(block.src)) {
      return <p className={styles.previewEmpty}>Вкажіть шлях — тут з&apos;явиться зображення.</p>;
    }
    return (
      // Plain <img>: authored content points at arbitrary hosts, and next/image
      // would need every one of them configured before it rendered at all.
      // eslint-disable-next-line @next/next/no-img-element
      <img className={styles.previewImage} src={block.src} alt={block.alt ?? ""} loading="lazy" />
    );
  }

  if (block.type === "table") {
    return (
      <div className={styles.previewTableWrap}>
        <table className={styles.previewTable}>
          {block.head ? (
            <thead>
              <tr>
                {block.head.map((cell, index) => (
                  <th key={index} scope="col">
                    {inlineToPlainText(cell)}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{inlineToPlainText(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === "code") {
    return <pre className={styles.previewCode}><code>{block.code}</code></pre>;
  }

  return null;
}
