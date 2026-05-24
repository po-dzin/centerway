"use client";

import type { ComponentType } from "react";
import {
  FunnelBoundarySection,
  FunnelFormatPriceSection,
  FunnelHeroSection,
  FunnelHowItWorksSection,
  FunnelNextStepSection,
  FunnelOfferDefinitionSection,
  FunnelOfferIncludesSection,
  FunnelProofSection,
  FunnelRouteMapSection,
  FunnelRouteFramingSection,
  FunnelStageBreakdownSection,
} from "@/components/landing/revork/FunnelSections";
import {
  PilotLessonHeader,
  PilotLessonNextStep,
  PilotLessonPractice,
} from "@/components/lesson/PilotLessonRecipes";
import type { GeneratorAnalyticsContext } from "@/lib/generator/renderContext";

type RecipeRendererProps = {
  blockId: string;
  recipeId: string;
  recipeVersion: string;
  componentKey: string;
  semanticBlockType?: string;
  semanticFamily?: string;
  semanticRole?: string;
  userQuestion?: string;
  routeBoundary?: string;
  renderer?: string;
  props: Record<string, unknown>;
  generatorContext: Omit<GeneratorAnalyticsContext, "recipe_version">;
};

const componentRegistry: Record<string, ComponentType<any>> = {
  "lesson.pilot.header": PilotLessonHeader,
  "lesson.pilot.practice": PilotLessonPractice,
  "lesson.pilot.nextstep": PilotLessonNextStep,
  "funnel.hero": FunnelHeroSection,
  "funnel.route-framing": FunnelRouteFramingSection,
  "funnel.route-map": FunnelRouteMapSection,
  "funnel.offer-definition": FunnelOfferDefinitionSection,
  "funnel.offer-includes": FunnelOfferIncludesSection,
  "funnel.format-price": FunnelFormatPriceSection,
  "funnel.how-it-works": FunnelHowItWorksSection,
  "funnel.stage-breakdown": FunnelStageBreakdownSection,
  "funnel.proof": FunnelProofSection,
  "funnel.boundary": FunnelBoundarySection,
  "funnel.next-step": FunnelNextStepSection,
};

export function RecipeRenderer({
  blockId,
  recipeId,
  recipeVersion,
  componentKey,
  semanticBlockType,
  semanticFamily,
  semanticRole,
  userQuestion,
  routeBoundary,
  renderer,
  props,
  generatorContext,
}: RecipeRendererProps) {
  const Component = componentRegistry[componentKey];
  if (!Component) {
    return (
      <section className="section">
        <div className="container">
          <div className="card">
            <h3>Missing recipe component</h3>
            <p>{componentKey}</p>
          </div>
        </div>
      </section>
    );
  }

  const analyticsContext: GeneratorAnalyticsContext = {
    ...generatorContext,
    recipe_version: recipeVersion,
  };

  return (
    <div
      data-cw-block-id={blockId}
      data-cw-recipe-id={recipeId}
      data-cw-recipe-version={recipeVersion}
      data-cw-semantic-block-type={semanticBlockType}
      data-cw-semantic-family={semanticFamily}
      data-cw-semantic-role={semanticRole}
      data-cw-user-question={userQuestion}
      data-cw-route-boundary={routeBoundary}
      data-cw-renderer={renderer}
    >
      <Component {...props} generatorContext={analyticsContext} />
    </div>
  );
}
