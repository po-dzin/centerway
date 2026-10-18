/**
 * `/feed` — «Стрічка», every author's posts in one column (G, 16.10).
 *
 * Open to everyone. The filter is the address (`?topic=breathing&author=evgeniy`),
 * so the server renders exactly the list a shared link asks for.
 */

import type { Metadata } from "next";

import { FeedPage } from "@/components/platform/feed/FeedPage";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { describe } from "@/lib/brand/identity";
import { FEED_PATH, parseFeedFilter } from "@/lib/feed/model";
import { readFeedFirstPage } from "@/lib/feed/page";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Стрічка",
  description: describe("Дописи авторів CenterWay: практики, думки й події з програм."),
  path: FEED_PATH,
});

type Search = Promise<{ topic?: string | string[]; author?: string | string[] }>;

export default async function FeedRoute({ searchParams }: { searchParams: Search }) {
  const filter = parseFeedFilter(await searchParams);
  const { page, authors } = await readFeedFirstPage(filter);
  return (
    <PlatformShell headerMode="overlay">
      <FeedPage page={page} authors={authors} filter={filter} />
    </PlatformShell>
  );
}
