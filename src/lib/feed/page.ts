/**
 * What the feed's PAGES read on the server (2026-10-16). Server-only.
 *
 * The routes under /api/feed answer the browser; these answer the first render
 * of `/feed`, `/feed/[id]`, the home page's strip and an author's «Дописи», so
 * the posts are in the markup a crawler and a slow phone receive rather than
 * arriving after a spinner.
 *
 * NEVER THROWS INTO A PAGE. Before the feed's migration is applied, and on any
 * read failure after it, the answer is an empty feed: the home page must not
 * lose its other blocks because one strip could not be read, and `/feed` says
 * «поки порожньо» rather than showing an error to a guest.
 */

import { EMPTY_FEED_FILTER, type FeedFilter } from "./model";
import { feedDb } from "./http";
import { getFeedPost, listFeed, listFeedAuthors, type FeedAuthor, type FeedPage, type FeedPost } from "./server";

const EMPTY_PAGE: FeedPage = { posts: [], next: null };

function logged(scope: string, error: unknown): void {
  console.error(`feed_page_${scope}_failed:`, error instanceof Error ? error.message : error);
}

/** The first page for a filter, and the authors the filter can offer. */
export async function readFeedFirstPage(
  filter: FeedFilter = EMPTY_FEED_FILTER,
  options: { authorId?: string | null; limit?: number } = {},
): Promise<{ page: FeedPage; authors: FeedAuthor[] }> {
  try {
    const db = feedDb();
    const [page, authors] = await Promise.all([
      listFeed(db, { filter, me: null, authorId: options.authorId ?? null, limit: options.limit }),
      options.authorId ? Promise.resolve([] as FeedAuthor[]) : listFeedAuthors(db),
    ]);
    return { page, authors };
  } catch (error) {
    logged("list", error);
    return { page: EMPTY_PAGE, authors: [] };
  }
}

/** One published post for its own address, or null. */
export async function readFeedPost(id: string): Promise<FeedPost | null> {
  try {
    return await getFeedPost(feedDb(), id, null);
  } catch (error) {
    logged("post", error);
    return null;
  }
}
