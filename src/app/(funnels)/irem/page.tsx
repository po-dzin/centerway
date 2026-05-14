import { getLandingMetadata, renderLandingPage } from "@/lib/landing/renderLandingPage";

export const runtime = "nodejs";
export const metadata = getLandingMetadata("irem");

export default async function IremLandingPage() {
  return renderLandingPage("irem");
}
