"use client";

/**
 * The block or programme a post carries (G 2026-10-17).
 *
 * THE WHOLE CARD IS ONE LINK to the lesson's programme, with an arrow on its
 * right instead of the old «Відкрити програму» words; the link's box is
 * stretched over the card, so a press anywhere on it goes there.
 *
 * A BLOCK SHOWN WHOLE is drawn by the lesson renderer itself (`BlockRenderer`)
 * above that card — any of the thirteen block types, played, ticked and read
 * as in the lesson. It stays outside the link on purpose: a video's controls,
 * a checklist's boxes and a question's disclosure are presses of their own and
 * cannot live inside an anchor. An «уривок» is only words: the opening the
 * server sent, clamped inside the card.
 */

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/Icon";
import { BlockRenderer, type ChecklistState } from "@/components/lms/LessonBlocks";
import type { FeedAttachment as Attachment } from "@/lib/feed/server";

import { feedCopy } from "./copy";
import styles from "./Feed.module.css";

function attachmentIcon(attachment: Attachment) {
  if (attachment.kind === "program") return "guide" as const;
  if (attachment.media === "video") return "play" as const;
  if (attachment.media === "image") return "photo" as const;
  return "document" as const;
}

export function FeedAttachment({ attachment }: { attachment: Attachment }) {
  const [checklist, setChecklist] = useState<ChecklistState>({});
  const extra = [
    attachment.media === "video" ? feedCopy.video : attachment.media === "image" ? feedCopy.image : null,
    attachment.durationMin ? `${attachment.durationMin} ${feedCopy.minutes}` : null,
  ].filter(Boolean);
  const block = attachment.full ? attachment.block : null;
  const goLabel = attachment.kind === "program" ? feedCopy.openProgram : feedCopy.openLesson;

  const card = (
    <div className={styles.attach} data-link={attachment.href ? "" : undefined}>
      <span className={styles.attachIcon} aria-hidden="true">
        <Icon name={attachmentIcon(attachment)} size={20} />
      </span>
      <div className={styles.attachBody}>
        <p className={styles.attachTitle}>{attachment.title}</p>
        <p className={styles.attachMeta}>{[attachment.meta, ...extra].join(" · ")}</p>
        {!block && attachment.text ? (
          <p className={styles.attachText} data-excerpt={attachment.full ? undefined : ""}>
            {attachment.text}
          </p>
        ) : null}
      </div>
      {attachment.href ? (
        <Link
          className={styles.attachGo}
          href={attachment.href}
          aria-label={`${goLabel}: ${attachment.title}`}
          title={goLabel}
        >
          <Icon name="arrow-right" size={20} />
        </Link>
      ) : null}
    </div>
  );

  if (!block) return card;
  return (
    <div className={styles.attachWhole}>
      <div className={styles.attachBlock}>
        <BlockRenderer
          block={block}
          checklist={checklist}
          onToggleChecklistItem={(id, checked) => setChecklist((current) => ({ ...current, [id]: checked }))}
          courseSlug={attachment.courseSlug ?? undefined}
        />
      </div>
      {card}
    </div>
  );
}
