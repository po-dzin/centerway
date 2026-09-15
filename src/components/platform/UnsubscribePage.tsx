import { PlatformShell } from "@/components/platform/PlatformLayout";
import offerStyles from "@/components/platform/PlatformOfferStyles";
import styles from "@/components/platform/PlatformOfferCommerce.module.css";
import { verifyUnsubscribeToken } from "@/lib/broadcasts/unsubscribeToken";

import { UnsubscribeActions } from "./UnsubscribeActions";

/**
 * Where the «Відписатися» link in a broadcast lands.
 *
 * Built on the same status panel as the payment confirmation: one boundary,
 * one sentence, one action. It deliberately does NOT unsubscribe on arrival —
 * mail scanners open links, so the change waits for a person's press (see
 * /api/unsubscribe).
 *
 * The address is shown masked. The page is reachable by anyone holding the
 * link, and a forwarded letter should not hand its reader the full address.
 */
export function maskEmail(address: string): string {
  const [local = "", domain = ""] = address.split("@");
  const visible = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
  return `${visible}${"•".repeat(Math.max(1, Math.min(6, local.length - visible.length)))}@${domain}`;
}

export function UnsubscribePage({ token }: { token: string | null }) {
  const verdict = verifyUnsubscribeToken(token);

  return (
    <PlatformShell headerMode="default">
      <main data-cw-platform-template="unsubscribe">
        <section
          className={`${offerStyles.container} ${offerStyles.section}`}
          data-cw-semantic-role="support"
          data-cw-semantic-family="support-boundary"
          data-cw-token-source="global-app-ds"
        >
          <article className={`${offerStyles.panel} ${styles.statusPanel}`}>
            <UnsubscribeActions
              token={verdict.ok ? token : null}
              maskedAddress={verdict.ok ? maskEmail(verdict.address) : null}
            />
          </article>
        </section>
      </main>
    </PlatformShell>
  );
}
