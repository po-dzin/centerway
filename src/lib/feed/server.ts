/**
 * «Стрічка» — the database half (2026-10-16). Server-only.
 *
 * Schema: supabase/migrations/20261016150000_author_feed.sql. Every function
 * takes the client as its first argument, so the tests hand in the fake.
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

import { feedBlockOptions, feedBlockText } from "./blocks";
import { checkFeedText, type GateVerdict } from "./gate";
import {
  FEED_COMMENT_MAX,
  FEED_PAGE_SIZE,
  FEED_POST_MAX,
  countReactions,
  excerptOf,
  isFeedEmoji,
  isFeedTopic,
  normalizeFeedText,
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

export type FeedAuthor = { id: string; slug: string; name: string; photo: { src: string; alt: string } | null };

export type FeedAttachment = {
  /** A block of a lesson, or the programme itself. */
  kind: "block" | "program";
  title: string;
  /** «Шлях 21 · урок 2» — where it is from. */
  meta: string;
  /** The block's words, whole or opening; empty for a video or the programme. */
  text: string;
  full: boolean;
  media: "video" | "image" | null;
  durationMin: number | null;
  /** The programme page, where the reader can go on. */
  href: string | null;
};

export type FeedPost = {
  id: string;
  author: FeedAuthor;
  body: string;
  topic: FeedTopic;
  status: FeedPostStatus;
  publishedAt: string | null;
  createdAt: string;
  attachment: FeedAttachment | null;
  reactions: ReactionCount[];
  commentCount: number;
  /** The reader wrote this post. */
  mine: boolean;
  /** Only the post's own author sees why it waits or came back. */
  heldReason?: string | null;
  returnedReason?: string | null;
};

export type FeedComment = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  who: { name: string; initial: string };
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
  "id, author_id, created_by, body, topic, course_id, lesson_id, block_id, block_display, status, held_reason, returned_reason, published_at, created_at, tg_message_id";

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
    photo: photo && typeof photo.src === "string" ? { src: photo.src, alt: photo.alt ?? row.name } : null,
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
    db.from("lms_courses").select("id, title, program_slug").in("id", courseIds),
    lessonIds.length
      ? db.from("lms_lessons").select("id, title, day_index, blocks").in("id", lessonIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const courseById = new Map(
    ((courses ?? []) as { id: string; title: string; program_slug: string }[]).map((row) => [row.id, row]),
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
    const href = course.program_slug ? `/programs/${course.program_slug}` : null;
    const lesson = row.lesson_id ? lessonById.get(row.lesson_id) : undefined;
    if (!lesson) {
      out.set(row.id, {
        kind: "program",
        title: course.title,
        meta: "Програма",
        text: "",
        full: false,
        media: null,
        durationMin: null,
        href,
      });
      continue;
    }
    const block = row.block_id ? feedBlockText(lesson.blocks, row.block_id) : null;
    // A block the author has since deleted takes its words with it; the post
    // keeps pointing at the lesson's programme rather than losing its card.
    const full = row.block_display === "full";
    const text = block?.text ?? "";
    out.set(row.id, {
      kind: "block",
      title: block?.title || lesson.title,
      meta: [course.title, lesson.day_index ? `день ${lesson.day_index}` : lesson.title].filter(Boolean).join(" · "),
      text: full ? text : excerptOf(text),
      full,
      media: block?.media ?? null,
      durationMin: block?.durationMin ?? null,
      href,
    });
  }
  return out;
}

async function decorate(db: Db, rows: PostRow[], me: string | null): Promise<FeedPost[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const authorIds = [...new Set(rows.map((row) => row.author_id))];

  const [
    { data: authors, error: authorError },
    { data: reactions, error: reactionError },
    { data: comments },
    attachments,
  ] = await Promise.all([
    db.from("lms_authors").select("id, slug, name, photo, listed, auth_user_id").in("id", authorIds),
    db.from("feed_reactions").select("post_id, emoji, auth_user_id").in("post_id", ids),
    db.from("feed_comments").select("post_id").in("post_id", ids).eq("status", "published").is("hidden_at", null),
    attachmentsFor(db, rows),
  ]);
  if (authorError) throw new Error(`feed_authors_read_failed:${authorError.message}`);
  if (reactionError) throw new Error(`feed_reactions_read_failed:${reactionError.message}`);

  const authorById = new Map(((authors ?? []) as AuthorRow[]).map((row) => [row.id, row]));
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
    return [
      {
        id: row.id,
        author: authorOf(author),
        body: row.body,
        topic: (isFeedTopic(row.topic) ? row.topic : "focus") as FeedTopic,
        status: row.status as FeedPostStatus,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        attachment: attachments.get(row.id) ?? null,
        reactions: countReactions(reactionsByPost.get(row.id) ?? [], me),
        commentCount: commentsByPost.get(row.id) ?? 0,
        mine,
        ...(mine ? { heldReason: row.held_reason, returnedReason: row.returned_reason } : {}),
      },
    ];
  });
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

  if (options.filter.topics.length) query = query.in("topic", options.filter.topics);
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
  body: unknown;
  topic: unknown;
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
 * Writes a post and runs the check. Passed — published at once. Stopped — it
 * waits as `held`, and the caller sends the card to the team's group.
 */
export async function createFeedPost(
  db: Db,
  author: FeedAuthor & { userId: string },
  input: FeedPostInput,
  now: Date = new Date(),
): Promise<CreatedPost> {
  const body = normalizeFeedText(input.body, FEED_POST_MAX);
  if (!body) throw new FeedError("body_invalid");
  if (!isFeedTopic(input.topic)) throw new FeedError("topic_invalid");
  const attachment = await checkedAttachment(db, author, input);

  const verdict = checkFeedText(body);
  const at = now.toISOString();
  const { data, error } = await db
    .from("feed_posts")
    .insert({
      author_id: author.id,
      created_by: author.userId,
      body,
      topic: input.topic,
      ...attachment,
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
 * text and topic change, the check runs again.
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

  const body = normalizeFeedText(input.body, FEED_POST_MAX);
  if (!body) throw new FeedError("body_invalid");
  if (!isFeedTopic(input.topic)) throw new FeedError("topic_invalid");
  const verdict = checkFeedText(body);
  const at = now.toISOString();
  const { data, error } = await db
    .from("feed_posts")
    .update({
      body,
      topic: input.topic,
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

async function publishedPostExists(db: Db, id: string): Promise<{ created_by: string } | null> {
  if (!isUuid(id)) return null;
  const { data } = await db.from("feed_posts").select("id, created_by, status, hidden_at").eq("id", id).maybeSingle();
  const row = data as { created_by: string; status: string; hidden_at: string | null } | null;
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
    const { error } = await db.from("feed_reactions").insert({ post_id: postId, auth_user_id: userId, emoji });
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

async function displayNames(db: Db, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data } = await db.from("platform_users").select("auth_user_id, full_name").in("auth_user_id", userIds);
  return new Map(
    ((data ?? []) as { auth_user_id: string; full_name: string | null }[]).map((row) => [
      row.auth_user_id,
      (row.full_name ?? "").trim(),
    ]),
  );
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
  const names = await displayNames(db, [...new Set(rows.map((row) => row.auth_user_id))]);
  return rows.map((row) => {
    const byAuthor = row.auth_user_id === post.created_by;
    const name = byAuthor ? null : publicName(names.get(row.auth_user_id));
    return {
      id: row.id,
      parentId: row.parent_id,
      body: row.body,
      createdAt: row.created_at,
      who: { name: name ?? "Автор", initial: (name ?? "А").charAt(0).toUpperCase() },
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
  input: { body: unknown; parentId?: unknown },
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
  const names = byAuthor ? new Map<string, string>() : await displayNames(db, [userId]);
  const name = byAuthor ? "Автор" : publicName(names.get(userId));
  return {
    comment: {
      id: row.id,
      parentId: row.parent_id,
      body: row.body,
      createdAt: row.created_at,
      who: { name, initial: name.charAt(0).toUpperCase() },
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
  const { error } = await db
    .from("feed_comments")
    .update({ hidden_at: now.toISOString(), hidden_by: userId })
    .eq("id", commentId);
  if (error) throw new Error(`feed_comment_hide_failed:${error.message}`);
}

/* ─────────────────────────── marks (the journal) ─────────────────────────── */

export type FeedMark = {
  clientId: string;
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
  post_id: string;
  quote: string | null;
  prefix: string | null;
  start_offset: number | null;
  end_offset: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

const MARK_COLUMNS = "client_id, post_id, quote, prefix, start_offset, end_offset, note, created_at, updated_at";

function markOf(row: MarkRow): FeedMark {
  return {
    clientId: row.client_id,
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
    clientId: unknown;
    postId: unknown;
    quote: unknown;
    prefix?: unknown;
    start?: unknown;
    end?: unknown;
    note?: unknown;
  },
  now: Date = new Date(),
): Promise<FeedMark> {
  if (typeof input.clientId !== "string" || !/^[A-Za-z0-9_-]{6,64}$/.test(input.clientId)) {
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

export async function deleteFeedMark(db: Db, userId: string, clientId: string): Promise<void> {
  const { error } = await db.from("feed_marks").delete().eq("auth_user_id", userId).eq("client_id", clientId);
  if (error) throw new Error(`feed_mark_delete_failed:${error.message}`);
}

/** The reader's marks, newest first, each with its post's author name for the journal. */
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
    query = query.in("post_id", ids);
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

/* ─────────────────────────── composer: the author's blocks ─────────────────────────── */

export type ComposerCourse = {
  id: string;
  title: string;
  lessons: { id: string; title: string; blocks: { id: string; label: string; kind: string }[] }[];
};

/** The author's own programmes, lessons and blocks, for «+ Блок з програми». */
export async function listComposerCourses(db: Db, author: FeedAuthor & { userId: string }): Promise<ComposerCourse[]> {
  const { data: courses, error } = await db
    .from("lms_courses")
    .select("id, title, author_id, author_profile_id")
    .or(`author_profile_id.eq.${author.id},author_id.eq.${author.userId}`)
    .order("title");
  if (error) throw new Error(`feed_composer_read_failed:${error.message}`);
  const list = (courses ?? []) as { id: string; title: string }[];
  if (list.length === 0) return [];
  const { data: lessons, error: lessonError } = await db
    .from("lms_lessons")
    .select("id, course_id, title, order, blocks")
    .in(
      "course_id",
      list.map((course) => course.id),
    )
    .order("order");
  if (lessonError) throw new Error(`feed_composer_read_failed:${lessonError.message}`);
  const byCourse = new Map<string, ComposerCourse["lessons"]>();
  for (const lesson of (lessons ?? []) as { id: string; course_id: string; title: string; blocks: unknown }[]) {
    const entry = byCourse.get(lesson.course_id) ?? [];
    entry.push({ id: lesson.id, title: lesson.title, blocks: feedBlockOptions(lesson.blocks) });
    byCourse.set(lesson.course_id, entry);
  }
  return list.map((course) => ({ id: course.id, title: course.title, lessons: byCourse.get(course.id) ?? [] }));
}
