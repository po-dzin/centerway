/**
 * «Стрічка» — the database half (2026-10-16). Server-only.
 *
 * Schema: supabase/migrations/20261016150000_author_feed.sql, and the second
 * wave 20261017120000_feed_wave2.sql (topics, media, tagged authors,
 * «Зберегти», three reactions per person). Every function takes the client as
 * its first argument, so the tests hand in the fake.
 *
 * WHO MAY DO WHAT is decided here, in TypeScript, not by the policies
 * (AGENTS.md → Database Rule): reading the published feed needs nothing;
 * reacting, commenting and marking need an account; writing a post needs a
 * LISTED author profile tied to the account; a post is changed or removed only
 * by the author who wrote it; a comment is removed by whoever wrote it, or
 * hidden from their post by the post's author.
 *
 * NO NAME OF A READER CROSSES TO AN AUTHOR except as a commenter's display
 * name under their own comment, which they wrote in public. Reactions are
 * counted, never listed by person, except the reader's own.
 */

import { adminClient } from "@/lib/auth/adminClient";
import type { Json } from "@/lib/db/database.types";
import type { Author } from "@/lms-core";

import { blockAttachment, programAttachment } from "./attachment";
import { feedBlockOptions, feedBlockText, type FeedLessonBlock } from "./blocks";
import { feedGateText, feedPlainText } from "./format";
import { checkFeedText, type GateVerdict } from "./gate";
import { FEED_TAGS_MAX, checkFeedMedia, readFeedMedia, type FeedMedia } from "./media";
import {
  FEED_COMMENT_MAX,
  FEED_PAGE_SIZE,
  FEED_POST_MAX,
  FEED_POST_RAW_MAX,
  FEED_REACTIONS_PER_PERSON,
  countReactions,
  excerptOf,
  feedAuthorPath,
  feedSavedClientId,
  isFeedEmoji,
  isFeedTopic,
  normalizeFeedText,
  normalizeFeedTopics,
  type FeedBlockDisplay,
  type FeedFilter,
  type FeedPostStatus,
  type FeedTopic,
  type ReactionCount,
} from "./model";

export type Db = ReturnType<typeof adminClient>;

export class FeedError extends Error {
  constructor(
    readonly code: string,
    readonly status = 422,
  ) {
    super(code);
    this.name = "FeedError";
  }
}

/* ─────────────────────────── shapes ─────────────────────────── */

/** `photo` carries the author's own crop, so a byline frames the face as the cabinet's editor aimed it. */
export type FeedAuthor = { id: string; slug: string; name: string; photo: Author["photo"] | null };

export type FeedAttachment = {
  /** A block of a lesson, or the programme itself. */
  kind: "block" | "program";
  title: string;
  /** «Шлях 21 · урок 2» — where it is from. */
  meta: string;
  /** The block's words, whole or opening; empty for a video or the programme. */
  text: string;
  /** Shown whole; false is «уривок», which the card clamps. */
  full: boolean;
  /**
   * The lesson block itself, for the lesson renderer (`BlockRenderer`) — any
   * of the block types. Null for a programme, or a block since deleted.
   */
  block: FeedLessonBlock | null;
  /** The course's slug, for the renderer's links between lessons. */
  courseSlug: string | null;
  media: "video" | "image" | null;
  durationMin: number | null;
  /** The programme page, where the reader can go on. */
  href: string | null;
};

export type FeedPost = {
  id: string;
  author: FeedAuthor;
  /** The stored markdown subset; draw it with `parseFeedBody` (./format). */
  body: string;
  /** The first of `topics` — kept for the code that reads one topic. */
  topic: FeedTopic;
  /** One to three, in the author's order. */
  topics: FeedTopic[];
  media: FeedMedia;
  /** «з Ірина Мельник» — listed authors only. */
  tagged: FeedAuthor[];
  status: FeedPostStatus;
  publishedAt: string | null;
  createdAt: string;
  attachment: FeedAttachment | null;
  reactions: ReactionCount[];
  commentCount: number;
  /** The reader wrote this post. */
  mine: boolean;
  /** The reader saved it to «Мій журнал». False for a guest. */
  saved: boolean;
  /** Only the post's own author sees why it waits or came back. */
  heldReason?: string | null;
  returnedReason?: string | null;
  /** What it carries, by id — the author's own copy, for sending a returned post again. */
  source?: { courseId: string | null; lessonId: string | null; blockId: string | null; blockDisplay: FeedBlockDisplay };
};

export type FeedComment = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  /**
   * Who wrote it, drawn in full (G 2026-10-17): the post's author by their
   * own name, face and profile; anyone else by their public name and the
   * picture their sign-in brought, or an initial.
   */
  who: { name: string; initial: string; photo: Author["photo"] | null; href: string | null };
  /** Written by the post's author — the thread marks it «автор». */
  byAuthor: boolean;
  mine: boolean;
  /** The reader may hide it: they are the post's author. */
  canHide: boolean;
};

type PostRow = {
  id: string;
  author_id: string;
  created_by: string;
  body: string;
  topic: string;
  topics: string[] | null;
  media: unknown;
  tagged_author_ids: string[] | null;
  course_id: string | null;
  lesson_id: string | null;
  block_id: string | null;
  block_display: string;
  status: string;
  held_reason: string | null;
  returned_reason: string | null;
  published_at: string | null;
  created_at: string;
  tg_message_id: number | null;
};

const POST_COLUMNS =
  "id, author_id, created_by, body, topic, topics, media, tagged_author_ids, course_id, lesson_id, block_id, block_display, status, held_reason, returned_reason, published_at, created_at, tg_message_id";

type AuthorRow = {
  id: string;
  slug: string;
  name: string;
  photo: unknown;
  listed: boolean;
  auth_user_id: string | null;
};

function authorOf(row: AuthorRow): FeedAuthor {
  const photo = row.photo as Author["photo"] | null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    photo: photo && typeof photo.src === "string" ? { ...photo, alt: photo.alt || row.name } : null,
  };
}

/* ─────────────────────────── authors ─────────────────────────── */

/**
 * The author profile an account writes as, or null. Listed only: a post goes
 * to everyone, and its byline links to a page that must exist.
 */
export async function feedAuthorForUser(db: Db, userId: string): Promise<(FeedAuthor & { userId: string }) | null> {
  const { data, error } = await db
    .from("lms_authors")
    .select("id, slug, name, photo, listed, auth_user_id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`feed_author_read_failed:${error.message}`);
  const row = data as AuthorRow | null;
  if (!row || row.listed !== true) return null;
  return { ...authorOf(row), userId };
}

/** Listed authors who have at least one published post — the filter's author list. */
export async function listFeedAuthors(db: Db): Promise<FeedAuthor[]> {
  const { data: posts, error } = await db
    .from("feed_posts")
    .select("author_id")
    .eq("status", "published")
    .is("hidden_at", null);
  if (error) throw new Error(`feed_authors_read_failed:${error.message}`);
  const ids = [...new Set(((posts ?? []) as { author_id: string }[]).map((row) => row.author_id))];
  if (ids.length === 0) return [];
  const { data, error: authorError } = await db
    .from("lms_authors")
    .select("id, slug, name, photo, listed, auth_user_id")
    .in("id", ids)
    .eq("listed", true)
    .order("name");
  if (authorError) throw new Error(`feed_authors_read_failed:${authorError.message}`);
  return ((data ?? []) as AuthorRow[]).map(authorOf);
}

/* ─────────────────────────── reading ─────────────────────────── */

async function attachmentsFor(db: Db, rows: PostRow[]): Promise<Map<string, FeedAttachment>> {
  const out = new Map<string, FeedAttachment>();
  const courseIds = [...new Set(rows.map((row) => row.course_id).filter((id): id is string => Boolean(id)))];
  if (courseIds.length === 0) return out;
  const lessonIds = [...new Set(rows.map((row) => row.lesson_id).filter((id): id is string => Boolean(id)))];

  const [{ data: courses }, { data: lessons }] = await Promise.all([
    db.from("lms_courses").select("id, title, slug, program_slug").in("id", courseIds),
    lessonIds.length
      ? db.from("lms_lessons").select("id, title, day_index, blocks").in("id", lessonIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const courseById = new Map(
    ((courses ?? []) as { id: string; title: string; slug: string | null; program_slug: string }[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const lessonById = new Map(
    ((lessons ?? []) as { id: string; title: string; day_index: number | null; blocks: unknown }[]).map((row) => [
      row.id,
      row,
    ]),
  );

  for (const row of rows) {
    const course = row.course_id ? courseById.get(row.course_id) : undefined;
    if (!course) continue;
    const owner = { title: course.title, slug: course.slug ?? null, programSlug: course.program_slug || null };
    const lesson = row.lesson_id ? lessonById.get(row.lesson_id) : undefined;
    out.set(
      row.id,
      lesson
        ? blockAttachment(
            owner,
            { title: lesson.title, dayIndex: lesson.day_index, blocks: lesson.blocks },
            row.block_id,
            row.block_display === "full",
          )
        : programAttachment(owner),
    );
  }
  return out;
}

async function decorate(db: Db, rows: PostRow[], me: string | null): Promise<FeedPost[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const authorIds = [...new Set(rows.flatMap((row) => [row.author_id, ...(row.tagged_author_ids ?? [])]))];

  const [
    { data: authors, error: authorError },
    { data: reactions, error: reactionError },
    { data: comments },
    { data: savedRows },
    attachments,
  ] = await Promise.all([
    db.from("lms_authors").select("id, slug, name, photo, listed, auth_user_id").in("id", authorIds),
    db.from("feed_reactions").select("post_id, emoji, auth_user_id").in("post_id", ids),
    db.from("feed_comments").select("post_id").in("post_id", ids).eq("status", "published").is("hidden_at", null),
    me
      ? db.from("feed_marks").select("post_id").eq("auth_user_id", me).eq("kind", "bookmark").in("post_id", ids)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
    attachmentsFor(db, rows),
  ]);
  if (authorError) throw new Error(`feed_authors_read_failed:${authorError.message}`);
  if (reactionError) throw new Error(`feed_reactions_read_failed:${reactionError.message}`);

  const authorById = new Map(((authors ?? []) as AuthorRow[]).map((row) => [row.id, row]));
  const saved = new Set(((savedRows ?? []) as { post_id: string }[]).map((row) => row.post_id));
  const reactionsByPost = new Map<string, { emoji: string; auth_user_id: string }[]>();
  for (const row of (reactions ?? []) as { post_id: string; emoji: string; auth_user_id: string }[]) {
    const list = reactionsByPost.get(row.post_id) ?? [];
    list.push(row);
    reactionsByPost.set(row.post_id, list);
  }
  const commentsByPost = new Map<string, number>();
  for (const row of (comments ?? []) as { post_id: string }[]) {
    commentsByPost.set(row.post_id, (commentsByPost.get(row.post_id) ?? 0) + 1);
  }

  return rows.flatMap((row) => {
    const author = authorById.get(row.author_id);
    if (!author) return [];
    const mine = me !== null && row.created_by === me;
    const topics = storedTopics(row);
    const tagged = (row.tagged_author_ids ?? []).flatMap((id) => {
      const tag = authorById.get(id);
      return tag && tag.listed === true && id !== row.author_id ? [authorOf(tag)] : [];
    });
    return [
      {
        id: row.id,
        author: authorOf(author),
        body: row.body,
        topic: topics[0] as FeedTopic,
        topics,
        media: readFeedMedia(row.media),
        tagged,
        status: row.status as FeedPostStatus,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        attachment: attachments.get(row.id) ?? null,
        reactions: countReactions(reactionsByPost.get(row.id) ?? [], me),
        commentCount: commentsByPost.get(row.id) ?? 0,
        mine,
        saved: saved.has(row.id),
        ...(mine
          ? {
              heldReason: row.held_reason,
              returnedReason: row.returned_reason,
              source: {
                courseId: row.course_id,
                lessonId: row.lesson_id,
                blockId: row.block_id,
                blockDisplay: (row.block_display === "excerpt" ? "excerpt" : "full") as FeedBlockDisplay,
              },
            }
          : {}),
      },
    ];
  });
}

/** A row's topics, read leniently: the list, else the single old column, else «focus». */
function storedTopics(row: PostRow): FeedTopic[] {
  const list = (row.topics ?? []).filter(isFeedTopic);
  if (list.length) return [...new Set(list)];
  return [isFeedTopic(row.topic) ? row.topic : "focus"];
}

/** Author slugs → ids. An unknown slug narrows to nothing rather than to everything. */
async function authorIdsForSlugs(db: Db, slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const { data, error } = await db.from("lms_authors").select("id, slug").in("slug", slugs).eq("listed", true);
  if (error) throw new Error(`feed_authors_read_failed:${error.message}`);
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

export type FeedPage = { posts: FeedPost[]; next: string | null };

/**
 * One page of the published feed, newest first. `before` is the
 * `published_at` of the last post already shown.
 */
export async function listFeed(
  db: Db,
  options: { filter: FeedFilter; before?: string | null; limit?: number; me: string | null; authorId?: string | null },
): Promise<FeedPage> {
  const limit = Math.min(Math.max(options.limit ?? FEED_PAGE_SIZE, 1), 50);
  let query = db
    .from("feed_posts")
    .select(POST_COLUMNS)
    .eq("status", "published")
    .is("hidden_at", null)
    .order("published_at", { ascending: false })
    .limit(limit + 1);

  // Any of the post's topics matches (G 2026-10-17: a post has one to three).
  if (options.filter.topics.length) query = query.overlaps("topics", options.filter.topics);
  if (options.authorId) query = query.eq("author_id", options.authorId);
  if (options.filter.authors.length) {
    const ids = await authorIdsForSlugs(db, options.filter.authors);
    if (ids.length === 0) return { posts: [], next: null };
    query = query.in("author_id", ids);
  }
  if (options.before) query = query.lt("published_at", options.before);

  const { data, error } = await query;
  if (error) throw new Error(`feed_read_failed:${error.message}`);
  const rows = (data ?? []) as PostRow[];
  const page = rows.slice(0, limit);
  const posts = await decorate(db, page, options.me);
  return { posts, next: rows.length > limit ? (page[page.length - 1]?.published_at ?? null) : null };
}

/** One post: published for everyone, or any state for the author who wrote it. */
export async function getFeedPost(db: Db, id: string, me: string | null): Promise<FeedPost | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db
    .from("feed_posts")
    .select(POST_COLUMNS)
    .eq("id", id)
    .is("hidden_at", null)
    .maybeSingle();
  if (error) throw new Error(`feed_read_failed:${error.message}`);
  const row = data as PostRow | null;
  if (!row) return null;
  if (row.status !== "published" && row.created_by !== me) return null;
  const [post] = await decorate(db, [row], me);
  return post ?? null;
}

/** The author's own posts in every state, newest first — «Мої дописи». */
export async function listOwnPosts(db: Db, author: FeedAuthor & { userId: string }): Promise<FeedPost[]> {
  const { data, error } = await db
    .from("feed_posts")
    .select(POST_COLUMNS)
    .eq("author_id", author.id)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`feed_read_failed:${error.message}`);
  return decorate(db, (data ?? []) as PostRow[], author.userId);
}

/* ─────────────────────────── writing a post ─────────────────────────── */

export type FeedPostInput = {
  body?: unknown;
  /** The old single topic; `topics` wins when both are sent. */
  topic?: unknown;
  topics?: unknown;
  media?: unknown;
  taggedAuthorIds?: unknown;
  courseId?: unknown;
  lessonId?: unknown;
  blockId?: unknown;
  blockDisplay?: unknown;
};

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * The attachment a post may carry: only the author's own programme, and a
 * lesson and block that are really in it.
 */
async function checkedAttachment(
  db: Db,
  author: FeedAuthor & { userId: string },
  input: FeedPostInput,
): Promise<{
  course_id: string | null;
  lesson_id: string | null;
  block_id: string | null;
  block_display: FeedBlockDisplay;
}> {
  const display: FeedBlockDisplay = input.blockDisplay === "full" ? "full" : "excerpt";
  if (input.courseId === undefined || input.courseId === null || input.courseId === "") {
    return { course_id: null, lesson_id: null, block_id: null, block_display: display };
  }
  if (!isUuid(input.courseId)) throw new FeedError("attachment_invalid");

  const { data: course } = await db
    .from("lms_courses")
    .select("id, author_id, author_profile_id")
    .eq("id", input.courseId)
    .maybeSingle();
  const owned =
    course &&
    ((course as { author_profile_id: string | null }).author_profile_id === author.id ||
      (course as { author_id: string | null }).author_id === author.userId);
  if (!owned) throw new FeedError("attachment_not_yours", 403);

  if (input.lessonId === undefined || input.lessonId === null || input.lessonId === "") {
    return { course_id: input.courseId, lesson_id: null, block_id: null, block_display: display };
  }
  if (!isUuid(input.lessonId)) throw new FeedError("attachment_invalid");
  const { data: lesson } = await db
    .from("lms_lessons")
    .select("id, course_id, blocks")
    .eq("id", input.lessonId)
    .maybeSingle();
  if (!lesson || (lesson as { course_id: string }).course_id !== input.courseId) {
    throw new FeedError("attachment_invalid");
  }
  let blockId: string | null = null;
  if (typeof input.blockId === "string" && input.blockId) {
    if (!feedBlockText((lesson as { blocks: unknown }).blocks, input.blockId))
      throw new FeedError("attachment_invalid");
    blockId = input.blockId;
  }
  return { course_id: input.courseId, lesson_id: input.lessonId, block_id: blockId, block_display: display };
}

export type CreatedPost = { post: FeedPost; verdict: GateVerdict };

/**
 * Listed author profiles a post may name «з …»: real, listed, not the writer,
 * at most three. An unknown or unlisted id is refused rather than dropped, so
 * the composer learns its list went stale.
 */
async function checkedTags(db: Db, author: FeedAuthor, input: unknown): Promise<string[]> {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || !input.every(isUuid)) throw new FeedError("tags_invalid");
  const ids = [...new Set(input as string[])].filter((id) => id !== author.id);
  if (ids.length > FEED_TAGS_MAX) throw new FeedError("tags_too_many");
  if (ids.length === 0) return [];
  const { data, error } = await db.from("lms_authors").select("id, listed").in("id", ids).eq("listed", true);
  if (error) throw new Error(`feed_authors_read_failed:${error.message}`);
  if (((data ?? []) as { id: string }[]).length !== ids.length) throw new FeedError("tags_invalid");
  return ids;
}

/** Everything a post's writing checks, in one place for create and resubmit. */
async function checkedPost(db: Db, author: FeedAuthor & { userId: string }, input: FeedPostInput) {
  const body = normalizeFeedText(input.body, FEED_POST_RAW_MAX);
  if (!body) throw new FeedError("body_invalid");
  const plain = feedPlainText(body).trim();
  if (!plain) throw new FeedError("body_invalid");
  if (plain.length > FEED_POST_MAX) throw new FeedError("body_too_long");
  const topics = normalizeFeedTopics(input.topics, input.topic);
  if (!topics) throw new FeedError("topic_invalid");
  const media = checkFeedMedia(input.media, author.id);
  if ("error" in media) throw new FeedError(media.error);
  const tagged = await checkedTags(db, author, input.taggedAuthorIds);
  const attachment = await checkedAttachment(db, author, input);
  // The gate reads the words and every link's address, never the markup.
  const verdict = checkFeedText(feedGateText(body));
  return {
    verdict,
    fields: {
      body,
      topic: topics[0] as FeedTopic,
      topics,
      media: media.media as unknown as Json,
      tagged_author_ids: tagged,
      ...attachment,
    },
  };
}

/**
 * Writes a post and runs the check. Passed — published at once. Stopped — it
 * waits as `held`, and the caller sends the card to the team's group.
 */
export async function createFeedPost(
  db: Db,
  author: FeedAuthor & { userId: string },
  input: FeedPostInput,
  now: Date = new Date(),
): Promise<CreatedPost> {
  const { verdict, fields } = await checkedPost(db, author, input);
  const at = now.toISOString();
  const { data, error } = await db
    .from("feed_posts")
    .insert({
      author_id: author.id,
      created_by: author.userId,
      ...fields,
      status: verdict.pass ? "published" : "held",
      gate: verdict as unknown as Json,
      held_reason: verdict.pass ? null : verdict.findings.map((finding) => finding.label).join("; "),
      published_at: verdict.pass ? at : null,
      created_at: at,
      updated_at: at,
    })
    .select(POST_COLUMNS)
    .single();
  if (error) throw new Error(`feed_post_write_failed:${error.message}`);
  const [post] = await decorate(db, [data as PostRow], author.userId);
  if (!post) throw new Error("feed_post_write_failed:decorate");
  return { post, verdict };
}

/**
 * The author edits a post that came back (`returned`) and sends it again: the
 * text, topic and attachment change, the check runs again.
 */
export async function resubmitFeedPost(
  db: Db,
  author: FeedAuthor & { userId: string },
  id: string,
  input: FeedPostInput,
  now: Date = new Date(),
): Promise<CreatedPost> {
  if (!isUuid(id)) throw new FeedError("not_found", 404);
  const { data: existing } = await db.from("feed_posts").select("id, author_id, status").eq("id", id).maybeSingle();
  const row = existing as { author_id: string; status: string } | null;
  if (!row || row.author_id !== author.id) throw new FeedError("not_found", 404);
  if (row.status !== "returned") throw new FeedError("not_returned", 409);

  /* Checked exactly as on creation: the composer sends the attachment, media
     and tags again, changed or removed, and they land as validated or not at all. */
  const { verdict, fields } = await checkedPost(db, author, input);
  const at = now.toISOString();
  const { data, error } = await db
    .from("feed_posts")
    .update({
      ...fields,
      status: verdict.pass ? "published" : "held",
      gate: verdict as unknown as Json,
      held_reason: verdict.pass ? null : verdict.findings.map((finding) => finding.label).join("; "),
      returned_reason: null,
      published_at: verdict.pass ? at : null,
      tg_message_id: null,
      decided_by: null,
      updated_at: at,
    })
    .eq("id", id)
    .select(POST_COLUMNS)
    .single();
  if (error) throw new Error(`feed_post_write_failed:${error.message}`);
  const [post] = await decorate(db, [data as PostRow], author.userId);
  if (!post) throw new Error("feed_post_write_failed:decorate");
  return { post, verdict };
}

/** The author removes their own post. Removing what is gone is success. */
export async function deleteFeedPost(db: Db, author: FeedAuthor & { userId: string }, id: string): Promise<void> {
  if (!isUuid(id)) return;
  const { error } = await db.from("feed_posts").delete().eq("id", id).eq("author_id", author.id);
  if (error) throw new Error(`feed_post_delete_failed:${error.message}`);
}

/* ─────────────────────────── the team's decision ─────────────────────────── */

export type HeldPostCard = {
  id: string;
  authorName: string;
  body: string;
  verdict: GateVerdict | null;
  tgMessageId: number | null;
  status: FeedPostStatus;
};

export async function readHeldPost(db: Db, id: string): Promise<HeldPostCard | null> {
  if (!isUuid(id)) return null;
  const { data } = await db
    .from("feed_posts")
    .select("id, author_id, body, gate, status, tg_message_id")
    .eq("id", id)
    .maybeSingle();
  const row = data as {
    id: string;
    author_id: string;
    body: string;
    gate: unknown;
    status: string;
    tg_message_id: number | null;
  } | null;
  if (!row) return null;
  const { data: author } = await db.from("lms_authors").select("name").eq("id", row.author_id).maybeSingle();
  return {
    id: row.id,
    authorName: (author as { name: string } | null)?.name ?? "Автор",
    body: row.body,
    verdict: (row.gate as GateVerdict | null) ?? null,
    tgMessageId: row.tg_message_id,
    status: row.status as FeedPostStatus,
  };
}

export async function rememberCardMessage(db: Db, id: string, messageId: number): Promise<void> {
  await db.from("feed_posts").update({ tg_message_id: messageId }).eq("id", id);
}

/**
 * «Опублікувати» or «Повернути» from the team's group. Only a post that still
 * waits is decided; a second press on a decided card changes nothing and says
 * what was decided.
 */
export async function decideHeldPost(
  db: Db,
  id: string,
  decision: "publish" | "return",
  by: string,
  now: Date = new Date(),
): Promise<{ changed: boolean; status: FeedPostStatus | null }> {
  if (!isUuid(id)) return { changed: false, status: null };
  const at = now.toISOString();
  const patch =
    decision === "publish"
      ? { status: "published", published_at: at, decided_by: by, updated_at: at }
      : { status: "returned", decided_by: by, updated_at: at };
  const { data, error } = await db
    .from("feed_posts")
    .update(patch)
    .eq("id", id)
    .eq("status", "held")
    .select("id, status");
  if (error) throw new Error(`feed_decide_failed:${error.message}`);
  if ((data ?? []).length > 0) return { changed: true, status: patch.status as FeedPostStatus };
  const { data: current } = await db.from("feed_posts").select("status").eq("id", id).maybeSingle();
  return { changed: false, status: ((current as { status: string } | null)?.status as FeedPostStatus) ?? null };
}

/** The reason a team member typed in reply to the card, for the author to read. */
export async function setReturnReason(db: Db, tgMessageId: number, reason: string): Promise<boolean> {
  const text = reason.trim().slice(0, 500);
  if (!text) return false;
  const { data, error } = await db
    .from("feed_posts")
    .update({ returned_reason: text })
    .eq("tg_message_id", tgMessageId)
    .eq("status", "returned")
    .select("id");
  if (error) throw new Error(`feed_return_reason_failed:${error.message}`);
  return (data ?? []).length > 0;
}

/* ─────────────────────────── reactions ─────────────────────────── */

async function publishedPostExists(db: Db, id: string): Promise<{ created_by: string; author_id: string } | null> {
  if (!isUuid(id)) return null;
  const { data } = await db
    .from("feed_posts")
    .select("id, created_by, author_id, status, hidden_at")
    .eq("id", id)
    .maybeSingle();
  const row = data as { created_by: string; author_id: string; status: string; hidden_at: string | null } | null;
  return row && row.status === "published" && !row.hidden_at ? row : null;
}

/** Presses or releases one reaction; answers the post's counts after. */
export async function toggleReaction(db: Db, postId: string, userId: string, emoji: unknown): Promise<ReactionCount[]> {
  if (!isFeedEmoji(emoji)) throw new FeedError("emoji_invalid");
  if (!(await publishedPostExists(db, postId))) throw new FeedError("not_found", 404);

  const { data: existing } = await db
    .from("feed_reactions")
    .select("emoji")
    .eq("post_id", postId)
    .eq("auth_user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();
  if (existing) {
    const { error } = await db
      .from("feed_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("auth_user_id", userId)
      .eq("emoji", emoji);
    if (error) throw new Error(`feed_reaction_write_failed:${error.message}`);
  } else {
    /* Three different emoji per person per post (G 2026-10-17). Asked here so
       the answer is a code the picker can say; the schema's trigger is the
       floor under it, and its refusal reads the same. */
    const { data: own, error: ownError } = await db
      .from("feed_reactions")
      .select("emoji")
      .eq("post_id", postId)
      .eq("auth_user_id", userId);
    if (ownError) throw new Error(`feed_reactions_read_failed:${ownError.message}`);
    if (((own ?? []) as { emoji: string }[]).length >= FEED_REACTIONS_PER_PERSON) {
      throw new FeedError("reaction_limit", 409);
    }
    const { error } = await db.from("feed_reactions").insert({ post_id: postId, auth_user_id: userId, emoji });
    if (error && /feed_reaction_limit/i.test(error.message)) throw new FeedError("reaction_limit", 409);
    // A double press racing itself lands on the primary key; that is the state asked for.
    if (error && !/duplicate|23505/i.test(error.message))
      throw new Error(`feed_reaction_write_failed:${error.message}`);
  }
  const { data: rows, error } = await db.from("feed_reactions").select("emoji, auth_user_id").eq("post_id", postId);
  if (error) throw new Error(`feed_reactions_read_failed:${error.message}`);
  return countReactions((rows ?? []) as { emoji: string; auth_user_id: string }[], userId);
}

/* ─────────────────────────── comments ─────────────────────────── */

type CommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  auth_user_id: string;
  body: string;
  created_at: string;
  status: string;
};

type Commenter = { name: string; avatar: string | null };

async function commenters(db: Db, userIds: string[]): Promise<Map<string, Commenter>> {
  if (userIds.length === 0) return new Map();
  const { data } = await db
    .from("platform_users")
    .select("auth_user_id, full_name, avatar_url")
    .in("auth_user_id", userIds);
  return new Map(
    ((data ?? []) as { auth_user_id: string; full_name: string | null; avatar_url: string | null }[]).map((row) => [
      row.auth_user_id,
      { name: (row.full_name ?? "").trim(), avatar: row.avatar_url?.trim() || null },
    ]),
  );
}

/** The post's author as a commenter sees them: name, face, profile. */
async function postAuthorOf(db: Db, authorId: string): Promise<FeedAuthor | null> {
  const { data } = await db
    .from("lms_authors")
    .select("id, slug, name, photo, listed, auth_user_id")
    .eq("id", authorId)
    .maybeSingle();
  return data ? authorOf(data as AuthorRow) : null;
}

function commentWho(byAuthor: boolean, author: FeedAuthor | null, person: Commenter | undefined): FeedComment["who"] {
  if (byAuthor && author) {
    return {
      name: author.name,
      initial: author.name.trim().charAt(0).toUpperCase(),
      photo: author.photo,
      href: feedAuthorPath(author.slug),
    };
  }
  const name = byAuthor ? "Автор" : publicName(person?.name);
  return {
    name,
    initial: name.charAt(0).toUpperCase(),
    photo: !byAuthor && person?.avatar ? { src: person.avatar, alt: name } : null,
    href: null,
  };
}

/** First name and the initial of the last, never an email: a comment is public. */
export function publicName(full: string | null | undefined): string {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Учасник";
  if (parts.length === 1) return parts[0] ?? "Учасник";
  return `${parts[0]} ${(parts[parts.length - 1] ?? "").charAt(0)}.`;
}

/**
 * A post's thread, oldest first, replies under their comment. The reader's own
 * held comment is shown to them (marked by the client); nobody else sees it.
 */
export async function listComments(db: Db, postId: string, me: string | null): Promise<FeedComment[]> {
  const post = await publishedPostExists(db, postId);
  if (!post) throw new FeedError("not_found", 404);
  const { data, error } = await db
    .from("feed_comments")
    .select("id, post_id, parent_id, auth_user_id, body, created_at, status")
    .eq("post_id", postId)
    .is("hidden_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(`feed_comments_read_failed:${error.message}`);
  const rows = ((data ?? []) as CommentRow[]).filter((row) => row.status === "published" || row.auth_user_id === me);
  const [people, author] = await Promise.all([
    commenters(db, [...new Set(rows.map((row) => row.auth_user_id))]),
    postAuthorOf(db, post.author_id),
  ]);
  return rows.map((row) => {
    const byAuthor = row.auth_user_id === post.created_by;
    return {
      id: row.id,
      parentId: row.parent_id,
      body: row.body,
      createdAt: row.created_at,
      who: commentWho(byAuthor, author, people.get(row.auth_user_id)),
      byAuthor,
      mine: row.auth_user_id === me,
      canHide: me !== null && me === post.created_by && !byAuthor,
    };
  });
}

export type CreatedComment = { comment: FeedComment; verdict: GateVerdict; held: boolean };

export async function addComment(
  db: Db,
  postId: string,
  userId: string,
  input: { body?: unknown; parentId?: unknown },
  now: Date = new Date(),
): Promise<CreatedComment> {
  const post = await publishedPostExists(db, postId);
  if (!post) throw new FeedError("not_found", 404);
  const body = normalizeFeedText(input.body, FEED_COMMENT_MAX);
  if (!body) throw new FeedError("body_invalid");

  let parentId: string | null = null;
  if (input.parentId !== undefined && input.parentId !== null && input.parentId !== "") {
    if (!isUuid(input.parentId)) throw new FeedError("parent_invalid");
    const { data: parent } = await db
      .from("feed_comments")
      .select("id, post_id, parent_id")
      .eq("id", input.parentId)
      .maybeSingle();
    const row = parent as { post_id: string; parent_id: string | null } | null;
    if (!row || row.post_id !== postId) throw new FeedError("parent_invalid");
    // One level of replies: answering a reply answers the comment it hangs under.
    parentId = row.parent_id ?? input.parentId;
  }

  const verdict = checkFeedText(body);
  const { data, error } = await db
    .from("feed_comments")
    .insert({
      post_id: postId,
      parent_id: parentId,
      auth_user_id: userId,
      body,
      status: verdict.pass ? "published" : "held",
      gate: verdict as unknown as Json,
      created_at: now.toISOString(),
    })
    .select("id, post_id, parent_id, auth_user_id, body, created_at, status")
    .single();
  if (error) throw new Error(`feed_comment_write_failed:${error.message}`);
  const row = data as CommentRow;
  const byAuthor = userId === post.created_by;
  const [people, author] = await Promise.all([
    byAuthor ? Promise.resolve(new Map<string, Commenter>()) : commenters(db, [userId]),
    byAuthor ? postAuthorOf(db, post.author_id) : Promise.resolve(null),
  ]);
  return {
    comment: {
      id: row.id,
      parentId: row.parent_id,
      body: row.body,
      createdAt: row.created_at,
      who: commentWho(byAuthor, author, people.get(userId)),
      byAuthor,
      mine: true,
      canHide: false,
    },
    verdict,
    held: !verdict.pass,
  };
}

/**
 * Removes a comment: its writer deletes it; the post's author hides it from
 * their post. Anyone else is refused.
 */
export async function removeComment(db: Db, commentId: string, userId: string, now: Date = new Date()): Promise<void> {
  if (!isUuid(commentId)) throw new FeedError("not_found", 404);
  const { data } = await db.from("feed_comments").select("id, auth_user_id, post_id").eq("id", commentId).maybeSingle();
  const row = data as { auth_user_id: string; post_id: string } | null;
  if (!row) return;
  if (row.auth_user_id === userId) {
    const { error } = await db.from("feed_comments").delete().eq("id", commentId);
    if (error) throw new Error(`feed_comment_delete_failed:${error.message}`);
    return;
  }
  const { data: postRow } = await db.from("feed_posts").select("created_by").eq("id", row.post_id).maybeSingle();
  const post = postRow as { created_by: string } | null;
  if (post?.created_by !== userId) throw new FeedError("forbidden", 403);
  /* The thread goes with it: a reply whose parent is hidden has nowhere to
     be drawn, and would still be counted on the card. Deleting cascades the
     same way through `parent_id`. */
  const { error } = await db
    .from("feed_comments")
    .update({ hidden_at: now.toISOString(), hidden_by: userId })
    .or(`id.eq.${commentId},parent_id.eq.${commentId}`)
    .is("hidden_at", null);
  if (error) throw new Error(`feed_comment_hide_failed:${error.message}`);
}

/* ─────────────────────────── marks (the journal) ─────────────────────────── */

export type FeedMark = {
  clientId: string;
  /** `highlight` — a passage, with its note; `bookmark` — the whole post, «Зберегти». */
  kind: "highlight" | "bookmark";
  postId: string;
  quote: string | null;
  prefix: string | null;
  start: number | null;
  end: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type MarkRow = {
  client_id: string;
  kind: string;
  post_id: string;
  quote: string | null;
  prefix: string | null;
  start_offset: number | null;
  end_offset: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

const MARK_COLUMNS = "client_id, kind, post_id, quote, prefix, start_offset, end_offset, note, created_at, updated_at";

function markOf(row: MarkRow): FeedMark {
  return {
    clientId: row.client_id,
    kind: row.kind === "bookmark" ? "bookmark" : "highlight",
    postId: row.post_id,
    quote: row.quote,
    prefix: row.prefix,
    start: row.start_offset,
    end: row.end_offset,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveFeedMark(
  db: Db,
  userId: string,
  input: {
    clientId?: unknown;
    postId?: unknown;
    quote?: unknown;
    prefix?: unknown;
    start?: unknown;
    end?: unknown;
    note?: unknown;
  },
  now: Date = new Date(),
): Promise<FeedMark> {
  if (
    typeof input.clientId !== "string" ||
    !/^[A-Za-z0-9_-]{6,64}$/.test(input.clientId) ||
    input.clientId.startsWith("saved-")
  ) {
    throw new FeedError("client_id_invalid");
  }
  if (typeof input.postId !== "string" || !(await publishedPostExists(db, input.postId))) {
    throw new FeedError("not_found", 404);
  }
  const quote = typeof input.quote === "string" ? input.quote.trim().slice(0, 600) : "";
  if (!quote) throw new FeedError("quote_invalid");
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 2000) || null : null;
  const int = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null);
  const at = now.toISOString();
  const { data, error } = await db
    .from("feed_marks")
    .upsert(
      {
        auth_user_id: userId,
        post_id: input.postId,
        client_id: input.clientId,
        kind: "highlight",
        quote,
        prefix: typeof input.prefix === "string" ? input.prefix.slice(-80) : null,
        start_offset: int(input.start),
        end_offset: int(input.end),
        note,
        updated_at: at,
      },
      { onConflict: "auth_user_id,client_id" },
    )
    .select(MARK_COLUMNS)
    .single();
  if (error) throw new Error(`feed_mark_write_failed:${error.message}`);
  return markOf(data as MarkRow);
}

/* ─────────────────────────── «Зберегти» ─────────────────────────── */

/** How much of the post the journal row quotes, so two saved posts of one author differ. */
const SAVED_QUOTE_CHARS = 200;

/**
 * «Зберегти»: the post goes to the reader's «Мій журнал» as a bookmark — a
 * `feed_marks` row of kind `bookmark`, which the journal already reads and
 * draws as «Стрічка · <автор>». Saving what is saved is success.
 */
export async function saveFeedPost(db: Db, userId: string, postId: string, now: Date = new Date()): Promise<void> {
  if (!(await publishedPostExists(db, postId))) throw new FeedError("not_found", 404);
  const { data: post } = await db.from("feed_posts").select("body").eq("id", postId).maybeSingle();
  const body = (post as { body: string } | null)?.body ?? "";
  const at = now.toISOString();
  const { error } = await db.from("feed_marks").upsert(
    {
      auth_user_id: userId,
      post_id: postId,
      client_id: feedSavedClientId(postId),
      kind: "bookmark",
      quote: excerptOf(feedPlainText(body), SAVED_QUOTE_CHARS) || null,
      updated_at: at,
    },
    { onConflict: "auth_user_id,client_id" },
  );
  if (error && !/duplicate|23505/i.test(error.message)) throw new Error(`feed_save_failed:${error.message}`);
}

/** Takes the post back out of the journal. Removing what is not there is success. */
export async function unsaveFeedPost(db: Db, userId: string, postId: string): Promise<void> {
  if (!isUuid(postId)) return;
  const { error } = await db
    .from("feed_marks")
    .delete()
    .eq("auth_user_id", userId)
    .eq("post_id", postId)
    .eq("kind", "bookmark");
  if (error) throw new Error(`feed_unsave_failed:${error.message}`);
}

export async function deleteFeedMark(db: Db, userId: string, clientId: string): Promise<void> {
  const { error } = await db.from("feed_marks").delete().eq("auth_user_id", userId).eq("client_id", clientId);
  if (error) throw new Error(`feed_mark_delete_failed:${error.message}`);
}

/**
 * The reader's marks, newest first, each with its post's author name for the
 * journal. With `postIds` — the passages to paint on those posts — only
 * highlights: a saved post is shown by its bookmark button, not painted.
 * Without — the journal — highlights and bookmarks both.
 */
export async function listFeedMarks(
  db: Db,
  userId: string,
  postIds?: string[],
): Promise<(FeedMark & { authorName: string | null })[]> {
  let query = db.from("feed_marks").select(MARK_COLUMNS).eq("auth_user_id", userId).order("created_at", {
    ascending: false,
  });
  if (postIds) {
    const ids = postIds.filter(isUuid);
    if (ids.length === 0) return [];
    query = query.in("post_id", ids).eq("kind", "highlight");
  }
  const { data, error } = await query.limit(1000);
  if (error) throw new Error(`feed_marks_read_failed:${error.message}`);
  const marks = ((data ?? []) as MarkRow[]).map(markOf);
  const ids = [...new Set(marks.map((mark) => mark.postId))];
  if (ids.length === 0) return [];
  const { data: posts } = await db.from("feed_posts").select("id, author_id").in("id", ids);
  const authorIds = [...new Set(((posts ?? []) as { author_id: string }[]).map((row) => row.author_id))];
  const { data: authors } = authorIds.length
    ? await db.from("lms_authors").select("id, name").in("id", authorIds)
    : { data: [] };
  const nameByAuthor = new Map(((authors ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const authorByPost = new Map(
    ((posts ?? []) as { id: string; author_id: string }[]).map((row) => [
      row.id,
      nameByAuthor.get(row.author_id) ?? null,
    ]),
  );
  return marks.map((mark) => ({ ...mark, authorName: authorByPost.get(mark.postId) ?? null }));
}

/* ─────────────────────────── composer: authors to name ─────────────────────────── */

/** Every listed author but the writer, by name — the composer's «з …» menu. */
export async function listTaggableAuthors(db: Db, author: FeedAuthor): Promise<FeedAuthor[]> {
  const { data, error } = await db
    .from("lms_authors")
    .select("id, slug, name, photo, listed, auth_user_id")
    .eq("listed", true)
    .order("name")
    .limit(500);
  if (error) throw new Error(`feed_authors_read_failed:${error.message}`);
  return ((data ?? []) as AuthorRow[]).filter((row) => row.id !== author.id).map(authorOf);
}

/* ─────────────────────────── composer: the author's blocks ─────────────────────────── */

export type ComposerCourse = {
  id: string;
  title: string;
  slug: string | null;
  programSlug: string | null;
  lessons: {
    id: string;
    title: string;
    dayIndex: number | null;
    /** Each block whole: the composer previews it as the card the feed will draw. */
    blocks: { id: string; label: string; kind: string; block: FeedLessonBlock }[];
  }[];
};

/** The author's own programmes, lessons and blocks, for «+ Блок з програми». */
export async function listComposerCourses(db: Db, author: FeedAuthor & { userId: string }): Promise<ComposerCourse[]> {
  const { data: courses, error } = await db
    .from("lms_courses")
    .select("id, title, slug, program_slug, author_id, author_profile_id")
    .or(`author_profile_id.eq.${author.id},author_id.eq.${author.userId}`)
    .order("title");
  if (error) throw new Error(`feed_composer_read_failed:${error.message}`);
  const list = (courses ?? []) as { id: string; title: string; slug: string | null; program_slug: string | null }[];
  if (list.length === 0) return [];
  const { data: lessons, error: lessonError } = await db
    .from("lms_lessons")
    .select("id, course_id, title, order, day_index, blocks")
    .in(
      "course_id",
      list.map((course) => course.id),
    )
    .order("order");
  if (lessonError) throw new Error(`feed_composer_read_failed:${lessonError.message}`);
  const byCourse = new Map<string, ComposerCourse["lessons"]>();
  for (const lesson of (lessons ?? []) as {
    id: string;
    course_id: string;
    title: string;
    day_index: number | null;
    blocks: unknown;
  }[]) {
    const entry = byCourse.get(lesson.course_id) ?? [];
    entry.push({
      id: lesson.id,
      title: lesson.title,
      dayIndex: lesson.day_index,
      blocks: feedBlockOptions(lesson.blocks),
    });
    byCourse.set(lesson.course_id, entry);
  }
  return list.map((course) => ({
    id: course.id,
    title: course.title,
    slug: course.slug,
    programSlug: course.program_slug,
    lessons: byCourse.get(course.id) ?? [],
  }));
}
