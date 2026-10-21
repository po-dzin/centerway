/**
 * `/feed/[id]` — one post on its own address, with its comments open.
 *
 * Where a shared link and «Мій журнал» lead. A post that is not published (or
 * was hidden) is a 404 for everyone here; its author reads it in «Мої дописи».
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeedPostPage } from "@/components/platform/feed/FeedPage";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { feedPlainText } from "@/lib/feed/format";
import {
  FEED_CARD_SIZE,
  FEED_PATH,
  FEED_SHARE_SITE,
  feedCardPath,
  feedHeadline,
  feedPostPath,
  feedShareDescription,
} from "@/lib/feed/model";
import { readFeedPost } from "@/lib/feed/page";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const post = await readFeedPost(id);
  if (!post) return {};
  /* A shared link reads as the post (G 2026-10-21): its opening, as the author
     wrote it, is the card's headline under «CenterWay · Стрічка»; the words go
     on from there after the author's name; the picture is the post's own card
     (`/api/feed/:id/card`) — its photo, or its opening words — with the mark. */
  const { title, rest } = feedHeadline(feedPlainText(post.body));
  return pageMetadata({
    title: `${post.author.name} у Стрічці`,
    description: feedShareDescription(post, rest),
    path: feedPostPath(post.id),
    share: { title, siteName: FEED_SHARE_SITE },
    image: feedCardPath(post.id),
    imageAlt: title,
    imageSize: FEED_CARD_SIZE,
  });
}

export default async function FeedPostRoute({ params }: { params: Params }) {
  const { id } = await params;
  const post = await readFeedPost(id);
  if (!post) notFound();
  return (
    <PlatformShell back={{ href: FEED_PATH, label: "До стрічки", text: "Стрічка" }}>
      <FeedPostPage post={post} />
    </PlatformShell>
  );
}
