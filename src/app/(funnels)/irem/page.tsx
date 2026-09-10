import { getLandingMetadata, renderLandingPage } from "@/components/landing/renderLandingPage";
import type { SearchParams } from "@/lib/products";

export const runtime = "nodejs";
export const metadata = getLandingMetadata("irem");

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function IremLandingPage({ searchParams }: PageProps) {
  return renderLandingPage("irem", await searchParams);
}
