import BalanceTestClient from "@/components/balance-test/BalanceTestClient";
import DoshaTestClient from "@/components/dosha-test/DoshaTestClient";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import {
  PlatformOfferCopyStack,
  PlatformOfferResultList,
  PlatformOfferSurfaceTemplate,
} from "@/components/platform/PlatformOfferSurfaceTemplate";
import { ConsultBoundary, ConsultFaq } from "@/components/platform/ConsultPageSections";
import { ConsultantDirectory } from "@/components/platform/ConsultantDirectory";
import type { Author } from "@/lms-core";
import { consultationHubSteps } from "@/components/platform/consultPageContract";
import { HubFree, HubMini, HubPrograms } from "@/components/platform/blocks/offer/hub";
import { HubHero, HubIntro } from "@/components/platform/blocks/orientation/hub";
import { HubGuides } from "@/components/platform/blocks/trust/guides";
import { HubProof, HubSupport } from "@/components/platform/blocks/trust/hub";
import { bodySignals, consultationCopy, platformPageArtwork } from "@/lib/platform/content";

export function PlatformHomePage() {
  return (
    <PlatformShell headerMode="overlay">
      <main data-cw-platform-template="home">
        <HubHero />
        <HubIntro />
        <HubMini />
        <HubPrograms />
        {/* After the programs, not before them: the free shelf is an entry to
            the catalogue, not the offer the home page leads with. */}
        <HubFree />
        <HubProof />
        <HubSupport />
        <HubGuides />
      </main>
    </PlatformShell>
  );
}

/**
 * Consultation, with the author inside it.
 *
 * These were two pages and one question. `/expert` answered "who is running
 * this", `/consult` answered "how do I work with him", and the only way to get
 * from the first to the second was a link — so a reader who arrived wanting a
 * consultation met a biography, and a reader who arrived at the biography had
 * to be sold the consultation a second time. They are now one surface: the page
 * IS the consultation, and the credentials and the path are the evidence for it
 * rather than a separate destination. `/expert` redirects here.
 *
 * The authors arrive as `ConsultantDirectory` — the same `AuthorCard` the home
 * page and `/experts` render, reading `lms_authors` — and not as the hand-built
 * founder panel this page used to carry. That panel outlived its own data: it
 * printed «12 років практики» from a constant while the profile in the database
 * said twenty. It has been deleted along with the biography written beside it.
 * The directory lands in `beforeSupport`, between "what happens" and the request
 * form: after the reader knows what is on offer, before they are asked to commit.
 */
export function PlatformConsultPage({ authors = [] }: { authors?: Author[] }) {
  /* A HUB, NOT A FORM (2026-10-16, mockup «Консультації і автори»).
     A request is always to one author, so it is left on that author's page,
     where the form knows whose it is. This page helps a reader choose: who
     takes consultations and about what, when a conversation is the right step,
     how it goes, and where its limits are. */
  return (
    <PlatformOfferSurfaceTemplate
      templateKind="consult"
      hero={{
        title: consultationCopy.title,
        description: consultationCopy.text,
        badge: "Консультації · онлайн",
        artwork: platformPageArtwork.consult,
        imageAlt: "Аюрведична консультація CenterWay",
        primaryAction: { href: "#consultants", label: "Обрати автора" },
        secondaryAction: { href: "#consult-details", label: "Як це відбувається" },
      }}
      afterHero={<ConsultantDirectory authors={authors} />}
      detailSectionId="consult-details"
      detailSemanticFamily="method-progress"
      detailLeft={{
        label: "Коли це доречно",
        title: "Коли варто прийти на розмову",
        body: <PlatformOfferResultList items={bodySignals} />,
      }}
      detailRight={{
        label: "Як це відбувається",
        title: "Три кроки до особистого плану",
        body: <PlatformOfferCopyStack items={[...consultationHubSteps]} />,
      }}
      beforeSupport={
        <>
          <ConsultBoundary />
          <ConsultFaq />
        </>
      }
    />
  );
}

export function PlatformDoshaTestPage({ author }: { author?: Author | null }) {
  return (
    <PlatformShell headerMode="overlay">
      <main data-cw-platform-template="dosha" data-cw-detail-template="dosha">
        <DoshaTestClient author={author ?? null} />
      </main>
    </PlatformShell>
  );
}

export function PlatformBalanceTestPage({ author }: { author?: Author | null }) {
  return (
    <PlatformShell headerMode="overlay">
      <main data-cw-platform-template="dosha" data-cw-detail-template="dosha">
        <BalanceTestClient author={author ?? null} />
      </main>
    </PlatformShell>
  );
}
