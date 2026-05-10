import type { ComponentType } from "react";
import type { programPageBySlug } from "@/lib/platform/content";

export type PlatformProgramSlug = keyof typeof programPageBySlug;

export type PlatformGeneratedBlockProps = {
  route: string;
  variant: string;
  programSlug?: PlatformProgramSlug;
};

export type PlatformBlockComponent = ComponentType<PlatformGeneratedBlockProps>;
