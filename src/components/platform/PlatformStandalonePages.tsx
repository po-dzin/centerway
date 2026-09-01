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
import { consultationExpectations, consultationSteps } from "@/components/platform/consultPageContract";
import { HubMini, HubPrograms } from "@/components/platform/blocks/offer/hub";
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
 * The author blocks keep their own components — `ExpertProof` is the fact grid
 * and `ExpertPath` the route through the work — so nothing about them had to be
 * rewritten to move. They land in `beforeSupport`, between "what happens" and
 * the request form: after the reader knows what is on offer, before they are
 * asked to commit to it.
 */
export function PlatformConsultPage({ authors = [] }: { authors?: Author[] }) {
  return (
    <PlatformOfferSurfaceTemplate
      templateKind="consult"
      hero={{
        title: consultationCopy.title,
        description: consultationCopy.text,
        badge: "Консультація · онлайн",
        artwork: platformPageArtwork.consult,
        imageAlt: "Аюрведична консультація CenterWay",
        primaryAction: { href: "#consult-request", label: "Залишити запит" },
        secondaryAction: { href: "#consult-details", label: "Подивитися формат" },
      }}
      detailSectionId="consult-details"
      detailSemanticFamily="method-progress"
      detailLeft={{
        label: "Коли це доречно",
        title: "Запит починається зі стану, а не з випадкової покупки",
        body: <PlatformOfferResultList items={bodySignals} />,
      }}
      detailRight={{
        label: "Як це відбувається",
        title: "Три кроки від запиту до особистого плану",
        body: <PlatformOfferCopyStack items={[...consultationSteps]} />,
      }}
      supportSectionId="consult-request"
      supportLeft={{
        label: "Формат",
        title: "До 90 хвилин онлайн і зрозумілий наступний крок",
        lead:
          "На консультації ми збираємо стан, ритм, харчування, поточний рівень перевантаження і визначаємо, що зараз доречно: окрема практика, короткий вхід, детокс, програма або природна підтримка.",
        body: <PlatformOfferResultList items={[...consultationExpectations]} />,
      }}
      beforeSupport={
        <>
          <ConsultantDirectory authors={authors} />
          <ConsultBoundary />
          <ConsultFaq />
        </>
      }
      form={{
        label: "Запит",
        title: "Заповніть форму",
        productCode: "consult",
        source: "platform_consult_form",
        ctaPlace: "consult_request",
      }}
    />
  );
}

export function PlatformDoshaTestPage() {
  return (
    <PlatformShell headerMode="overlay">
      <main data-cw-platform-template="dosha" data-cw-detail-template="dosha">
        <DoshaTestClient />
      </main>
    </PlatformShell>
  );
}
