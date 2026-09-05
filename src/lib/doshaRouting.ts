import { getFunnelHostUrl } from "@/lib/surfaces/catalog";
import type { DoshaConfidence, DoshaResultType } from "@/lib/doshaTest";

/**
 * WHO IS ALLOWED TO HEAR THE RESULT.
 *
 * A dosha is a reading inside one method, not a fact about a person that every
 * surface may reuse. The founder's consultation works in that method, so
 * opening it with the reader's result is continuity. A consultation with an
 * expert who works in another method — and the platform is multi-author — would
 * be handed a vocabulary they never agreed to, in front of their own client.
 *
 * So the destination declares it, and the destination is what decides: nothing
 * carries a dosha unless `carriesDoshaContext` is true on the exit itself. A
 * new exit is silent by default, which is the safe direction to be wrong in.
 */
export const DOSHA_PRIMARY_EXIT = {
  productKey: "consult",
  href: getFunnelHostUrl("consult") ?? "/consult",
  target: "consult",
  ctaTarget: "consult",
  nextStep: "consult",
  carriesDoshaContext: true,
} as const;

export const DOSHA_SECONDARY_EXIT = {
  productKey: "way21",
  href: getFunnelHostUrl("way21") ?? "/way21",
  target: "way21",
  ctaTarget: "way21",
  nextStep: "way21",
  carriesDoshaContext: true,
} as const;

export type DoshaExit = {
  href: string;
  carriesDoshaContext?: boolean;
};

export type DoshaExitContext = {
  resultType: DoshaResultType | null;
  confidence?: DoshaConfidence | null;
};

/* THE RESULT TRAVELS WITH THE CLICK — to destinations that work in the method.
   The button says «отримати персональні рекомендації» and used to land on a
   constant URL that knew nothing about the person who pressed it — the promise
   was made and broken inside one navigation. These parameters are what the
   landing needs to open with the reader's own result instead of a greeting;
   an exit that has not claimed the method gets the campaign tags and no
   result. */
export function doshaExitHref(exit: DoshaExit, context: DoshaExitContext): string {
  const params = new URLSearchParams({
    utm_source: "platform",
    utm_medium: "dosha_test",
    utm_campaign: "dosha_result",
  });
  if (context.resultType && exit.carriesDoshaContext) {
    params.set("dosha", context.resultType);
    /* utm_content rides along because the landing's lead form already forwards
       it verbatim: the consultation request then arrives carrying the result
       the person got, without the static page learning anything new. */
    params.set("utm_content", `dosha_${context.resultType}`);
  }
  if (context.confidence && exit.carriesDoshaContext) {
    params.set("dosha_confidence", context.confidence);
  }

  const query = params.toString();
  const [base, existingQuery] = exit.href.split("?");
  const merged = existingQuery ? `${existingQuery}&${query}` : query;
  return `${base}?${merged}`;
}
