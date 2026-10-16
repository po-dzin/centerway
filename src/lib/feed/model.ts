/**
 * «Стрічка» — the authors' feed: the pure half (2026-10-16).
 *
 * Client-safe: no database, no network. What the page, the API routes and the
 * tests must agree on lives here — what a post may say, which topics and
 * reactions exist, how a filter reads from an address, how reactions are
 * counted and which three stand under a post.
 *
 * Decisions behind it (G, 16.10; mockup https://claude.ai/artifact/1ntoi3FtLYCqxA9kSRYuB5):
 * - one feed of every author, open without sign-in; reacting, commenting and
 *   marking need an account;
 * - only authors write, from the feed page; the author picks the topic, one of
 *   the catalogue's eight categories; there is no «Анонси» topic;
 * - the filter is the catalogue's popover: topics add up within their group,
 *   authors add up within theirs, the two groups narrow each other; the choice
 *   lives in the address (`/feed?topic=breathing,relaxation&author=evgeniy`);
 * - reactions come from the hand-drawn set in the design system; under a post
 *   the three most used, then «+».
 */

import { COURSE_CATEGORIES, type CourseCategory } from "@/lms-core";
import { CW_EMOJI, type CwEmojiId } from "@/lib/brand/emojiSet";

export const FEED_PATH = "/feed";

/** One post's own address — shared links and the journal lead here. */
export function feedPostPath(id: string): string {
  return `${FEED_PATH}/${id}`;
}

export const FEED_POST_MAX = 4000;
export const FEED_COMMENT_MAX = 1000;
/** How many posts a page of the feed carries; «Показати ще» asks for the next. */
export const FEED_PAGE_SIZE = 20;
/** Reactions shown under a post before «+». */
export const FEED_TOP_REACTIONS = 3;

export type FeedTopic = CourseCategory;
export const FEED_TOPICS: readonly FeedTopic[] = COURSE_CATEGORIES;

export type FeedPostStatus = "checking" | "published" | "held" | "returned";
export type FeedBlockDisplay = "full" | "excerpt";

export function isFeedTopic(value: unknown): value is FeedTopic {
  return typeof value === "string" && (FEED_TOPICS as readonly string[]).includes(value);
}

const EMOJI_IDS = new Set<string>(CW_EMOJI.map((entry) => entry.id));

export function isFeedEmoji(value: unknown): value is CwEmojiId {
  return typeof value === "string" && EMOJI_IDS.has(value);
}

export function emojiName(id: string): string {
  return CW_EMOJI.find((entry) => entry.id === id)?.name ?? id;
}

/**
 * Trimmed text with runs of blank lines folded to one, or null when there is
 * nothing to publish or too much of it. Same rule the announcements keep.
 */
export function normalizeFeedText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text || text.length > max) return null;
  return text;
}

/* ─────────────────────────── filter ─────────────────────────── */

export type FeedFilter = { topics: FeedTopic[]; authors: string[] };

export const EMPTY_FEED_FILTER: FeedFilter = { topics: [], authors: [] };

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

function listParam(value: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The filter an address asks for. Unknown topics and malformed slugs are
 * dropped rather than answered with an error: a link shared months ago must
 * still open the feed, even if a word in it no longer exists.
 */
export function parseFeedFilter(params: {
  topic?: string | string[] | null;
  author?: string | string[] | null;
}): FeedFilter {
  const topics = [...new Set(listParam(params.topic).filter(isFeedTopic))];
  const authors = [...new Set(listParam(params.author).filter((slug) => SLUG.test(slug)))];
  // Stored in the catalogue's own order, so one choice has one address.
  topics.sort((a, b) => FEED_TOPICS.indexOf(a) - FEED_TOPICS.indexOf(b));
  authors.sort();
  return { topics, authors };
}

/** The query string for a filter, without the leading «?»; empty when nothing is chosen. */
export function feedFilterQuery(filter: FeedFilter): string {
  const parts: string[] = [];
  const topics = [...filter.topics].sort((a, b) => FEED_TOPICS.indexOf(a) - FEED_TOPICS.indexOf(b));
  if (topics.length) parts.push(`topic=${topics.join(",")}`);
  if (filter.authors.length) parts.push(`author=${[...filter.authors].sort().join(",")}`);
  return parts.join("&");
}

export function feedFilterCount(filter: FeedFilter): number {
  return filter.topics.length + filter.authors.length;
}

/* ─────────────────────────── reactions ─────────────────────────── */

export type ReactionCount = { emoji: CwEmojiId; count: number; mine: boolean };

/**
 * Counts per emoji for one post, most used first; ties keep the set's own
 * order so the row does not reshuffle between two equal counts.
 */
export function countReactions(rows: { emoji: string; auth_user_id: string }[], me: string | null): ReactionCount[] {
  const by = new Map<CwEmojiId, ReactionCount>();
  for (const row of rows) {
    if (!isFeedEmoji(row.emoji)) continue;
    const entry = by.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
    entry.count += 1;
    if (me && row.auth_user_id === me) entry.mine = true;
    by.set(row.emoji, entry);
  }
  const order = CW_EMOJI.map((entry) => entry.id as string);
  return [...by.values()].sort((a, b) => b.count - a.count || order.indexOf(a.emoji) - order.indexOf(b.emoji));
}

/**
 * The chips under a post: the three most used, and the reader's own reaction
 * even when it is not among them — a reader must always see, and be able to
 * take back, what they pressed.
 */
export function visibleReactions(counts: ReactionCount[]): ReactionCount[] {
  const top = counts.slice(0, FEED_TOP_REACTIONS);
  const mine = counts.filter((entry) => entry.mine && !top.includes(entry));
  return [...top, ...mine];
}

/* ─────────────────────────── block excerpt ─────────────────────────── */

/** How much of a lesson block an «уривок» shows before the button to the programme. */
export const FEED_EXCERPT_CHARS = 280;

/** The opening of a block's text, cut at a word, with an ellipsis when cut. */
export function excerptOf(text: string, max = FEED_EXCERPT_CHARS): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—–-]+$/, "")}…`;
}
