import { getLandingMetadata, renderLandingPage } from "@/lib/landing/renderLandingPage";

export const runtime = "nodejs";
export const metadata = getLandingMetadata("short");

export default async function ShortPage() {
  return renderLandingPage("short");
}
