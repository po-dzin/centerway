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
import { FEED_PATH, excerptOf, feedPostPath, feedShareImage } from "@/lib/feed/model";
import { readFeedPost } from "@/lib/feed/page";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const post = await readFeedPost(id);
  if (!post) return {};
  /* The words as a reader sees them, not the stored markup; the picture is
     the post's own first visible one (`feedShareImage`), else the brand cover. */
  const image = feedShareImage(post);
  return pageMetadata({
    title: `${post.author.name} у Стрічці`,
    description: excerptOf(feedPlainText(post.body), 150),
    path: feedPostPath(post.id),
    ...(image
      ? {
          image: image.url,
          imageAlt: image.alt,
          ...(image.width && image.height ? { imageSize: { width: image.width, height: image.height } } : {}),
        }
      : {}),
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
