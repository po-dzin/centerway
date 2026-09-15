import type { Metadata } from "next";

import { UnsubscribePage } from "@/components/platform/UnsubscribePage";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Відписка від розсилки",
  description: describe("Відписка від листів розсилки CenterWay.", { bounded: false }),
  // A personal link with a token in it; nothing here belongs in an index.
  noindex: true,
});

export default async function Unsubscribe({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <UnsubscribePage token={typeof params.t === "string" ? params.t : null} />;
}
