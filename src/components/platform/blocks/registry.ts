import { ExpertHero, ExpertPath, ExpertProof } from "@/components/platform/blocks/expert";
import { HomeHero, HomeIntro, HomeMiniCourses, HomeNaturalSupport, HomePrograms, HomeProof } from "@/components/platform/blocks/home";
import { OfferDetails, OfferHero, OfferSupport } from "@/components/platform/blocks/offer";
import { BoundaryBlock, NextStep, SupportForm } from "@/components/platform/blocks/shared";
import type { PlatformBlockComponent } from "@/components/platform/blocks/types";

export const platformBlockRegistry: Record<string, PlatformBlockComponent> = {
  "home.hero": HomeHero,
  "home.intro": HomeIntro,
  "home.mini-courses": HomeMiniCourses,
  "home.programs": HomePrograms,
  "home.natural-support": HomeNaturalSupport,
  "home.proof": HomeProof,
  "support.form": SupportForm,
  "expert.hero": ExpertHero,
  "expert.proof": ExpertProof,
  "expert.path": ExpertPath,
  "offer.hero": OfferHero,
  "offer.details": OfferDetails,
  "offer.support": OfferSupport,
  boundary: BoundaryBlock,
  "next-step": NextStep,
};
