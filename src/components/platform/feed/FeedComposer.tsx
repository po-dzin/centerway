"use client";

/**
 * A new post, written where it will be read (G, 16.10: authors post from the
 * feed page; the workshop has no editor of its own). Only a listed author sees
 * this card.
 *
 * The author picks the topic, one of the catalogue's eight; may carry one block
 * of their own programme, whole or as an opening with the programme's button,
 * or the programme itself. What passes the automatic check goes out at once;
 * what it stops waits for the team, and the author reads why right here and in
 * «Мої дописи».
 */

import { useMemo, useState, type FormEvent } from "react";

import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { COURSE_CATEGORY_ICONS, COURSE_CATEGORY_LABELS } from "@/lib/platform/catalogVocabulary";
import { FEED_POST_MAX, FEED_TOPICS, type FeedTopic } from "@/lib/feed/model";
import type { ComposerCourse, FeedAuthor, FeedPost } from "@/lib/feed/server";

import { feedCopy } from "./copy";
import { createPost, resubmitPost, type NewPost, type PostFinding } from "./feedApi";
import styles from "./Feed.module.css";

type Attach = "none" | "block" | "program";

export type ComposerDraft = {
  id: string;
  body: string;
  topic: FeedTopic;
  courseId: string | null;
  lessonId: string | null;
  blockId: string | null;
  full: boolean;
};

export function FeedComposer({
  author,
  courses,
  draft,
  onDone,
  onCancel,
}: {
  author: FeedAuthor;
  courses: ComposerCourse[];
  /** A returned post being sent again; absent for a new one. */
  draft?: ComposerDraft;
  onDone: (post: FeedPost) => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const [body, setBody] = useState(draft?.body ?? "");
  const [topic, setTopic] = useState<FeedTopic | null>(draft?.topic ?? null);
  const [attach, setAttach] = useState<Attach>(draft?.blockId ? "block" : draft?.courseId ? "program" : "none");
  const [courseId, setCourseId] = useState<string>(draft?.courseId ?? courses[0]?.id ?? "");
  const [lessonId, setLessonId] = useState<string>(draft?.lessonId ?? "");
  const [blockId, setBlockId] = useState<string>(draft?.blockId ?? "");
  const [full, setFull] = useState(draft?.full ?? true);
  const [sending, setSending] = useState(false);
  const [findings, setFindings] = useState<PostFinding[]>([]);

  const course = courses.find((entry) => entry.id === courseId) ?? null;
  const lessons = useMemo(() => course?.lessons.filter((lesson) => lesson.blocks.length > 0) ?? [], [course]);
  const lesson = lessons.find((entry) => entry.id === lessonId) ?? lessons[0] ?? null;
  const block = lesson?.blocks.find((entry) => entry.id === blockId) ?? lesson?.blocks[0] ?? null;

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    if (!body.trim()) {
      toast.error(feedCopy.needText);
      return;
    }
    if (!topic) {
      toast.error(feedCopy.needTopic);
      return;
    }
    const input: NewPost = { body, topic };
    if (attach !== "none" && course) input.courseId = course.id;
    if (attach === "block" && lesson && block) {
      input.lessonId = lesson.id;
      input.blockId = block.id;
      input.blockDisplay = full ? "full" : "excerpt";
    }
    setSending(true);
    const result = draft ? await resubmitPost(draft.id, input) : await createPost(input);
    setSending(false);
    if (!result.ok) {
      toast.error(feedCopy.publishFailed);
      return;
    }
    setFindings(result.data.findings);
    if (result.data.post.status === "published") {
      toast.success(feedCopy.published);
      setBody("");
      setTopic(null);
      setAttach("none");
      setFindings([]);
    } else {
      toast.info(feedCopy.held);
    }
    onDone(result.data.post);
  }

  return (
    <form className={styles.composer} aria-label={feedCopy.composerLabel} onSubmit={publish}>
      <div className={styles.byline}>
        <AuthorPortrait
          className={styles.face}
          photo={author.photo}
          size="sm"
          fallback={author.name.trim().charAt(0).toUpperCase()}
        />
        <div className={styles.who}>
          <p className={styles.whoName}>
            {author.name}
            <span className={styles.tag}>{draft ? "повторно" : "новий допис"}</span>
          </p>
          <p className={styles.when}>{feedCopy.composerHint}</p>
        </div>
      </div>

      <textarea
        className={styles.composerField}
        aria-label="Текст допису"
        placeholder={feedCopy.composerPlaceholder}
        maxLength={FEED_POST_MAX}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />

      {findings.length > 0 ? (
        <ul className={styles.findings} role="note">
          {findings.map((finding) => (
            <li key={`${finding.rule}-${finding.detail}`}>
              <strong>{finding.label}:</strong> {finding.detail}
            </li>
          ))}
        </ul>
      ) : null}

      {courses.length > 0 ? (
        <div className={styles.composerRow} role="group" aria-label="Вкладення">
          {(
            [
              ["none", feedCopy.attachNone],
              ["block", feedCopy.attachBlock],
              ["program", feedCopy.attachProgram],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={styles.topicChip}
              type="button"
              aria-pressed={attach === key}
              onClick={() => setAttach(key)}
            >
              {key === "none" ? null : <Icon name="plus" size={20} />}
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {attach !== "none" && courses.length > 0 ? (
        <div className={styles.blockPicker}>
          <select
            className={styles.select}
            aria-label={feedCopy.pickCourse}
            value={course?.id ?? ""}
            onChange={(event) => {
              setCourseId(event.target.value);
              setLessonId("");
              setBlockId("");
            }}
          >
            {courses.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
          {attach === "block" ? (
            lessons.length > 0 ? (
              <>
                <select
                  className={styles.select}
                  aria-label={feedCopy.pickLesson}
                  value={lesson?.id ?? ""}
                  onChange={(event) => {
                    setLessonId(event.target.value);
                    setBlockId("");
                  }}
                >
                  {lessons.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title}
                    </option>
                  ))}
                </select>
                <select
                  className={styles.select}
                  aria-label={feedCopy.pickBlock}
                  value={block?.id ?? ""}
                  onChange={(event) => setBlockId(event.target.value)}
                >
                  {(lesson?.blocks ?? []).map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label || entry.kind}
                    </option>
                  ))}
                </select>
                <label className={styles.check}>
                  <input type="checkbox" checked={full} onChange={(event) => setFull(event.target.checked)} />
                  <span>
                    {feedCopy.showFull} <span className={styles.muted}>{feedCopy.showFullHint}</span>
                  </span>
                </label>
              </>
            ) : (
              <p className={styles.muted}>У цій програмі поки немає блоків.</p>
            )
          ) : null}
        </div>
      ) : null}

      <div className={styles.composerRow} role="group" aria-label="Тема допису">
        <span className={styles.composerLabel}>{feedCopy.topic}</span>
        {FEED_TOPICS.map((entry) => (
          <button
            key={entry}
            className={styles.topicChip}
            type="button"
            aria-pressed={topic === entry}
            onClick={() => setTopic(entry)}
          >
            <Icon name={COURSE_CATEGORY_ICONS[entry]} size={20} />
            {COURSE_CATEGORY_LABELS[entry]}
          </button>
        ))}
        <span className={styles.muted}>{feedCopy.topicHint}</span>
      </div>

      <div className={styles.composerRow}>
        <button className={styles.publishButton} type="submit" disabled={sending}>
          {feedCopy.publish}
        </button>
        {onCancel ? (
          <button className={styles.secondaryButton} type="button" onClick={onCancel}>
            {feedCopy.cancel}
          </button>
        ) : null}
        <span className={styles.muted}>{feedCopy.publishHint}</span>
      </div>
    </form>
  );
}
