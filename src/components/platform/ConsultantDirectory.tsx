import { ConsultationCard } from "@/components/platform/ConsultationCard";
import { PlatformBlock } from "@/components/platform/PlatformBlock";
import { PlatformOfferCarousel } from "@/components/platform/PlatformOfferCarousel";
import type { Author } from "@/lms-core";

/**
 * The authors who take consultations, on `/consult` — the hub's whole job since
 * 2026-10-16, when its form moved to each author's page.
 *
 * Each card is that author's consultation (`ConsultationCard`), not their
 * general preview: the card and its button lead to the request on the
 * author's page. The page decides who is in the list (consent is
 * `consultation.enabled`); this block trusts what it is handed.
 */
export function ConsultantDirectory({ authors }: { authors: Author[] }) {
  if (authors.length === 0) return null;
  return (
    <PlatformBlock id="consultants" label="Автори" title="З ким можна поговорити">
      <PlatformOfferCarousel label="Консультації авторів">
        {authors.map((author) => (
          <ConsultationCard key={author.slug} author={author} primary={authors.length === 1} />
        ))}
      </PlatformOfferCarousel>
    </PlatformBlock>
  );
}
