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
import { describe } from "@/lib/brand/identity";
import { FEED_PATH, excerptOf, feedPostPath } from "@/lib/feed/model";
import { readFeedPost } from "@/lib/feed/page";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const post = await readFeedPost(id);
  if (!post) return {};
  return pageMetadata({
    title: `${post.author.name} у Стрічці`,
    description: describe(excerptOf(post.body, 150)),
    path: feedPostPath(post.id),
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
