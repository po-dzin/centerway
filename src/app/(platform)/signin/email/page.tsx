import type { Metadata } from "next";

import { EmailSignInScreen } from "@/components/auth/EmailSignInScreen";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Вхід через пошту",
  description: "Вхід у кабінет CenterWay за адресою електронної пошти та кодом із листа.",
  // A door, not a page: nothing here is worth a search result, and the query
  // string it reads names wherever the person was going.
  noindex: true,
});

export default function EmailSignInPage() {
  return (
    <PlatformShell headerMode="overlay">
      <EmailSignInScreen />
    </PlatformShell>
  );
}
