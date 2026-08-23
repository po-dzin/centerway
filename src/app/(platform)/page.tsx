import type { Metadata } from "next";
import { PlatformHomePage } from "@/components/platform/PlatformStandalonePages";
import { BRAND } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  // The one page whose title opens with the name — the layout's template would
  // otherwise append a second one.
  absoluteTitle: true,
  title: `${BRAND.name} — ${BRAND.category}`,
  description: BRAND.description,
  path: "/",
});

export default function Home() {
  return <PlatformHomePage />;
}
