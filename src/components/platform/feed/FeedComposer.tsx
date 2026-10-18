"use client";

/**
 * A new post (G, 17.10 — Threads in our system). The feed no longer carries an
 * open composer: a listed author sees one gold «+» at the bottom right — on a
 * phone where the thumb is, on a desktop at the right edge of the feed's
 * column — and it opens this dialog.
 *
 * THE DIALOG, top to bottom: ✕ and the title; the author's face and name, and
 * beside the name the topics (one to three, catalogue icons); one field across
 * the whole width that holds, in this order, the files as one row of equal
 * tiles (photos, video, audio — each with the same «⋯»), the programme block
 * as the card the feed will draw, the «з …» authors, the text, and the tools
 * that add to it. A tool that needs an answer — the video's link, the
 * recorder, the programme path — asks in its own menu under the button, never
 * inside the field (G 17.10: «однозначно уніфіковано»); then
 * «Опублікувати» on the right. Ctrl/Cmd + Enter publishes; Escape or ✕ closes,
 * asking first when something would be lost.
 *
 * THE TEXT IS A TEXTAREA. Selecting words turns the tools row into the
 * formatting bar (bold, italic, link, lists, quote), which writes the markdown
 * subset `@/lib/feed/format` reads — see `FeedComposerFormat.ts` for why not a
 * contenteditable.
 *
 * NATIVE `<dialog>` opened with `showModal()`, as `BuilderSheet` is: Escape, the
 * focus trap, the inert page behind and the backdrop come from the platform.
 * On a phone it is a full-height sheet.
 *
 * «НАЛАШТУВАННЯ ДОПИСУ» IS NOT HERE. The mockup puts Telegram cross-posting and
 * a social-media kit behind it; neither exists on the server yet, and a menu of
 * two disabled rows is a promise, not a setting. It comes back with them.
 *
 * What passes the automatic check goes out at once; what it stops waits for
 * the team, and the author reads why right here and in «Мої дописи».
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
import { blockAttachment, programAttachment } from "@/lib/feed/attachment";
import { feedPlainText, safeFeedHref } from "@/lib/feed/format";
import { FEED_PHOTOS_MAX, type FeedMedia, type FeedMediaStored } from "@/lib/feed/media";
import { FEED_POST_MAX, FEED_TOPICS_MAX, type FeedTopic } from "@/lib/feed/model";
import type { ComposerCourse, FeedAttachment as FeedAttachmentData, FeedAuthor, FeedPost } from "@/lib/feed/server";

import { composerCopy } from "./composerCopy";
import { createPost, resubmitPost, type NewPost, type PostFinding } from "./feedApi";
import { FeedAttachment } from "./FeedAttachment";
import {
  insertLink,
  toggleInline,
  toggleLines,
  type InlineMark,
  type LineMark,
  type TextEdit,
} from "./FeedComposerFormat";
import {
  AudioField,
  MediaStrip,
  VideoField,
  checkClipFile,
  mediaError,
  uploadClip,
  uploadWithProgress,
  type AudioItem,
  type ClipItem,
  type PhotoItem,
  type VideoItem,
} from "./FeedComposerMedia";
import { ComposerPopover, TagRow, TopicMenu, initialOf } from "./FeedComposerMenus";
import styles from "./FeedComposer.module.css";

type Attach = "none" | "block" | "program";
type Panel = "none" | "video" | "audio";
type Menu = "topics" | "tags" | null;

export type ComposerDraft = {
  id: string;
  body: string;
  /** The old single topic; `topics` wins when given. */
  topic: FeedTopic;
  topics?: FeedTopic[];
  /** The post's media as it reads now; sent again unchanged unless the author edits it. */
  media?: FeedMedia;
  /** Tagged authors' ids. */
  taggedAuthorIds?: string[];
  courseId: string | null;
  lessonId: string | null;
  blockId: string | null;
  full: boolean;
  /** A post the platform wrote, changed by an admin (G 2026-10-18). */
  asPlatform?: boolean;
  pinned?: boolean;
};

let keySeq = 0;
const nextKey = () => `p${(keySeq += 1)}`;

function photosOf(media: FeedMedia | undefined): PhotoItem[] {
  return (media?.photos ?? []).map((photo) => ({
    key: nextKey(),
    preview: photo.src,
    status: "done",
    progress: 1,
    path: photo.path,
    w: photo.w,
    h: photo.h,
    spoiler: photo.spoiler,
  }));
}

function audioOf(media: FeedMedia | undefined): AudioItem | null {
  const audio = media?.audio;
  if (!audio) return null;
  return {
    status: "done",
    progress: 1,
    preview: audio.src,
    durationSec: audio.durationSec,
    path: audio.path,
    mime: audio.mime,
  };
}

function clipOf(media: FeedMedia | undefined): ClipItem | null {
  const clip = media?.clip;
  if (!clip) return null;
  return {
    status: "done",
    progress: 1,
    preview: clip.src,
    durationSec: clip.durationSec,
    w: clip.w,
    h: clip.h,
    path: clip.path,
    mime: clip.mime,
  };
}

function revoke(url: string | undefined) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

const FMT: {
  key: InlineMark | LineMark | "link";
  icon: "bold" | "italic" | "link" | "list" | "list-ordered" | "quote";
  label: string;
}[] = [
  { key: "bold", icon: "bold", label: composerCopy.bold },
  { key: "italic", icon: "italic", label: composerCopy.italic },
  { key: "link", icon: "link", label: composerCopy.link },
  { key: "ul", icon: "list", label: composerCopy.list },
  { key: "ol", icon: "list-ordered", label: composerCopy.ordered },
  { key: "quote", icon: "quote", label: composerCopy.quote },
];

export function FeedComposer({
  author,
  platform = null,
  courses: ownCourses,
  taggable = [],
  draft,
  onDone,
  onCancel,
}: {
  /** The writer's own byline; null for an admin who is not an author and writes only as the platform. */
  author: FeedAuthor | null;
  /** An admin's second voice: «від імені CenterWay», with the platform's face and name. */
  platform?: FeedAuthor | null;
  courses: ComposerCourse[];
  /** Other listed authors the post may name «з …» (`FeedMe.taggable`). */
  taggable?: FeedAuthor[];
  /** A returned post being sent again; absent for a new one. Opens at once. */
  draft?: ComposerDraft;
  onDone: (post: FeedPost) => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const photoPicker = useRef<HTMLInputElement>(null);
  const tagTool = useRef<HTMLButtonElement>(null);
  /* Each tool that asks something opens its own menu under itself — the link,
     the recorder, the programme path — so nothing of a file is typed into the
     field as if it were part of the text (G 17.10). */
  const videoTool = useRef<HTMLButtonElement>(null);
  const audioTool = useRef<HTMLButtonElement>(null);
  const blockTool = useRef<HTMLButtonElement>(null);
  const programTool = useRef<HTMLButtonElement>(null);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const fmtBar = useRef<HTMLDivElement>(null);
  const savedRange = useRef<[number, number]>([0, 0]);
  const titleId = useId();
  const [asPlatform, setAsPlatform] = useState(draft?.asPlatform ?? (!author && Boolean(platform)));
  const [pinned, setPinned] = useState(draft?.pinned ?? false);
  const speaker = (asPlatform ? platform : author) ?? platform ?? (author as FeedAuthor);
  const platformVoice = asPlatform && Boolean(platform);
  // The platform has no programmes of its own to attach.
  const courses = platformVoice ? [] : ownCourses;

  const [open, setOpen] = useState(Boolean(draft));
  const [body, setBody] = useState(draft?.body ?? "");
  const [topics, setTopics] = useState<FeedTopic[]>(draft ? (draft.topics ?? [draft.topic]) : []);
  const [tagged, setTagged] = useState<string[]>(draft?.taggedAuthorIds ?? []);
  const [photos, setPhotos] = useState<PhotoItem[]>(() => photosOf(draft?.media));
  const [video, setVideo] = useState<VideoItem | null>(draft?.media?.video ?? null);
  const [clip, setClip] = useState<ClipItem | null>(() => clipOf(draft?.media));
  const [audio, setAudio] = useState<AudioItem | null>(() => audioOf(draft?.media));
  const [attach, setAttach] = useState<Attach>(draft?.blockId ? "block" : draft?.courseId ? "program" : "none");
  const [courseId, setCourseId] = useState<string>(draft?.courseId ?? courses[0]?.id ?? "");
  const [lessonId, setLessonId] = useState<string>(draft?.lessonId ?? "");
  const [blockId, setBlockId] = useState<string>(draft?.blockId ?? "");
  const [full, setFull] = useState(draft?.full ?? true);
  /* The path (programme → lesson → block) is asked only while choosing; once
     chosen, the field shows the block itself as the feed will draw it. A
     returned post opens with its attachment already chosen. */
  const [choosing, setChoosing] = useState(false);
  /* Chosen once with «Прикріпити» (or opened from a returned post): only then
     does the block stand in the field. A choice dismissed before that leaves
     nothing behind. */
  const [attachConfirmed, setAttachConfirmed] = useState(Boolean(draft?.blockId || draft?.courseId));
  const [panel, setPanel] = useState<Panel>("none");
  const [menu, setMenu] = useState<Menu>(null);
  const [selected, setSelected] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState(false);
  const [sending, setSending] = useState(false);
  const [findings, setFindings] = useState<PostFinding[]>([]);
  const [held, setHeld] = useState<FeedPost | null>(null);

  const course = courses.find((entry) => entry.id === courseId) ?? null;
  const lessons = useMemo(() => course?.lessons.filter((lesson) => lesson.blocks.length > 0) ?? [], [course]);
  const lesson = lessons.find((entry) => entry.id === lessonId) ?? lessons[0] ?? null;
  const block = lesson?.blocks.find((entry) => entry.id === blockId) ?? lesson?.blocks[0] ?? null;
  const attachment = useMemo(() => {
    if (!course) return null;
    const owner = { title: course.title, slug: course.slug, programSlug: course.programSlug };
    if (attach === "program") return programAttachment(owner);
    if (attach === "block" && lesson && block) {
      return blockAttachment(
        owner,
        { title: lesson.title, dayIndex: lesson.dayIndex, blocks: [block.block] },
        block.id,
        full,
      );
    }
    return null;
  }, [attach, course, lesson, block, full]);
  const taggableOthers = useMemo(() => taggable.filter((entry) => entry.id !== speaker.id), [taggable, speaker.id]);

  const visible = useMemo(() => feedPlainText(body).length, [body]);
  const uploading =
    photos.some((photo) => photo.status === "uploading") ||
    clip?.status === "uploading" ||
    audio?.status === "uploading";
  const dirty =
    Boolean(body.trim()) ||
    photos.length > 0 ||
    Boolean(video) ||
    Boolean(clip) ||
    Boolean(audio) ||
    tagged.length > 0 ||
    (!draft && attach !== "none");

  /* ── open and close ── */

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      // The text is what the author came for; on a phone this also raises the keyboard.
      requestAnimationFrame(() => field.current?.focus());
    }
    if (!open && element.open) element.close();
  }, [open]);

  const reset = useCallback(() => {
    setBody("");
    setTopics([]);
    setTagged([]);
    setPhotos((current) => {
      current.forEach((photo) => revoke(photo.preview));
      return [];
    });
    setVideo(null);
    setClip((current) => {
      revoke(current?.preview);
      return null;
    });
    setAudio((current) => {
      revoke(current?.preview);
      return null;
    });
    setAttach("none");
    setAttachConfirmed(false);
    setChoosing(false);
    setPanel("none");
    setMenu(null);
    setFindings([]);
    setSelected(false);
    setLinking(false);
  }, []);

  const finish = useCallback(() => {
    setOpen(false);
    setHeld(null);
    if (draft) onCancel?.();
  }, [draft, onCancel]);

  const requestClose = useCallback(() => {
    if (sending) return;
    if (!held && dirty && !window.confirm(composerCopy.discard)) return;
    if (!draft) reset();
    finish();
  }, [sending, held, dirty, draft, reset, finish]);

  useEffect(
    () => () => {
      // Unmounting with local previews still alive lets them go.
      photos.forEach((photo) => revoke(photo.preview));
      revoke(audio?.preview);
      revoke(clip?.preview);
    },
    // Only on unmount: the lists are read through the closure of the last render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ── text and its formatting ── */

  function apply(edit: TextEdit) {
    setBody(edit.value);
    requestAnimationFrame(() => {
      const element = field.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(edit.start, edit.end);
      setSelected(edit.start !== edit.end);
    });
  }

  function format(key: InlineMark | LineMark | "link") {
    const element = field.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end, value } = element;
    if (key === "link") {
      savedRange.current = [start, end];
      setLinkUrl("");
      setLinkError(false);
      setLinking(true);
      return;
    }
    if (key === "bold" || key === "italic") apply(toggleInline(value, start, end, key));
    else apply(toggleLines(value, start, end, key));
  }

  function addLink() {
    const href = safeFeedHref(linkUrl.trim().match(/^[a-z]+:/i) ? linkUrl.trim() : `https://${linkUrl.trim()}`);
    if (!href || !linkUrl.trim()) {
      setLinkError(true);
      return;
    }
    const [start, end] = savedRange.current;
    setLinking(false);
    apply(insertLink(body, start, end, href));
  }

  function noteSelection() {
    const element = field.current;
    if (!element) return;
    setSelected(element.selectionStart !== element.selectionEnd);
  }

  function onFieldKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    const key = event.key.toLowerCase();
    // Latin and Cyrillic layouts both: «и» sits on B, «ш» on I, «л» on K.
    if (key === "b" || key === "и") {
      event.preventDefault();
      format("bold");
    } else if (key === "i" || key === "ш") {
      event.preventDefault();
      format("italic");
    } else if (key === "k" || key === "л") {
      event.preventDefault();
      format("link");
    }
  }

  /* ── media ── */

  async function sendPhoto(key: string, file: File) {
    const result = await uploadWithProgress(
      file,
      (progress) =>
        setPhotos((current) => current.map((photo) => (photo.key === key ? { ...photo, progress } : photo))),
      platformVoice,
    );
    setPhotos((current) =>
      current.map((photo) => {
        if (photo.key !== key) return photo;
        if (!result.ok || result.data.kind !== "photo") {
          const error = result.ok ? composerCopy.photoFailed : mediaError(result.code, composerCopy.photoFailed);
          return { ...photo, status: "failed", error };
        }
        return { ...photo, status: "done", progress: 1, path: result.data.path, w: result.data.w, h: result.data.h };
      }),
    );
  }

  function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = FEED_PHOTOS_MAX - photos.length;
    const chosen = [...files].filter((file) => file.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (files.length > room) toast.info(composerCopy.photosFull(FEED_PHOTOS_MAX));
    const items: PhotoItem[] = chosen.map((file) => ({
      key: nextKey(),
      preview: URL.createObjectURL(file),
      status: "uploading",
      progress: 0,
      file,
      spoiler: false,
    }));
    setPhotos((current) => [...current, ...items]);
    items.forEach((item) => void sendPhoto(item.key, item.file as File));
  }

  function retryPhoto(key: string) {
    const item = photos.find((photo) => photo.key === key);
    if (!item?.file) return;
    setPhotos((current) =>
      current.map((photo) =>
        photo.key === key ? { ...photo, status: "uploading", progress: 0, error: undefined } : photo,
      ),
    );
    void sendPhoto(key, item.file);
  }

  async function sendClip(file: File, mime: string) {
    const result = await uploadClip(
      file,
      mime,
      (progress) => setClip((current) => (current && current.file === file ? { ...current, progress } : current)),
      platformVoice,
    );
    setClip((current) => {
      if (!current || current.file !== file) return current;
      if (!result.ok) {
        const error = mediaError(result.code, composerCopy.clipFailed);
        toast.error(error);
        return { ...current, status: "failed", error };
      }
      return { ...current, status: "done", progress: 1, path: result.data.path, mime };
    });
  }

  async function addClip(file: File) {
    const checked = await checkClipFile(file);
    if (!checked.ok) {
      toast.error(checked.error);
      return;
    }
    revoke(clip?.preview);
    setVideo(null);
    setClip({
      status: "uploading",
      progress: 0,
      preview: checked.preview,
      durationSec: checked.durationSec,
      w: checked.w,
      h: checked.h,
      file,
      mime: checked.mime,
    });
    void sendClip(file, checked.mime);
  }

  async function sendAudio(file: File) {
    const result = await uploadWithProgress(
      file,
      (progress) => setAudio((current) => (current && current.file === file ? { ...current, progress } : current)),
      platformVoice,
    );
    setAudio((current) => {
      if (!current || current.file !== file) return current;
      if (!result.ok || result.data.kind !== "audio") {
        const error = result.ok ? composerCopy.audioFailed : mediaError(result.code, composerCopy.audioFailed);
        return { ...current, status: "failed", error };
      }
      return { ...current, status: "done", progress: 1, path: result.data.path, mime: result.data.mime };
    });
  }

  function addAudio(ready: { file: File; preview: string; durationSec: number }) {
    revoke(audio?.preview);
    setPanel("none");
    setAudio({ status: "uploading", progress: 0, ...ready });
    void sendAudio(ready.file);
  }

  /* ── publish ── */

  function input(): NewPost {
    const media: FeedMediaStored = {};
    const ready = photos.filter((photo) => photo.status === "done" && photo.path && photo.w && photo.h);
    if (ready.length) {
      media.photos = ready.map((photo) => ({
        path: photo.path as string,
        w: photo.w as number,
        h: photo.h as number,
        spoiler: photo.spoiler,
      }));
    }
    if (video) media.video = video;
    if (clip?.status === "done" && clip.path && clip.mime) {
      media.clip = { path: clip.path, durationSec: clip.durationSec, w: clip.w, h: clip.h, mime: clip.mime };
    }
    if (audio?.status === "done" && audio.path && audio.mime) {
      media.audio = { path: audio.path, durationSec: audio.durationSec, mime: audio.mime };
    }
    const next: NewPost = { body, topics, media, taggedAuthorIds: tagged };
    if (platformVoice) {
      next.asPlatform = true;
      next.pinned = pinned;
    }
    if (attach !== "none" && attachConfirmed && course) next.courseId = course.id;
    if (attach === "block" && attachConfirmed && lesson && block) {
      next.lessonId = lesson.id;
      next.blockId = block.id;
      next.blockDisplay = full ? "full" : "excerpt";
    }
    return next;
  }

  async function publish(event?: FormEvent) {
    event?.preventDefault();
    if (sending || held) return;
    if (!body.trim()) {
      toast.error(composerCopy.needText);
      field.current?.focus();
      return;
    }
    if (visible > FEED_POST_MAX) {
      toast.error(composerCopy.tooLong(FEED_POST_MAX));
      return;
    }
    if (topics.length === 0) {
      toast.error(composerCopy.needTopic);
      setMenu("topics");
      return;
    }
    if (uploading) {
      toast.info(composerCopy.waitUploads);
      return;
    }
    if (photos.some((photo) => photo.status === "failed")) {
      toast.error(composerCopy.photoFailed);
      return;
    }
    if (clip?.status === "failed") {
      toast.error(clip.error ?? composerCopy.clipFailed);
      return;
    }
    if (audio?.status === "failed") {
      toast.error(audio.error ?? composerCopy.audioFailed);
      return;
    }
    setSending(true);
    const result = draft ? await resubmitPost(draft.id, input()) : await createPost(input());
    setSending(false);
    if (!result.ok) {
      toast.error(mediaError(result.code, composerCopy.publishFailed));
      return;
    }
    if (result.data.post.status === "published") {
      toast.success(composerCopy.published);
      reset();
      setOpen(false);
    } else {
      toast.info(composerCopy.held);
      reset();
      setFindings(result.data.findings);
      setHeld(result.data.post);
    }
    onDone(result.data.post);
  }

  function onFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void publish();
    }
  }

  /* ── render ── */

  /* A tool press opens the choice; pressing the same tool again takes the
     attachment off. A programme needs no choosing when the author has one. */
  function startAttach(kind: Exclude<Attach, "none">) {
    if (attach === kind) {
      setAttach("none");
      return;
    }
    const direct = kind === "program" && courses.length === 1;
    setAttach(kind);
    setChoosing(!direct);
    setAttachConfirmed(direct);
  }

  function closeChooser() {
    setChoosing(false);
    if (!attachConfirmed) setAttach("none");
  }

  const showFmt = selected || linking;
  const counterNear = visible > FEED_POST_MAX - 400;

  const tools = (
    <div className={styles.tools} role="group" aria-label={composerCopy.toolsLabel}>
      <ToolButton
        icon="photo"
        label={composerCopy.photo}
        disabled={photos.length >= FEED_PHOTOS_MAX}
        onClick={() => photoPicker.current?.click()}
      />
      <ToolButton
        ref={videoTool}
        icon="video"
        label={composerCopy.video}
        pressed={panel === "video"}
        disabled={Boolean(video) || Boolean(clip)}
        onClick={() => setPanel(panel === "video" ? "none" : "video")}
      />
      <ToolButton
        ref={audioTool}
        icon="mic"
        label={composerCopy.audio}
        pressed={panel === "audio"}
        disabled={Boolean(audio)}
        onClick={() => setPanel(panel === "audio" ? "none" : "audio")}
      />
      {courses.length > 0 ? (
        <>
          <ToolButton
            ref={blockTool}
            icon="document"
            label={composerCopy.block}
            pressed={attach === "block"}
            onClick={() => startAttach("block")}
          />
          <ToolButton
            ref={programTool}
            icon="guide"
            label={composerCopy.program}
            pressed={attach === "program"}
            onClick={() => startAttach("program")}
          />
        </>
      ) : null}
      {taggableOthers.length > 0 ? (
        <ToolButton
          ref={tagTool}
          icon="user-add"
          label={composerCopy.tagLabel}
          pressed={menu === "tags"}
          onClick={() => setMenu(menu === "tags" ? null : "tags")}
        />
      ) : null}
    </div>
  );

  const fmt = (
    <div
      ref={fmtBar}
      className={styles.tools}
      role="toolbar"
      aria-label={composerCopy.fmtLabel}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && (fmtBar.current?.contains(next) || next === field.current)) return;
        setSelected(false);
        setLinking(false);
      }}
    >
      {linking ? (
        <div className={styles.inlineRow}>
          <input
            className={styles.inlineInput}
            type="url"
            inputMode="url"
            // The bar opens on a press of «Посилання»; the address is what comes next.
            autoFocus
            value={linkUrl}
            aria-label={composerCopy.link}
            aria-invalid={linkError || undefined}
            placeholder={composerCopy.linkPlaceholder}
            onChange={(event) => {
              setLinkUrl(event.target.value);
              setLinkError(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                addLink();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setLinking(false);
                field.current?.focus();
              }
            }}
          />
          <button className={styles.inlineAction} type="button" onClick={addLink}>
            {composerCopy.linkAdd}
          </button>
          <button
            className={styles.iconAction}
            type="button"
            aria-label={composerCopy.close}
            onClick={() => {
              setLinking(false);
              field.current?.focus();
            }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      ) : (
        FMT.map((entry, index) => (
          <span key={entry.key} className={styles.fmtSlot} data-sep={index === 3 || undefined}>
            <ToolButton
              icon={entry.icon}
              label={entry.label}
              // Keeps the textarea's selection: a press must not move focus first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => format(entry.key)}
            />
          </span>
        ))
      )}
    </div>
  );

  return (
    <>
      {draft ? null : (
        <button
          className={styles.fab}
          type="button"
          aria-label={composerCopy.open}
          title={composerCopy.open}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <Icon name="plus" size={24} />
        </button>
      )}

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          if (menu) setMenu(null);
          else if (linking) setLinking(false);
          else if (choosing) closeChooser();
          else if (panel !== "none" && !recordingAudio) setPanel("none");
          else requestClose();
        }}
        onClick={(event) => {
          // The dialog's own box is the backdrop; its sheet is the only child.
          if (event.target === dialog.current) requestClose();
        }}
      >
        <form className={styles.sheet} onSubmit={(event) => void publish(event)} onKeyDown={onFormKeyDown} noValidate>
          <header className={styles.head}>
            <button
              className={styles.closeAction}
              type="button"
              aria-label={composerCopy.close}
              title={composerCopy.close}
              data-cw-ink-control
              onClick={requestClose}
            >
              <InteractionInkIcon>
                <Icon name="close" size={20} />
              </InteractionInkIcon>
            </button>
            <h2 id={titleId} className={styles.title}>
              {held ? composerCopy.heldTitle : draft ? composerCopy.titleAgain : composerCopy.title}
            </h2>
            <span className={styles.headSpacer} aria-hidden="true" />
          </header>

          <div className={`${styles.scroll} cw-scroll`}>
            {held ? (
              <div className={styles.heldPanel} role="status">
                <p>{composerCopy.heldLead}</p>
                {findings.length > 0 ? (
                  <ul className={styles.findings}>
                    {findings.map((finding) => (
                      <li key={`${finding.rule}-${finding.detail}`}>
                        <strong>{finding.label}:</strong> {finding.detail}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <div className={styles.body}>
                <AuthorPortrait
                  className={styles.face}
                  photo={speaker.photo}
                  size="xs"
                  fallback={initialOf(speaker.name)}
                />
                <div className={styles.main}>
                  <div className={styles.who}>
                    <b className={styles.name}>{speaker.name}</b>
                    <TopicMenu
                      topics={topics}
                      onChange={(next) => setTopics(next.slice(0, FEED_TOPICS_MAX))}
                      open={menu === "topics"}
                      onOpenChange={(next) => setMenu(next ? "topics" : null)}
                    />
                  </div>

                  {platform ? (
                    <div className={styles.voice} role="group" aria-label={composerCopy.voiceLabel}>
                      {author && !draft ? (
                        <label className={styles.voiceOption}>
                          <input
                            type="checkbox"
                            checked={asPlatform}
                            onChange={(event) => {
                              setAsPlatform(event.target.checked);
                              if (!event.target.checked) setPinned(false);
                            }}
                          />
                          <span className={styles.voiceText}>{composerCopy.asPlatform}</span>
                        </label>
                      ) : null}
                      {platformVoice ? (
                        <label className={styles.voiceOption}>
                          <input
                            type="checkbox"
                            checked={pinned}
                            onChange={(event) => setPinned(event.target.checked)}
                          />
                          <span className={styles.voiceText}>{composerCopy.pin}</span>
                        </label>
                      ) : null}
                    </div>
                  ) : null}

                  <div className={styles.field} data-dragging={undefined}>
                    {photos.length ||
                    video ||
                    clip ||
                    audio ||
                    (attach !== "none" && attachConfirmed) ||
                    tagged.length ? (
                      <div className={styles.attached} aria-label={composerCopy.attached}>
                        <MediaStrip
                          photos={photos}
                          video={video}
                          clip={clip}
                          audio={audio}
                          onTag={taggableOthers.length > 0 ? () => setMenu("tags") : undefined}
                          onSpoiler={(key) =>
                            setPhotos((current) =>
                              current.map((photo) =>
                                photo.key === key ? { ...photo, spoiler: !photo.spoiler } : photo,
                              ),
                            )
                          }
                          onRemove={(key) =>
                            setPhotos((current) => {
                              revoke(current.find((photo) => photo.key === key)?.preview);
                              return current.filter((photo) => photo.key !== key);
                            })
                          }
                          onRetry={retryPhoto}
                          onRemoveVideo={() => setVideo(null)}
                          onRemoveClip={() => {
                            revoke(clip?.preview);
                            setClip(null);
                          }}
                          onRetryClip={() => {
                            if (!clip?.file || !clip.mime) return;
                            setClip({ ...clip, status: "uploading", progress: 0, error: undefined });
                            void sendClip(clip.file, clip.mime);
                          }}
                          onRemoveAudio={() => {
                            revoke(audio?.preview);
                            setAudio(null);
                          }}
                          onRetryAudio={() => {
                            if (!audio?.file) return;
                            setAudio({ ...audio, status: "uploading", progress: 0, error: undefined });
                            void sendAudio(audio.file);
                          }}
                        />
                        {attach !== "none" && attachConfirmed && attachment ? (
                          <AttachPreview
                            attach={attach}
                            attachment={attachment}
                            full={full}
                            canChange={attach === "block" || courses.length > 1}
                            onChange={() => setChoosing(true)}
                            onFull={setFull}
                            onRemove={() => {
                              setAttach("none");
                              setAttachConfirmed(false);
                            }}
                          />
                        ) : null}
                        <TagRow
                          taggable={taggableOthers}
                          tagged={tagged}
                          onChange={setTagged}
                          open={menu === "tags"}
                          onOpenChange={(next) => setMenu(next ? "tags" : null)}
                          anchor={tagTool}
                        />
                      </div>
                    ) : (
                      // The menu still needs its host when nothing is tagged yet.
                      <TagRow
                        taggable={taggableOthers}
                        tagged={tagged}
                        onChange={setTagged}
                        open={menu === "tags"}
                        onOpenChange={(next) => setMenu(next ? "tags" : null)}
                        anchor={tagTool}
                      />
                    )}

                    <textarea
                      ref={field}
                      className={styles.text}
                      aria-label={composerCopy.textLabel}
                      placeholder={composerCopy.placeholder}
                      rows={3}
                      value={body}
                      onChange={(event) => {
                        setBody(event.target.value);
                        noteSelection();
                      }}
                      onSelect={noteSelection}
                      onMouseUp={noteSelection}
                      onKeyUp={noteSelection}
                      onKeyDown={onFieldKeyDown}
                      onBlur={(event) => {
                        const next = event.relatedTarget as Node | null;
                        if (next && fmtBar.current?.contains(next)) return;
                        if (!linking) setSelected(false);
                      }}
                    />

                    {showFmt ? fmt : tools}
                    <ComposerPopover
                      open={panel === "video"}
                      onClose={() => setPanel("none")}
                      anchor={videoTool}
                      label={composerCopy.video}
                      width={360}
                    >
                      <VideoField
                        onAdd={(next) => {
                          setVideo(next);
                          setPanel("none");
                        }}
                        onFile={(file) => {
                          setPanel("none");
                          void addClip(file);
                        }}
                        onCancel={() => setPanel("none")}
                      />
                    </ComposerPopover>
                    <ComposerPopover
                      open={panel === "audio"}
                      onClose={() => {
                        if (!recordingAudio) setPanel("none");
                      }}
                      anchor={audioTool}
                      label={composerCopy.audio}
                      width={360}
                    >
                      <AudioField
                        onReady={addAudio}
                        onError={(message) => toast.error(message)}
                        onRecording={setRecordingAudio}
                      />
                    </ComposerPopover>
                    <ComposerPopover
                      open={choosing && attach !== "none"}
                      onClose={closeChooser}
                      anchor={attach === "program" ? programTool : blockTool}
                      label={attach === "program" ? composerCopy.programWhole : composerCopy.blockFrom}
                      width={360}
                    >
                      {attach !== "none" ? (
                        <AttachChooser
                          attach={attach}
                          courses={courses}
                          course={course}
                          lessons={lessons}
                          lesson={lesson}
                          block={block}
                          onCourse={(id) => {
                            setCourseId(id);
                            setLessonId("");
                            setBlockId("");
                          }}
                          onLesson={(id) => {
                            setLessonId(id);
                            setBlockId("");
                          }}
                          onBlock={setBlockId}
                          onChosen={() => {
                            setAttachConfirmed(true);
                            setChoosing(false);
                          }}
                        />
                      ) : null}
                    </ComposerPopover>

                    <input
                      ref={photoPicker}
                      className={styles.hiddenInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      multiple
                      tabIndex={-1}
                      aria-hidden="true"
                      onChange={(event) => {
                        addPhotos(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </div>

                  {findings.length > 0 ? (
                    <ul className={styles.findings} role="note">
                      {findings.map((finding) => (
                        <li key={`${finding.rule}-${finding.detail}`}>
                          <strong>{finding.label}:</strong> {finding.detail}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <footer className={styles.foot}>
            {held ? (
              <>
                <span />
                <button className={styles.secondaryAction} type="button" onClick={finish}>
                  {composerCopy.heldClose}
                </button>
              </>
            ) : (
              <>
                <span className={styles.footNote} aria-live="polite">
                  {counterNear ? (
                    <span data-over={visible > FEED_POST_MAX || undefined} className={styles.counter}>
                      {visible} / {FEED_POST_MAX}
                    </span>
                  ) : (
                    <span className={styles.shortcut}>{composerCopy.shortcut}</span>
                  )}
                </span>
                <button
                  className={styles.publishAction}
                  type="submit"
                  disabled={sending}
                  aria-busy={sending || undefined}
                >
                  {sending ? composerCopy.publishing : composerCopy.publish}
                </button>
              </>
            )}
          </footer>
        </form>
      </dialog>
    </>
  );
}

/* ─────────────────────────── parts ─────────────────────────── */

type ToolIcon =
  | "photo"
  | "video"
  | "mic"
  | "document"
  | "guide"
  | "user-add"
  | "bold"
  | "italic"
  | "link"
  | "list"
  | "list-ordered"
  | "quote";

function ToolButton({
  ref,
  icon,
  label,
  pressed,
  disabled,
  onClick,
  onMouseDown,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  icon: ToolIcon;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onMouseDown?: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      ref={ref}
      className={styles.toolAction}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      data-cw-ink-control
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <InteractionInkIcon active={pressed}>
        <Icon name={icon} size={20} />
      </InteractionInkIcon>
    </button>
  );
}

/** A block of the author's programme, or the programme itself — the old composer's picker, inside the field. */
/** The programme path, asked in the tool's own menu: programme, then lesson and block. */
function AttachChooser({
  attach,
  courses,
  course,
  lessons,
  lesson,
  block,
  onCourse,
  onLesson,
  onBlock,
  onChosen,
}: {
  attach: Exclude<Attach, "none">;
  courses: ComposerCourse[];
  course: ComposerCourse | null;
  lessons: ComposerCourse["lessons"];
  lesson: ComposerCourse["lessons"][number] | null;
  block: ComposerCourse["lessons"][number]["blocks"][number] | null;
  onCourse: (id: string) => void;
  onLesson: (id: string) => void;
  onBlock: (id: string) => void;
  onChosen: () => void;
}) {
  const empty = attach === "block" && lessons.length === 0;
  return (
    <div className={styles.chooser}>
      <select
        className={styles.select}
        aria-label={composerCopy.pickCourse}
        value={course?.id ?? ""}
        onChange={(event) => onCourse(event.target.value)}
      >
        {courses.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.title}
          </option>
        ))}
      </select>
      {attach === "block" && !empty ? (
        <>
          <select
            className={styles.select}
            aria-label={composerCopy.pickLesson}
            value={lesson?.id ?? ""}
            onChange={(event) => onLesson(event.target.value)}
          >
            {lessons.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            aria-label={composerCopy.pickBlock}
            value={block?.id ?? ""}
            onChange={(event) => onBlock(event.target.value)}
          >
            {(lesson?.blocks ?? []).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label || entry.kind}
              </option>
            ))}
          </select>
        </>
      ) : null}
      {empty ? (
        <p className={styles.muted}>{composerCopy.noBlocks}</p>
      ) : (
        <button className={styles.inlineAction} type="button" onClick={onChosen}>
          {composerCopy.attachDone}
        </button>
      )}
    </div>
  );
}

/** What was chosen, in the field: the card the feed will draw, «Змінити» and ✕. */
function AttachPreview({
  attach,
  attachment,
  full,
  canChange,
  onChange,
  onFull,
  onRemove,
}: {
  attach: Exclude<Attach, "none">;
  /** The card the feed will draw, built by the server's own function. */
  attachment: FeedAttachmentData;
  full: boolean;
  canChange: boolean;
  onChange: () => void;
  onFull: (full: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.picker}>
      <div className={styles.pickerHead}>
        <Icon name={attach === "block" ? "document" : "guide"} size={20} />
        <b>{attach === "block" ? composerCopy.blockFrom : composerCopy.programWhole}</b>
        {canChange ? (
          <button className={styles.pickerChange} type="button" onClick={onChange}>
            {composerCopy.attachChange}
          </button>
        ) : null}
        <button className={styles.iconAction} type="button" aria-label={composerCopy.removeAttach} onClick={onRemove}>
          <Icon name="close" size={20} />
        </button>
      </div>
      <FeedAttachment attachment={attachment} preview />
      {attach === "block" ? (
        <label className={styles.check}>
          <input type="checkbox" checked={full} onChange={(event) => onFull(event.target.checked)} />
          <span>
            {composerCopy.showFull} <span className={styles.muted}>{composerCopy.showFullHint}</span>
          </span>
        </label>
      ) : null}
    </div>
  );
}
