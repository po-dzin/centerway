"use client";

/**
 * The block or programme a post carries (G 2026-10-17).
 *
 * THE WHOLE CARD IS ONE LINK to the lesson's programme, with an arrow on its
 * right instead of the old «Відкрити програму» words; the link's box is
 * stretched over the card, so a press anywhere on it goes there.
 *
 * A BLOCK SHOWN WHOLE is drawn by the lesson renderer itself (`BlockRenderer`)
 * — any of the thirteen block types, played, ticked and read as in the lesson
 * — with the arrow beside it and nothing else (G 2026-10-17: «навіщо шлях
 * блоку, якщо треба показувати блок»). The card with the title and «Шлях 21 ·
 * день 3» under it said again what the block already shows; where it comes
 * from is asked while choosing, not repeated to the reader. The arrow is not
 * stretched here: a video's controls, a checklist's boxes and a question's
 * disclosure are presses of their own and cannot live inside an anchor.
 *
 * An «уривок» is only words — the opening the server sent, clamped inside the
 * card — so it keeps the title and the programme it is from.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";

import { useSession } from "@/components/auth/SessionProvider";
import { Icon } from "@/components/Icon";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { BlockRenderer, type ChecklistState } from "@/components/lms/LessonBlocks";
import type { FeedAttachment as Attachment } from "@/lib/feed/server";

import { feedCopy } from "./copy";
import { fetchAttachmentHref } from "./feedApi";
import styles from "./Feed.module.css";

function attachmentIcon(attachment: Attachment) {
  if (attachment.kind === "program") return "guide" as const;
  if (attachment.media === "video") return "play" as const;
  if (attachment.media === "image") return "photo" as const;
  return "document" as const;
}

export function FeedAttachment({
  attachment,
  postId,
  preview = false,
}: {
  attachment: Attachment;
  /** The post it belongs to: the arrow asks it where this reader goes. Absent in the composer. */
  postId?: string;
  /** The composer's copy: drawn as the feed will draw it, but the arrow leads nowhere yet. */
  preview?: boolean;
}) {
  const [checklist, setChecklist] = useState<ChecklistState>({});
  const router = useRouter();
  const surfaceHref = useSurfaceHref();
  const { session } = useSession();

  /* The link already holds the programme's page — the way for a guest and for
     a reader without the course. A signed-in reader is asked where they go:
     inside the course when they have it. A new tab or a modified click keeps
     the plain link. */
  async function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (!postId || !session?.user) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const result = await fetchAttachmentHref(postId);
    const path = result.ok ? result.data.href : attachment.href;
    if (!path) return;
    const target = surfaceHref(path);
    if (target.startsWith("/")) router.push(target);
    else window.location.assign(target);
  }
  const extra = [
    attachment.media === "video" ? feedCopy.video : attachment.media === "image" ? feedCopy.image : null,
    attachment.durationMin ? `${attachment.durationMin} ${feedCopy.minutes}` : null,
  ].filter(Boolean);
  const block = attachment.full ? attachment.block : null;
  const goLabel = attachment.kind === "program" ? feedCopy.openProgram : feedCopy.openLesson;
  const go = !attachment.href ? null : preview ? (
    <span className={styles.attachGo} aria-hidden="true">
      <Icon name="arrow-right" size={20} />
    </span>
  ) : (
    <Link
      className={styles.attachGo}
      href={attachment.href}
      aria-label={`${goLabel}: ${attachment.title}`}
      title={goLabel}
      onClick={(event) => void follow(event)}
    >
      <Icon name="arrow-right" size={20} />
    </Link>
  );

  if (block) {
    return (
      <div className={styles.attachWhole} data-link={go ? "" : undefined}>
        <div className={styles.attachBlock}>
          <BlockRenderer
            block={block}
            checklist={checklist}
            onToggleChecklistItem={(id, checked) => setChecklist((current) => ({ ...current, [id]: checked }))}
            courseSlug={attachment.courseSlug ?? undefined}
          />
        </div>
        {go}
      </div>
    );
  }

  return (
    <div className={styles.attach} data-link={go ? "" : undefined}>
      <span className={styles.attachIcon} aria-hidden="true">
        <Icon name={attachmentIcon(attachment)} size={20} />
      </span>
      <div className={styles.attachBody}>
        <p className={styles.attachTitle}>{attachment.title}</p>
        <p className={styles.attachMeta}>{[attachment.meta, ...extra].join(" · ")}</p>
        {attachment.text ? (
          <p className={styles.attachText} data-excerpt={attachment.full ? undefined : ""}>
            {attachment.text}
          </p>
        ) : null}
      </div>
      {go}
    </div>
  );
}
