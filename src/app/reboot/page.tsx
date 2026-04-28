import { getLandingMetadata, renderLandingPage } from "@/lib/landing/renderLandingPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = getLandingMetadata("short");

export default async function RebootPage() {
  return renderLandingPage("short");
}
