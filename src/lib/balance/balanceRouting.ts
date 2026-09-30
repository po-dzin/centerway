import { DOSHA_PRIMARY_EXIT } from "@/lib/dosha/doshaRouting";
import type { BalanceType } from "@/lib/balance/balanceTest";

/**
 * Where «Отримати персональні рекомендації» leads from the balance result.
 *
 * The same consultation the dosha test opens, but WITHOUT its `dosha=`
 * parameter: that one tells the landing the reader's constitution, and
 * «vata» here means a vata imbalance right now — a different claim in the
 * same word. The reading travels only as `utm_content`, which the lead form
 * forwards verbatim, so the request still arrives saying what the test found.
 */
export function balanceConsultHref(primary: BalanceType): string {
  const params = new URLSearchParams({
    utm_source: "platform",
    utm_medium: "balance_test",
    utm_campaign: "balance_result",
    utm_content: `balance_${primary}`,
  });
  const [base, existingQuery] = DOSHA_PRIMARY_EXIT.href.split("?");
  return `${base}?${existingQuery ? `${existingQuery}&` : ""}${params.toString()}`;
}
