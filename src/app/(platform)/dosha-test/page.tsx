import { permanentRedirect } from "next/navigation";
import { DOSHA_TEST_ROUTE } from "@/lib/platform/tests";

// Legacy route. The dosha test now lives inside the tests hub (/tests/dosha);
// this stays a redirect because older links and the dosha funnel host still use it.
export default function LegacyDoshaTestPage() {
  permanentRedirect(DOSHA_TEST_ROUTE);
}
