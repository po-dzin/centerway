import { getLandingMetadata, renderLandingPage } from "@/lib/landing/renderLandingPage";

export const runtime = "nodejs";
export const metadata = getLandingMetadata("reboot");

export default async function RebootPage() {
  return renderLandingPage("reboot");
}
