import { getLandingMetadata, renderLandingPage } from "@/lib/landing/renderLandingPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = getLandingMetadata("irem");

export default async function IremLandingPage() {
  return renderLandingPage("irem");
}
