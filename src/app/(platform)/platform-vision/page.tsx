import { permanentRedirect } from "next/navigation";

// Retired page. Permanent, so a crawler that still knows the address moves its
// weight to the home page instead of retrying it.
export default function VisionPage() {
  permanentRedirect("/");
}
