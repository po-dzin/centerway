/**
 * «Свіже від авторів» — the feed's three latest posts on the home page, right
 * above «Автори»: first what the authors are saying now, then who they are.
 *
 * Since 2026-10-17 (G: «повні картки») these are the feed's own cards — photo,
 * attachment with its arrow, reactions, «Зберегти», «Поділитися» — folded
 * after four lines, the thread left to the post's page (`FeedFreshRail`).
 *
 * Absent when there is nothing to show — before the first post, and when the
 * feed could not be read. The home page never shows an empty shelf for it.
 */

import { PlatformBlock, PlatformBlockLink } from "@/components/platform/PlatformBlock";
import { EMPTY_FEED_FILTER, FEED_PATH } from "@/lib/feed/model";
import { readFeedFirstPage } from "@/lib/feed/page";

import { feedCopy } from "./copy";
import { FeedFreshRail } from "./FeedFreshRail";

export async function FeedFresh() {
  const { page } = await readFeedFirstPage(EMPTY_FEED_FILTER, { limit: 3, authorId: null });
  if (page.posts.length === 0) return null;

  return (
    <PlatformBlock
      id="fresh"
      label={feedCopy.freshLabel}
      title={feedCopy.freshTitle}
      lead={feedCopy.freshLead}
      headActions={<PlatformBlockLink href={FEED_PATH} label={feedCopy.freshAll} />}
    >
      <FeedFreshRail posts={page.posts} />
    </PlatformBlock>
  );
}
