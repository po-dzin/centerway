import { HubHero, HubIntro } from "@/components/platform/blocks/orientation/hub";
import { HubMini, HubPrograms } from "@/components/platform/blocks/offer/hub";
import { NextStep } from "@/components/platform/blocks/route/next";
import { ExpertHero, ExpertPath, ExpertProof } from "@/components/platform/blocks/trust/expert";
import { HubProof, HubSupport } from "@/components/platform/blocks/trust/hub";
import { BoundaryBlock, SupportForm } from "@/components/platform/blocks/trust/support";
import { OfferHero, OfferInfo, OfferForm } from "@/components/platform/blocks/offer/surface";
import type { PlatformBlockComponent } from "@/components/platform/blocks/types";

export const platformBlockRegistry: Record<string, PlatformBlockComponent> = {
  "hub.hero": HubHero,
  "hub.intro": HubIntro,
  "hub.mini": HubMini,
  "hub.programs": HubPrograms,
  "hub.support": HubSupport,
  "hub.proof": HubProof,
  "support.form": SupportForm,
  "expert.hero": ExpertHero,
  "expert.proof": ExpertProof,
  "expert.path": ExpertPath,
  "offer.hero": OfferHero,
  "offer.info": OfferInfo,
  "offer.form": OfferForm,
  boundary: BoundaryBlock,
  next: NextStep,
};
