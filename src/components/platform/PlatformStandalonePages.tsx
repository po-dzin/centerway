import DoshaTestClient from "@/components/dosha-test/DoshaTestClient";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import {
  PlatformOfferCopyStack,
  PlatformOfferResultList,
  PlatformOfferSurfaceTemplate,
} from "@/components/platform/PlatformOfferSurfaceTemplate";
import { HubMini, HubPrograms } from "@/components/platform/blocks/offer/hub";
import { HubHero, HubIntro } from "@/components/platform/blocks/orientation/hub";
import { ExpertHero, ExpertPath, ExpertProof } from "@/components/platform/blocks/trust/expert";
import { HubProof, HubSupport } from "@/components/platform/blocks/trust/hub";
import { BoundaryBlock, SupportForm } from "@/components/platform/blocks/trust/support";
import { bodySignals, consultationCopy, journeySteps, platformPageArtwork } from "@/lib/platform/content";

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
        <SupportForm route="platform-home" />
        <BoundaryBlock />
      </main>
    </PlatformShell>
  );
}

export function PlatformExpertPage() {
  return (
    <PlatformShell headerMode="overlay">
      <main data-cw-platform-template="expert">
        <ExpertHero />
        <ExpertProof />
        <ExpertPath />
        <SupportForm route="expert" />
        <BoundaryBlock />
      </main>
    </PlatformShell>
  );
}

export function PlatformConsultPage() {
  const consultJourney = journeySteps.filter((step) => ["signals", "diagnostics", "programs"].includes(step.id));

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
        label: "Що відбувається далі",
        title: "Живий маршрут на 2-4 тижні",
        body: <PlatformOfferCopyStack items={consultJourney.map((step) => ({ id: step.id, title: step.title, text: step.text }))} />,
      }}
      supportSectionId="consult-request"
      supportLeft={{
        label: "Формат",
        title: "До 90 хвилин онлайн і зрозумілий наступний крок",
        lead:
          "На консультації ми збираємо стан, ритм, харчування, поточний рівень перевантаження і визначаємо, що зараз доречно: окрема практика, короткий вхід, детокс, програма або природна підтримка.",
      }}
      form={{
        label: "Запит",
        title: "Заповніть форму",
        productCode: "consult",
        source: "platform_consult_form",
        ctaPlace: "consult_request",
      }}
      boundary={{
        label: "Межі методу",
        title: "Чесний формат без медичних обіцянок",
        lead:
          "CenterWay працює як освітня wellness-платформа і маршрут практики. Програми не замінюють діагностику, лікування або рекомендації лікаря; якщо є гострі стани, вагітність, хронічні захворювання або медикаментозна терапія, спочатку потрібна медична консультація.",
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
